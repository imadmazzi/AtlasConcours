const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const db = require('./db');
const slugify = require('slugify');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "VOTRE_CLE_API");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ─── Serverless-aware constants ─────────────────────────────────────────────
const IS_VERCEL      = !!process.env.VERCEL;
const ITEM_LIMIT     = IS_VERCEL ? 3  : 15;   // max items per source per run
const FETCH_TIMEOUT  = IS_VERCEL ? 5000 : 15000;
const RETRY_COUNT    = IS_VERCEL ? 1  : 2;
const RETRY_DELAY    = IS_VERCEL ? 500 : 2000;
const BATCH_DELAY    = IS_VERCEL ? 0   : 2000; // inter-batch sleep (ms)
const REWRITE_BATCH  = IS_VERCEL ? 1   : 3;    // items per AI rewrite call
// ────────────────────────────────────────────────────────────────────────────

/**
 * Helper: Requête avec mécanisme de retry
 */
async function fetchWithRetry(url, options = {}, retries = RETRY_COUNT) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, { ...options, timeout: FETCH_TIMEOUT });
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`⚠️ Retrying (${i + 1}/${retries}) for ${url}...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
}

/**
 * Réécrit un lot d'éléments via IA (Batch processing)
 */
async function rewriteBatch(items, type = "concours") {
  if (!process.env.GEMINI_API_KEY || items.length === 0) {
    return items.map(item => ({
      ...item,
      rewritten: {
        title: item.title + " (Nouveau)",
        description: item.description,
        summary: item.title + " est disponible.",
        enterprise: "Administration",
        location: "Maroc"
      }
    }));
  }

  const prompt = `
    Tu es un expert en rédaction SEO au Maroc. Réécris les éléments suivants en JSON.
    Chaque élément doit avoir un titre accrocheur, une description HTML propre et un résumé SEO.
    
    Type: ${type === 'job' ? "Offres d'emploi" : "Concours"}
    
    Données à traiter:
    ${JSON.stringify(items.map(it => ({ t: it.title, d: it.description })))}
    
    Format de réponse (JSON Array uniquement):
    [
      {
        "title": "...",
        "description": "...",
        "summary": "...",
        "enterprise": "...",
        "location": "..."
      }
    ]
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const results = JSON.parse(jsonStr);
    
    return items.map((item, index) => ({
      ...item,
      rewritten: results[index] || { title: item.title, description: item.description, summary: "", enterprise: "", location: "" }
    }));
  } catch (error) {
    console.error("❌ Erreur Batch IA:", error.message);
    return items.map(item => ({ ...item, rewritten: null }));
  }
}

/**
 * Insert a single processed item into the database immediately.
 * Returns true on success, false on error.
 */
function insertItemNow(item, type) {
  const safeTitle       = item.rewritten?.title       || item.title       || 'Sans titre';
  const safeDescription = item.rewritten?.description || item.description || 'Détails non disponibles.';
  const safeEnterprise  = item.rewritten?.enterprise  || item.enterprise  || 'Administration';
  const safeLocation    = item.rewritten?.location    || item.location    || 'Maroc';
  const safeDeadline    = item.deadline || '';
  const safeUrl         = item.url || '';

  try {
    if (type === 'concours') {
      const slug = slugify(safeTitle, { lower: true, strict: true, locale: 'fr' }) + '-' + Date.now();
      db.prepare("INSERT INTO concours").run(safeTitle, slug, safeDescription, "Concours", safeDeadline, safeUrl);
    } else {
      db.prepare("INSERT INTO emplois").run(safeTitle, safeEnterprise, safeLocation, safeDescription, safeUrl);
    }
    console.log(`  💾 Inserted: ${safeTitle.substring(0, 60)}…`);
    return true;
  } catch (insertErr) {
    console.error(`  ❌ Insert failed (${safeTitle.substring(0, 40)}):`, insertErr.message);
    return false;
  }
}

/**
 * Pipeline de traitement — insère chaque item immédiatement après rewrite.
 * On Vercel, processes REWRITE_BATCH (1) item at a time so each DB insert
 * happens within the execution window.
 */
async function processPipeline(items, type) {
  console.log(`⚙️ Processing ${items.length} new items (${type}) [${IS_VERCEL ? 'VERCEL' : 'LOCAL'} mode]…`);
  let addedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 1. Fetch detail page for this single item
    try {
      const res = await fetchWithRetry(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, httpsAgent });
      const $ = cheerio.load(res.data);
      const description = $('.bloc_offre_home').html() || $('.detail-content').html() || $('.card-body').html() || $.html() || "Détails non disponibles.";
      item.description = description.trim();
    } catch (err) {
      item.description = "Détails non disponibles.";
    }

    // 2. Collect a micro-batch for AI rewrite (1 on Vercel, up to REWRITE_BATCH locally)
    const microBatch = [item];
    while (microBatch.length < REWRITE_BATCH && i + 1 < items.length) {
      i++;
      const next = items[i];
      try {
        const res = await fetchWithRetry(next.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, httpsAgent });
        const $ = cheerio.load(res.data);
        const description = $('.bloc_offre_home').html() || $('.detail-content').html() || $('.card-body').html() || $.html() || "Détails non disponibles.";
        next.description = description.trim();
      } catch (err) {
        next.description = "Détails non disponibles.";
      }
      microBatch.push(next);
    }

    // 3. AI Rewrite
    const rewrittenBatch = await rewriteBatch(microBatch, type);

    // 4. Insert EACH item into DB immediately
    for (const processed of rewrittenBatch) {
      if (!processed.rewritten) {
        processed.rewritten = {
          title: processed.title || 'Sans titre',
          description: processed.description || "Détails non disponibles.",
          enterprise: processed.enterprise || "Administration",
          location: processed.location || "Maroc"
        };
      }

      if (insertItemNow(processed, type)) {
        addedCount++;
      } else {
        errorCount++;
      }
    }

    // 5. Small delay between batches (skipped on Vercel)
    if (BATCH_DELAY > 0 && i < items.length - 1) {
      await new Promise(r => setTimeout(r, BATCH_DELAY + Math.random() * 1000));
    }
  }

  console.log(`📊 Pipeline done: ${addedCount} added, ${errorCount} errors.`);
  return { added: addedCount, errors: errorCount };
}

async function runScraper() {
  console.log("🚀 Scraper Concours (Optimisé)...");
  const baseUrl = "https://www.emploi-public.ma";
  try {
    const res = await fetchWithRetry(`${baseUrl}/fr/concours-liste`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const existingLinks = new Set(db.data.concours.map(c => c.lien_source));
    
    const newItems = [];
    $('a.card.card-scale').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const link = baseUrl + href;
      if (existingLinks.has(link)) return;

      const title = $(el).find('h2').text().trim() || $(el).find('.card-title').text().trim() || 'Concours';
      let deadline = "";
      $(el).find('div, span, p').each((j, sel) => {
        if ($(sel).text().includes("Limite")) deadline = $(sel).text().split(':')[1]?.trim() || "";
      });

      newItems.push({ title, url: link, deadline });
    });

    if (newItems.length > 0) {
      const limited = newItems.slice(0, ITEM_LIMIT);
      console.log(`📋 Concours: ${newItems.length} found, processing ${limited.length} (limit: ${ITEM_LIMIT})`);
      return await processPipeline(limited, 'concours');
    }
    return { added: 0, errors: 0 };
  } catch (err) { console.error("❌ Erreur Scraper Concours:", err.message); return { added: 0, errors: 0 }; }
}

async function runJobScraper() {
  console.log("🚀 Scraper Emplois (Optimisé)...");
  const baseUrl = "https://www.emploi-public.ma";
  try {
    const res = await fetchWithRetry(`${baseUrl}/fr/emploi-sup-liste`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const existingLinks = new Set(db.data.emplois.map(e => e.lien_candidature));
    
    const newItems = [];
    $('a.card.card-scale').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const link = baseUrl + href;
      if (existingLinks.has(link)) return;
      newItems.push({ title: $(el).find('h2').text().trim() || 'Emploi', url: link });
    });

    if (newItems.length > 0) {
      const limited = newItems.slice(0, ITEM_LIMIT);
      console.log(`📋 Emplois: ${newItems.length} found, processing ${limited.length} (limit: ${ITEM_LIMIT})`);
      return await processPipeline(limited, 'job');
    }
    return { added: 0, errors: 0 };
  } catch (err) { console.error("❌ Erreur Scraper Emplois:", err.message); return { added: 0, errors: 0 }; }
}

async function runAnapecScraper() {
  console.log("🚀 Scraper ANAPEC (Optimisé)...");
  const baseUrl = "https://www.anapec.org";
  try {
    const res = await fetchWithRetry(`${baseUrl}/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all`, { 
      headers: { 'User-Agent': 'Mozilla/5.0' }, httpsAgent 
    });
    const $ = cheerio.load(res.data);
    const existingLinks = new Set(db.data.emplois.map(e => e.lien_candidature));
    
    const newItems = [];
    let skippedCount = 0;
    const rows = $('table tr').slice(1);
    
    rows.each((i, el) => {
      const linkEl = $(el).find('a.nyroModal');
      if (!linkEl.length) return;
      const href = linkEl.attr('href');
      if (!href) return;
      const link = baseUrl + href;
      if (existingLinks.has(link)) {
        skippedCount++;
        return;
      }
      const tds = $(el).find('td');
      const enterprise = tds.length > 1 ? tds.eq(1).text().trim() || 'Administration' : 'Administration';
      const location   = tds.length > 2 ? tds.eq(2).text().trim() || 'Maroc' : 'Maroc';
      const title = linkEl.text().trim().replace(/\s+/g, ' ') || 'Offre d\'emploi';

      newItems.push({ title, url: link, enterprise, location });
    });

    let stats = { added: 0, errors: 0 };
    if (newItems.length > 0) {
      const limited = newItems.slice(0, ITEM_LIMIT);
      console.log(`📋 ANAPEC: ${newItems.length} found, processing ${limited.length} (limit: ${ITEM_LIMIT})`);
      stats = await processPipeline(limited, 'job');
    }
    
    console.log(`📊 Bilan ANAPEC: ${rows.length} analysés, ${skippedCount} ignorés (doublons), ${stats?.added || 0} ajoutés, ${stats?.errors || 0} erreurs.`);
    return stats;
  } catch (err) { 
    console.error("❌ Erreur Scraper ANAPEC:", err.message); 
    return { added: 0, errors: 0 };
  }
}

module.exports = { runScraper, runJobScraper, runAnapecScraper };
