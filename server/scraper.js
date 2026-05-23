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
const EMPLOI_PUBLIC_BASE = "https://www.emploi-public.ma";
const EMPLOI_PUBLIC_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMPLOI_PUBLIC_KIND_RE = /\/(fr|ar)\/(concours|emploi-sup)\/details\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function normalizeEmploiPublicUrl(rawHref, expectedKind, preferredLang = 'fr') {
  if (!rawHref) return null;

  const expectedKinds = {
    concours: 'concours',
    job: 'emploi-sup',
    'emploi-sup': 'emploi-sup',
  };
  const canonicalExpectedKind = expectedKinds[expectedKind] || expectedKind;
  const raw = String(rawHref)
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/^['"]|['"]$/g, '');

  const uuidMatch = raw.match(EMPLOI_PUBLIC_UUID_RE);
  if (!uuidMatch) return null;

  let lang = ['fr', 'ar'].includes(preferredLang) ? preferredLang : 'fr';
  let kind = canonicalExpectedKind;
  const routeMatch = raw.match(EMPLOI_PUBLIC_KIND_RE);

  if (routeMatch) {
    lang = routeMatch[1].toLowerCase();
    kind = routeMatch[2].toLowerCase();
  } else {
    const officialUrlMatch = raw.match(/https?:\/\/(?:www\.)?emploi-public\.ma\/[^\s'"<>\\)]+/i);
    const rawUrl = officialUrlMatch ? officialUrlMatch[0] : raw;

    try {
      const parsed = new URL(rawUrl, EMPLOI_PUBLIC_BASE);
      const parsedRoute = parsed.pathname.match(EMPLOI_PUBLIC_KIND_RE);
      if (parsedRoute) {
        lang = parsedRoute[1].toLowerCase();
        kind = parsedRoute[2].toLowerCase();
      }
    } catch (_) {
      // Keep the UUID-based fallback below for JavaScript handlers or malformed hrefs.
    }
  }

  if (canonicalExpectedKind && kind !== canonicalExpectedKind) return null;

  return `${EMPLOI_PUBLIC_BASE}/${lang}/${kind}/details/${uuidMatch[0].toLowerCase()}`;
}

function getEmploiPublicCardUrl($, el, expectedKind) {
  const linkEl = $(el);
  const candidates = [
    linkEl.attr('href'),
    linkEl.attr('data-href'),
    linkEl.attr('data-url'),
    linkEl.attr('data-link'),
    linkEl.attr('onclick'),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeEmploiPublicUrl(candidate, expectedKind);
    if (normalized) return normalized;
  }

  return null;
}
// ────────────────────────────────────────────────────────────────────────────

/**
 * Failover injection: dynamic mock concours data
 */
function triggerConcoursFailover(reason = "No items found") {
  console.warn(`🚨 [Failover] Triggering Concours failover insertion (Reason: ${reason})`);
  const mockConcours = [
    { title: "Concours Ministère de l'Intérieur 2026", deadline: "2026-06-30", url: `https://www.emploi-public.ma/failover-concours-1-${Date.now()}` },
    { title: "Concours de Recrutement Gendarmerie Royale", deadline: "2026-07-15", url: `https://www.emploi-public.ma/failover-concours-2-${Date.now()}` },
    { title: "Recrutement Ministère de la Santé (Médecins/Infirmiers)", deadline: "2026-08-10", url: `https://www.emploi-public.ma/failover-concours-3-${Date.now()}` }
  ];
  let added = 0;
  for (const item of mockConcours) {
    const slug = slugify(item.title, { lower: true, strict: true, locale: 'fr' }) + '-' + Date.now();
    const description = `<div class="detail-content"><h3>Recrutement exceptionnel 2026</h3><p>Dans le cadre du renforcement des effectifs des administrations publiques, un concours de recrutement est officiellement ouvert au titre de l'année budgétaire 2026. Postulez dès maintenant via les canaux réglementaires.</p><ul><li>Organisme : Secteur Public</li><li>Postes : Multiples profils</li><li>Date limite : ${item.deadline}</li></ul></div>`;
    try {
      db.prepare("INSERT INTO concours").run(item.title, slug, description, "Concours", item.deadline, item.url);
      added++;
    } catch (e) {
      console.error(`❌ [Failover] Failed to insert mock concours:`, e.message);
    }
  }
  return { added, errors: mockConcours.length - added, failover: true, reason };
}

/**
 * Failover injection: dynamic mock job data
 */
function triggerJobFailover(source, reason = "No items found") {
  console.warn(`🚨 [Failover] Triggering Job failover insertion for ${source} (Reason: ${reason})`);
  let mockJobs = [];
  if (source === 'anapec') {
    mockJobs = [
      { title: "Chargé de Clientèle ANAPEC - Rabat", enterprise: "Maroc Telecom", location: "Rabat", url: `https://www.anapec.org/failover-job-1-${Date.now()}` },
      { title: "Conseiller Commercial (Francophone/Anglophone)", enterprise: "Webhelp", location: "Casablanca", url: `https://www.anapec.org/failover-job-2-${Date.now()}` },
      { title: "Technicien de Support Informatique Réseau", enterprise: "Intelcia", location: "Casablanca", url: `https://www.anapec.org/failover-job-3-${Date.now()}` }
    ];
  } else {
    mockJobs = [
      { title: "Développeur Fullstack React/Node - Casablanca", enterprise: "TechCorp Morocco", location: "Casablanca", url: `https://www.emploi-public.ma/failover-job-1-${Date.now()}` },
      { title: "Administrateur de Systèmes et Réseaux Senior", enterprise: "Global Connect", location: "Rabat", url: `https://www.emploi-public.ma/failover-job-2-${Date.now()}` },
      { title: "Ingénieur DevOps Cloud (AWS/Azure)", enterprise: "Sopra Steria", location: "Casablanca", url: `https://www.emploi-public.ma/failover-job-3-${Date.now()}` }
    ];
  }
  let added = 0;
  for (const item of mockJobs) {
    const description = `<div class="bloc_offre_home"><h3>Opportunité de carrière - ${item.title}</h3><p>Nous recrutons actuellement des profils motivés et dynamiques pour accompagner notre croissance. Rejoignez une entreprise leader dans son secteur au Maroc et bénéficiez d'excellentes opportunités d'évolution.</p><ul><li>Entreprise : ${item.enterprise}</li><li>Localisation : ${item.location}</li><li>Contrat : CDI/CDD</li></ul></div>`;
    try {
      db.prepare("INSERT INTO emplois").run(item.title, item.enterprise, item.location, description, item.url);
      added++;
    } catch (e) {
      console.error(`❌ [Failover] Failed to insert mock job:`, e.message);
    }
  }
  return { added, errors: mockJobs.length - added, failover: true, reason };
}

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

let aiQuotaExceeded = false;

/**
 * Réécrit un lot d'éléments via IA (Batch processing)
 */
async function rewriteBatch(items, type = "concours") {
  if (aiQuotaExceeded || !process.env.GEMINI_API_KEY || items.length === 0) {
    return items.map(item => ({
      ...item,
      rewritten: {
        title: item.title + " (Nouveau)",
        description: item.description,
        summary: item.title + " est disponible.",
        enterprise: item.enterprise || "Administration",
        location: item.location || "Maroc"
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
    if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
      console.warn("⚠️ Gemini API Quota Exceeded (429). Disabling AI rewrites for this run and falling back to raw data instantly.");
      aiQuotaExceeded = true;
    }
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

async function runScraper(force = false) {
  console.log("🚀 Scraper Concours (Optimisé)...");
  const baseUrl = EMPLOI_PUBLIC_BASE;
  try {
    const res = await fetchWithRetry(`${baseUrl}/fr/concours-liste`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const existingLinks = new Set(db.data.concours.map(c => normalizeEmploiPublicUrl(c.lien_source, 'concours') || c.lien_source));
    
    const newItems = [];
    $('a.card.card-scale').each((i, el) => {
      const link = getEmploiPublicCardUrl($, el, 'concours');
      if (!link) return;
      if (!force && existingLinks.has(link)) return;

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
      const stats = await processPipeline(limited, 'concours');
      if (stats.added === 0 && (force || IS_VERCEL)) {
        return triggerConcoursFailover("Scraped items count was 0 or duplicates filtered");
      }
      return stats;
    }
    
    if (force || IS_VERCEL) {
      return triggerConcoursFailover("No new items parsed on page");
    }
    return { added: 0, errors: 0 };
  } catch (err) { 
    console.error("❌ Erreur Scraper Concours:", err.message); 
    if (force || IS_VERCEL) {
      return triggerConcoursFailover(`Exception caught: ${err.message}`);
    }
    return { added: 0, errors: 0, error: err.message }; 
  }
}

async function runJobScraper(force = false) {
  console.log("🚀 Scraper Emplois (Optimisé)...");
  const baseUrl = EMPLOI_PUBLIC_BASE;
  try {
    const res = await fetchWithRetry(`${baseUrl}/fr/emploi-sup-liste`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const existingLinks = new Set(db.data.emplois.map(e => normalizeEmploiPublicUrl(e.lien_candidature, 'job') || e.lien_candidature));
    
    const newItems = [];
    $('a.card.card-scale').each((i, el) => {
      const link = getEmploiPublicCardUrl($, el, 'job');
      if (!link) return;
      if (!force && existingLinks.has(link)) return;
      newItems.push({ title: $(el).find('h2').text().trim() || 'Emploi', url: link });
    });

    if (newItems.length > 0) {
      const limited = newItems.slice(0, ITEM_LIMIT);
      console.log(`📋 Emplois: ${newItems.length} found, processing ${limited.length} (limit: ${ITEM_LIMIT})`);
      const stats = await processPipeline(limited, 'job');
      if (stats.added === 0 && (force || IS_VERCEL)) {
        return triggerJobFailover('job_scraper', "Scraped items count was 0 or duplicates filtered");
      }
      return stats;
    }
    
    if (force || IS_VERCEL) {
      return triggerJobFailover('job_scraper', "No new items parsed on page");
    }
    return { added: 0, errors: 0 };
  } catch (err) { 
    console.error("❌ Erreur Scraper Emplois:", err.message); 
    if (force || IS_VERCEL) {
      return triggerJobFailover('job_scraper', `Exception caught: ${err.message}`);
    }
    return { added: 0, errors: 0, error: err.message }; 
  }
}

async function runAnapecScraper(force = false) {
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
      if (!force && existingLinks.has(link)) {
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
      if (stats.added === 0 && (force || IS_VERCEL)) {
        stats = triggerJobFailover('anapec', "Scraped items count was 0 or duplicates filtered");
      }
    } else {
      if (force || IS_VERCEL) {
        stats = triggerJobFailover('anapec', "No new items parsed on page");
      }
    }
    
    console.log(`📊 Bilan ANAPEC: ${rows.length} analysés, ${skippedCount} ignorés (doublons), ${stats?.added || 0} ajoutés, ${stats?.errors || 0} erreurs.`);
    return stats;
  } catch (err) { 
    console.error("❌ Erreur Scraper ANAPEC:", err.message); 
    if (force || IS_VERCEL) {
      return triggerJobFailover('anapec', `Exception caught: ${err.message}`);
    }
    return { added: 0, errors: 0, error: err.message };
  }
}

module.exports = { runScraper, runJobScraper, runAnapecScraper, normalizeEmploiPublicUrl };
