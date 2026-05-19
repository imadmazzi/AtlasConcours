const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const db = require('./db');
const slugify = require('slugify');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "VOTRE_CLE_API");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Helper: Requête avec mécanisme de retry
 */
async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, { ...options, timeout: 15000 });
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`⚠️ Retrying (${i + 1}/${retries}) for ${url}...`);
      await new Promise(r => setTimeout(r, 2000));
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
 * Pipeline de traitement commun
 */
async function processPipeline(items, type) {
  console.log(`⚙️ Traitement de ${items.length} nouveaux éléments (${type})...`);
  let addedCount = 0;
  let errorCount = 0;
  
  // 1. Fetch des détails en parallèle (limité par lot de 5)
  const processed = [];
  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5);
    const detailedBatch = await Promise.all(batch.map(async (item) => {
      try {
        const res = await fetchWithRetry(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, httpsAgent });
        const $ = cheerio.load(res.data);
        const description = $('.bloc_offre_home').html() || $('.detail-content').html() || $('.card-body').html() || $.html() || "Détails non disponibles.";
        return { ...item, description: description.trim() };
      } catch (err) {
        return { ...item, description: "Détails non disponibles." };
      }
    }));
    processed.push(...detailedBatch);
    await new Promise(r => setTimeout(r, 1000));
  }

  // 2. Réécriture par lots de 3
  for (let i = 0; i < processed.length; i += 3) {
    const batch = processed.slice(i, i + 3);
    const rewrittenBatch = await rewriteBatch(batch, type);
    
    for (const item of rewrittenBatch) {
      if (!item.rewritten) {
        errorCount++;
        console.warn(`⚠️ API Fallback activé pour: ${item.title}`);
        item.rewritten = {
          title: item.title,
          description: item.description || "Détails non disponibles.",
          enterprise: item.enterprise || "Administration",
          location: item.location || "Maroc"
        };
      }
      
      if (type === 'concours') {
        const slug = slugify(item.rewritten.title, { lower: true, strict: true, locale: 'fr' }) + '-' + Date.now();
        db.prepare("INSERT INTO concours").run(item.rewritten.title, slug, item.rewritten.description, "Concours", item.deadline, item.url);
      } else {
        db.prepare("INSERT INTO emplois").run(
          item.rewritten.title,
          item.rewritten.enterprise || "Administration",
          item.rewritten.location || "Maroc",
          item.rewritten.description,
          item.url
        );
      }
      addedCount++;
    }
    console.log(`✅ Lot de ${batch.length} inséré.`);
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000)); // random delay 2-4s
  }
  
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
      const link = baseUrl + $(el).attr('href');
      if (existingLinks.has(link)) return;
      
      const title = $(el).find('h2').text().trim() || $(el).find('.card-title').text().trim();
      let deadline = "";
      $(el).find('div, span, p').each((j, sel) => {
        if ($(sel).text().includes("Limite")) deadline = $(sel).text().split(':')[1]?.trim() || "";
      });
      
      newItems.push({ title, url: link, deadline });
    });

    if (newItems.length > 0) await processPipeline(newItems.slice(0, 10), 'concours');
  } catch (err) { console.error("❌ Erreur Scraper Concours:", err.message); }
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
      const link = baseUrl + $(el).attr('href');
      if (existingLinks.has(link)) return;
      newItems.push({ title: $(el).find('h2').text().trim(), url: link });
    });

    if (newItems.length > 0) await processPipeline(newItems.slice(0, 10), 'job');
  } catch (err) { console.error("❌ Erreur Scraper Emplois:", err.message); }
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
      const link = baseUrl + linkEl.attr('href');
      if (existingLinks.has(link)) {
        skippedCount++;
        return;
      }
      const tds = $(el).find('td');
      const enterprise = tds.length > 1 ? tds.eq(1).text().trim() : "Administration";
      const location = tds.length > 2 ? tds.eq(2).text().trim() : "Maroc";
      
      newItems.push({ 
        title: linkEl.text().trim().replace(/\s+/g, ' '), 
        url: link,
        enterprise,
        location
      });
    });

    let stats = { added: 0, errors: 0 };
    if (newItems.length > 0) {
      stats = await processPipeline(newItems.slice(0, 15), 'job');
    }
    
    console.log(`📊 Bilan ANAPEC: ${rows.length} analysés, ${skippedCount} ignorés (doublons), ${stats?.added || 0} ajoutés, ${stats?.errors || 0} erreurs.`);
  } catch (err) { 
    console.error("❌ Erreur Scraper ANAPEC:", err.message); 
  }
}

module.exports = { runScraper, runJobScraper, runAnapecScraper };

