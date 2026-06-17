const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const db = require('./db');
const slugify = require('slugify');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { broadcastConcours, broadcastEmploi } = require('./services/telegramService');
const { isExpired, parseDateLimite } = require('./utils/dateParser');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "VOTRE_CLE_API");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ─── Serverless-aware constants ─────────────────────────────────────────────
const IS_VERCEL      = !!process.env.VERCEL;
const ITEM_LIMIT     = IS_VERCEL ? 100 : 500;  // max items per source per run
const MAX_PAGES      = IS_VERCEL ? 30 : 30;    // max pages to scrape per source
const FETCH_TIMEOUT  = Number(process.env.SCRAPER_FETCH_TIMEOUT_MS) || 20000;
const AI_REWRITE_TIMEOUT = Number(process.env.SCRAPER_AI_TIMEOUT_MS) || 15000;
const RETRY_COUNT    = IS_VERCEL ? 1  : 2;
const RETRY_DELAY    = IS_VERCEL ? 500 : 2000;
const BATCH_DELAY    = IS_VERCEL ? 0   : 2000; // inter-batch sleep (ms)
const REWRITE_BATCH  = IS_VERCEL ? 1   : 3;    // items per AI rewrite call
const EMPLOI_PUBLIC_BASE = "https://www.emploi-public.ma";
const EMPLOI_PUBLIC_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMPLOI_PUBLIC_KIND_RE = /\/(fr|ar)\/(concours|emploi-sup)\/details\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const SCRAPER_PROXY_URL = process.env.SCRAPER_PROXY_URL || '';
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || '';
const SCRAPINGBEE_COUNTRY_CODE = process.env.SCRAPINGBEE_COUNTRY_CODE || 'ma';
const SCRAPINGBEE_PREMIUM_PROXY = process.env.SCRAPINGBEE_PREMIUM_PROXY !== 'false';

function getStandardProxyConfig() {
  if (!SCRAPER_PROXY_URL) return null;

  try {
    const parsed = new URL(SCRAPER_PROXY_URL);
    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
      auth: parsed.username ? {
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password || ''),
      } : undefined,
    };
  } catch (err) {
    console.warn(`Invalid SCRAPER_PROXY_URL ignored: ${err.message}`);
    return null;
  }
}

function buildScrapingBeeUrl(targetUrl) {
  const apiUrl = new URL('https://app.scrapingbee.com/api/v1/');
  apiUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
  apiUrl.searchParams.set('url', targetUrl);
  apiUrl.searchParams.set('render_js', 'false');
  apiUrl.searchParams.set('block_resources', 'true');
  apiUrl.searchParams.set('transparent_status_code', 'true');
  apiUrl.searchParams.set('timeout', String(Math.max(FETCH_TIMEOUT, 20000)));

  if (SCRAPINGBEE_PREMIUM_PROXY) {
    apiUrl.searchParams.set('premium_proxy', 'true');
    apiUrl.searchParams.set('country_code', SCRAPINGBEE_COUNTRY_CODE);
  }

  return apiUrl.toString();
}

function buildScraperRequest(url, options = {}) {
  const config = {
    ...options,
    timeout: options.timeout || FETCH_TIMEOUT,
  };

  if (SCRAPINGBEE_API_KEY) {
    return {
      url: buildScrapingBeeUrl(url),
      config: {
        ...config,
        proxy: false,
        httpsAgent,
      },
      via: 'scrapingbee',
    };
  }

  const proxy = getStandardProxyConfig();
  if (proxy) {
    config.proxy = proxy;
  }

  return { url, config, via: proxy ? 'proxy' : 'direct' };
}

async function scraperGet(url, options = {}) {
  const request = buildScraperRequest(url, options);
  return axios.get(request.url, request.config);
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

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

function isEmploiPublic404Page(html) {
  const body = String(html || '');
  return /\b404\b|Erreur\s*404|Page\s+introuvable|not\s+found/i.test(body);
}

function isEmploiPublicDetailPage(html) {
  const body = String(html || '');
  return /tail de l'annonce|Description/i.test(body);
}

async function validateEmploiPublicUrl(url) {
  try {
    const res = await scraperGet(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      httpsAgent,
      maxRedirects: 5,
      timeout: Math.min(FETCH_TIMEOUT, IS_VERCEL ? 15000 : 8000),
      validateStatus: () => true,
    });

    const finalUrl = SCRAPINGBEE_API_KEY ? url : (res.request?.res?.responseUrl || url);
    if (res.status === 404 || res.status >= 500) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }
    if (!finalUrl.includes('/details/')) {
      return { ok: false, reason: `redirected to ${finalUrl}` };
    }
    if (!isEmploiPublicDetailPage(res.data)) {
      return { ok: false, reason: 'missing detail page markers' };
    }
    if (isEmploiPublic404Page(res.data)) {
      return { ok: false, reason: 'official 404 page' };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function validatedEmploiPublicItems(items, limit, label) {
  const valid = [];
  let skipped = 0;

  for (const item of items) {
    if (valid.length >= limit) break;

    const check = await validateEmploiPublicUrl(item.url);
    if (!check.ok) {
      skipped++;
      console.warn(`  ⚠️ Skipping dead Emploi-Public ${label}: ${item.url} (${check.reason})`);
      continue;
    }

    valid.push(item);
  }

  return { valid, skipped };
}
// ────────────────────────────────────────────────────────────────────────────

/**
 * Failover injection: dynamic mock concours data
 */
function triggerConcoursFailover(reason = "No items found") {
  console.warn(`🚨 [Failover] Triggering Concours failover insertion (Reason: ${reason})`);
  const mockConcours = [
    { title: "Concours Ministère de l'Intérieur 2026", deadline: "2026-06-30", url: `https://www.emploi-public.ma/fr/concours/details/aaaaaaaa-0000-4444-0000-111111111111` },
    { title: "Concours de Recrutement Gendarmerie Royale", deadline: "2026-07-15", url: `https://www.emploi-public.ma/fr/concours/details/bbbbbbbb-0000-4444-0000-222222222222` },
    { title: "Recrutement Ministère de la Santé (Médecins/Infirmiers)", deadline: "2026-08-10", url: `https://www.emploi-public.ma/fr/concours/details/cccccccc-0000-4444-0000-333333333333` }
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
      { title: "Administrateur de Systèmes et Réseaux Senior", enterprise: "Global Connect", location: "Rabat", url: `https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/detail_offre/1000${Date.now()}` },
      { title: "Développeur Fullstack React/Node - Casablanca", enterprise: "TechCorp Morocco", location: "Casablanca", url: `https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/detail_offre/2000${Date.now()}` },
      { title: "Ingénieur DevOps Cloud (AWS/Azure)", enterprise: "Sopra Steria", location: "Casablanca", url: `https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/detail_offre/3000${Date.now()}` }
    ];
  } else {
    mockJobs = [
      { title: "Administrateur de 2ème grade", enterprise: "Ministère de la Transition Numérique", location: "Rabat", url: `https://www.emploi-public.ma/fr/emploi-sup/details/dddddddd-1111-4444-1111-444444444444` },
      { title: "Ingénieur d'Etat de 1er grade", enterprise: "Ministère de l'Equipement et de l'Eau", location: "Casablanca", url: `https://www.emploi-public.ma/fr/emploi-sup/details/eeeeeeee-2222-4444-2222-555555555555` },
      { title: "Technicien de 3ème grade", enterprise: "Ministère de l'Intérieur", location: "Rabat", url: `https://www.emploi-public.ma/fr/emploi-sup/details/ffffffff-3333-4444-3333-666666666666` }
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
      return await scraperGet(url, { ...options, timeout: FETCH_TIMEOUT });
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
    const result = await withTimeout(
      model.generateContent(prompt),
      AI_REWRITE_TIMEOUT,
      'Gemini rewrite request'
    );
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
 * On success, fires a non-blocking Telegram broadcast to the channel.
 * ONLY fires for brand-new inserts — the caller already guards against duplicates.
 * Returns true on success, false on error.
 */
function insertItemNow(item, type) {
  const safeTitle       = item.rewritten?.title       || item.title       || 'Sans titre';
  const safeDescription = item.rewritten?.description || item.description || 'Détails non disponibles.';
  const safeEnterprise  = item.rewritten?.enterprise  || item.enterprise  || 'Administration';
  const safeLocation    = item.rewritten?.location    || item.location    || 'Maroc';
  const safeDeadline    = item.deadline || '';
  const safeUrl         = item.url || '';
  const safeImageUrl    = item.imageUrl || '';

  // ── Hard expiry guard ────────────────────────────────────────────────────
  // Never insert an already-expired listing, regardless of how it got here.
  if (safeDeadline && isExpired(safeDeadline)) {
    console.warn(`  ⏭️  Skipping EXPIRED ${type}: "${safeTitle.substring(0, 60)}" (deadline: ${safeDeadline})`);
    return false;
  }

  try {
    if (type === 'concours') {
      const slug = slugify(safeTitle, { lower: true, strict: true, locale: 'fr' }) + '-' + Date.now();
      const result = db.prepare("INSERT INTO concours").run(safeTitle, slug, safeDescription, "Concours", safeDeadline, safeUrl, safeImageUrl);

      // ── Telegram broadcast (fire-and-forget) ─────────────────────────────
      // Retrieve the freshly created record by its auto-assigned ID so the message
      // contains the real DB id for the clickable deep-link.
      // Any Telegram failure is silently caught; it NEVER crashes the cron cycle.
      const newId = result && result.lastInsertRowid;
      if (newId) {
        const newRecord = db.data.concours.find(c => c.id == newId);
        if (newRecord) {
          broadcastConcours(newRecord).catch(err =>
            console.error('❌ [Telegram] broadcastConcours error (ignored):', err.message)
          );
        }
      }
    } else {
      const result = db.prepare("INSERT INTO emplois").run(safeTitle, safeEnterprise, safeLocation, safeDescription, safeUrl, safeImageUrl);

      // ── Telegram broadcast (fire-and-forget) ─────────────────────────────
      const newId = result && result.lastInsertRowid;
      if (newId) {
        const newRecord = db.data.emplois.find(e => e.id == newId);
        if (newRecord) {
          broadcastEmploi(newRecord).catch(err =>
            console.error('❌ [Telegram] broadcastEmploi error (ignored):', err.message)
          );
        }
      }
    }
    console.log(`  💾 Inserted: ${safeTitle.substring(0, 60)}…`);
    return true;
  } catch (insertErr) {
    console.error(`  ❌ Insert failed (${safeTitle.substring(0, 40)}):`, insertErr.message);
    return false;
  }
}

/**
 * Extract strictly the description and strip out any noisy layout strings
 */
function extractCleanHtml($) {
  // Target only specific detail containers first, not the whole body
  let el = $('.offres-details').length ? $('.offres-details') 
         : $('.detail-offre').length ? $('.detail-offre')
         : $('.bloc_offre_home').length ? $('.bloc_offre_home')
         : $('.detail-content').length ? $('.detail-content')
         : $('.card-body').length ? $('.card-body')
         : $('article.detail').length ? $('article.detail')
         : $('.detail-annonce').length ? $('.detail-annonce')
         : null;
         
  if (!el) {
    // Fallback if no container matched, but strip all known layout noise first
    ['nav', 'header', 'footer', '.navbar', '.sidebar', '.loader-d',
     '#accessPanel', '.rs_addtools', 'script', 'style', 'iframe', '.breadcrumb',
     '.pagination', 'form', 'input', 'button', '.login'
    ].forEach(s => $(s).remove());
    el = $('body');
  } else {
    // Even within the container, strip internal noise
    ['nav', 'header', 'footer', '.navbar', '.breadcrumb', '.pagination',
     '.loader-d', '#accessPanel', '.rs_addtools', 'script', 'style', 'iframe',
     'form', 'input', 'button', '.login'
    ].forEach(s => el.find(s).remove());
  }

  let html = el.html() || '';
  if (!html.trim()) return "Détails non disponibles.";

  // Strip accessibility injected strings that ruin layout
  html = html.replace(/front_office\.accessibilite[a-zA-Z0-9_]*/gi, '');
  
  return html.trim();
}

async function downloadBase64Image(url) {
  if (!url) return '';
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000, httpsAgent, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buffer = Buffer.from(res.data, 'binary');
    const mime = res.headers['content-type'] || 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.warn(`⚠️ Failed to fetch image ${url}:`, err.message);
    return url;
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
      item.description = extractCleanHtml($);
    } catch (err) {
      item.description = "Détails non disponibles.";
    }

    if (item.imageUrl && item.imageUrl.startsWith('http')) {
      item.imageUrl = await downloadBase64Image(item.imageUrl);
    }

    // 2. Collect a micro-batch for AI rewrite (1 on Vercel, up to REWRITE_BATCH locally)
    const microBatch = [item];
    while (microBatch.length < REWRITE_BATCH && i + 1 < items.length) {
      i++;
      const next = items[i];
      try {
        const res = await fetchWithRetry(next.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, httpsAgent });
        const $ = cheerio.load(res.data);
        next.description = extractCleanHtml($);
      } catch (err) {
        next.description = "Détails non disponibles.";
      }
      if (next.imageUrl && next.imageUrl.startsWith('http')) {
        next.imageUrl = await downloadBase64Image(next.imageUrl);
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
  console.log("🚀 Scraper Concours (Optimisé + Pagination)...");
  const baseUrl = EMPLOI_PUBLIC_BASE;
  try {
    const existingLinks = new Set(db.data.concours.map(c => normalizeEmploiPublicUrl(c.lien_source, 'concours') || c.lien_source));
    const allNewItems = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      if (allNewItems.length >= ITEM_LIMIT) break;

      const pageUrl = page === 1
        ? `${baseUrl}/fr/concours-liste`
        : `${baseUrl}/fr/concours-liste?page=${page}`;
      console.log(`  📄 Concours page ${page}/${MAX_PAGES}: ${pageUrl}`);

      let $;
      try {
        const res = await fetchWithRetry(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        $ = cheerio.load(res.data);
      } catch (pageErr) {
        console.warn(`  ⚠️ Concours page ${page} fetch failed: ${pageErr.message}`);
        break;
      }

      let pageItemCount = 0;
      $('a.card.card-scale').each((i, el) => {
        if (allNewItems.length >= ITEM_LIMIT) return false;
        const link = getEmploiPublicCardUrl($, el, 'concours');
        if (!link) return;
        if (!force && existingLinks.has(link)) return;
        // Also skip if we already collected this link in a previous page
        if (allNewItems.some(item => item.url === link)) return;

        const title = $(el).find('h2').text().trim() || $(el).find('.card-title').text().trim() || 'Concours';
        let imageUrl = $(el).find('img').attr('src') || '';
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `${EMPLOI_PUBLIC_BASE}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }
        let deadline = "";
        $(el).find('div, span, p').each((j, sel) => {
          if ($(sel).text().includes("Limite")) deadline = $(sel).text().split(':')[1]?.trim() || "";
        });

        // ── Skip expired concours immediately at scrape time ─────────────
        if (deadline && isExpired(deadline)) {
          console.log(`  ⏭️  Skipping expired concours: "${title.substring(0, 60)}" (deadline: ${deadline})`);
          return;
        }

        allNewItems.push({ title, url: link, deadline, imageUrl });
        pageItemCount++;
      });

      console.log(`    → Found ${pageItemCount} new concours on page ${page}`);
      // If no cards found on this page, stop paginating (last page reached)
      if (pageItemCount === 0 && $('a.card.card-scale').length === 0) break;

      // Small delay between pages to be polite
      if (page < MAX_PAGES && allNewItems.length < ITEM_LIMIT) {
        await new Promise(r => setTimeout(r, IS_VERCEL ? 300 : 1000));
      }
    }

    if (allNewItems.length > 0) {
      const { valid: limited, skipped } = await validatedEmploiPublicItems(allNewItems, ITEM_LIMIT, 'concours');
      console.log(`📋 Concours: ${allNewItems.length} found across pages, processing ${limited.length} (limit: ${ITEM_LIMIT})`);
      console.log(`Emploi-Public concours validation: ${skipped} dead skipped, ${limited.length} live kept.`);
      if (limited.length === 0) {
        return { added: 0, errors: 0, skipped, reason: 'No live Emploi-Public concours detail URLs' };
      }
      const stats = await processPipeline(limited, 'concours');
      if (stats.added === 0 && (force || IS_VERCEL)) {
        return { ...stats, skipped, reason: "No live Emploi-Public concours inserted" };
      }
      return { ...stats, skipped };
    }
    
    if (force || IS_VERCEL) {
      return { added: 0, errors: 0, skipped: 0, reason: "No new Emploi-Public concours parsed on pages" };
    }
    return { added: 0, errors: 0 };
  } catch (err) { 
    console.error("❌ Erreur Scraper Concours:", err.message); 
    if (force || IS_VERCEL) {
        return { added: 0, errors: 0, error: err.message };
    }
    return { added: 0, errors: 0, error: err.message }; 
  }
}

async function runJobScraper(force = false) {
  console.log("🚀 Scraper Emplois (Optimisé + Pagination)...");
  const baseUrl = EMPLOI_PUBLIC_BASE;
  try {
    const existingLinks = new Set(db.data.emplois.map(e => normalizeEmploiPublicUrl(e.lien_candidature, 'job') || e.lien_candidature));
    const allNewItems = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      if (allNewItems.length >= ITEM_LIMIT) break;

      const pageUrl = page === 1
        ? `${baseUrl}/fr/emploi-sup-liste`
        : `${baseUrl}/fr/emploi-sup-liste?page=${page}`;
      console.log(`  📄 Emplois page ${page}/${MAX_PAGES}: ${pageUrl}`);

      let $;
      try {
        const res = await fetchWithRetry(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        $ = cheerio.load(res.data);
      } catch (pageErr) {
        console.warn(`  ⚠️ Emplois page ${page} fetch failed: ${pageErr.message}`);
        break;
      }

      let pageItemCount = 0;
      $('a.card.card-scale').each((i, el) => {
        if (allNewItems.length >= ITEM_LIMIT) return false;
        const link = getEmploiPublicCardUrl($, el, 'job');
        if (!link) return;
        if (!force && existingLinks.has(link)) return;
        if (allNewItems.some(item => item.url === link)) return;

        let imageUrl = $(el).find('img').attr('src') || '';
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `${EMPLOI_PUBLIC_BASE}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }
        // Extract deadline from card if present and skip expired emplois
        let jobDeadline = "";
        $(el).find('div, span, p').each((j, sel) => {
          if ($(sel).text().includes("Limite")) jobDeadline = $(sel).text().split(':')[1]?.trim() || "";
        });
        if (jobDeadline && isExpired(jobDeadline)) {
          console.log(`  ⏭️  Skipping expired emploi: "${$(el).find('h2').text().trim().substring(0, 60)}" (deadline: ${jobDeadline})`);
          return;
        }
        allNewItems.push({ title: $(el).find('h2').text().trim() || 'Emploi', url: link, deadline: jobDeadline, imageUrl });
        pageItemCount++;
      });

      console.log(`    → Found ${pageItemCount} new emplois on page ${page}`);
      if (pageItemCount === 0 && $('a.card.card-scale').length === 0) break;

      if (page < MAX_PAGES && allNewItems.length < ITEM_LIMIT) {
        await new Promise(r => setTimeout(r, IS_VERCEL ? 300 : 1000));
      }
    }

    if (allNewItems.length > 0) {
      const { valid: limited, skipped } = await validatedEmploiPublicItems(allNewItems, ITEM_LIMIT, 'job');
      console.log(`📋 Emplois: ${allNewItems.length} found across pages, processing ${limited.length} (limit: ${ITEM_LIMIT})`);
      console.log(`Emploi-Public job validation: ${skipped} dead skipped, ${limited.length} live kept.`);
      if (limited.length === 0) {
        return { added: 0, errors: 0, skipped, reason: 'No live Emploi-Public job detail URLs' };
      }
      const stats = await processPipeline(limited, 'job');
      if (stats.added === 0 && (force || IS_VERCEL)) {
        return { ...stats, skipped, reason: "No live Emploi-Public jobs inserted" };
      }
      return { ...stats, skipped };
    }
    
    if (force || IS_VERCEL) {
      return { added: 0, errors: 0, skipped: 0, reason: "No new Emploi-Public jobs parsed on pages" };
    }
    return { added: 0, errors: 0 };
  } catch (err) { 
    console.error("❌ Erreur Scraper Emplois:", err.message); 
    if (force || IS_VERCEL) {
      return { added: 0, errors: 0, error: err.message };
    }
    return { added: 0, errors: 0, error: err.message }; 
  }
}

async function runAnapecScraper(force = false) {
  console.log("🚀 Scraper ANAPEC (Optimisé + Pagination)...");
  const baseUrl = "https://www.anapec.org";
  try {
    const existingLinks = new Set(db.data.emplois.map(e => e.lien_candidature));
    const allNewItems = [];
    let totalSkippedCount = 0;
    let totalRowsAnalyzed = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      if (allNewItems.length >= ITEM_LIMIT) break;

      // ANAPEC uses /page:<n> suffix for pagination
      const pageUrl = page === 1
        ? `${baseUrl}/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all`
        : `${baseUrl}/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all/page:${page}`;
      console.log(`  📄 ANAPEC page ${page}/${MAX_PAGES}: ${pageUrl}`);

      let $;
      try {
        const res = await fetchWithRetry(pageUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0' }, httpsAgent 
        });
        $ = cheerio.load(res.data);
      } catch (pageErr) {
        console.warn(`  ⚠️ ANAPEC page ${page} fetch failed: ${pageErr.message}`);
        break;
      }

      const rows = $('table tr').slice(1);
      totalRowsAnalyzed += rows.length;
      if (rows.length === 0) {
        console.log(`    → No rows on page ${page}, stopping pagination.`);
        break;
      }

      let pageItemCount = 0;
      rows.each((i, el) => {
        if (allNewItems.length >= ITEM_LIMIT) return false;
        const linkEl = $(el).find('a.nyroModal');
        if (!linkEl.length) return;
        const href = linkEl.attr('href') || '';
        if (!href) return;

        const idMatch = href.match(/\/(\d{5,})\//);
        if (!idMatch) return; // skip rows with no valid job ID
        const jobId = idMatch[1];
        const link = `${baseUrl}/sigec-app-rv/fr/entreprises/bloc_offre_home/${jobId}/resultat_recherche`;

        if (!force && existingLinks.has(link)) {
          totalSkippedCount++;
          return;
        }
        // Also skip if already collected from a previous page
        if (allNewItems.some(item => item.url === link)) return;

        const tds = $(el).find('td');
        const reference = tds.length > 1 ? tds.eq(1).text().trim() : '';      // e.g. "ET2305261125170"
        const titre     = tds.length > 3 ? tds.eq(3).text().trim().replace(/\s+/g, ' ') : ''; // e.g. "Technicien automaticien"
        const enterprise = tds.length > 1 ? tds.eq(1).text().trim() || 'Administration' : 'Administration';
        const location   = tds.length > 6 ? tds.eq(6).text().trim() || 'Maroc' : (tds.length > 2 ? tds.eq(2).text().trim() || 'Maroc' : 'Maroc');
        const title = titre || reference || "Offre d'emploi ANAPEC";

        allNewItems.push({ title, url: link, enterprise, location, reference });
        pageItemCount++;
      });

      console.log(`    → Found ${pageItemCount} new ANAPEC jobs on page ${page}`);

      // Small delay between pages to be polite
      if (page < MAX_PAGES && allNewItems.length < ITEM_LIMIT) {
        await new Promise(r => setTimeout(r, IS_VERCEL ? 300 : 1000));
      }
    }

    let stats = { added: 0, errors: 0 };
    if (allNewItems.length > 0) {
      const limited = allNewItems.slice(0, ITEM_LIMIT);
      console.log(`📋 ANAPEC: ${allNewItems.length} found across pages, processing ${limited.length} (limit: ${ITEM_LIMIT})`);
      stats = await processPipeline(limited, 'job');
      if (stats.added === 0 && (force || IS_VERCEL)) {
        // Fallback disabled: We skip fake entries instead of inserting them.
      }
    } else {
      if (force || IS_VERCEL) {
        // Fallback disabled: No new items parsed on pages, skipping failover.
      }
    }
    
    console.log(`📊 Bilan ANAPEC: ${totalRowsAnalyzed} analysés, ${totalSkippedCount} ignorés (doublons), ${stats?.added || 0} ajoutés, ${stats?.errors || 0} erreurs.`);
    return stats;
  } catch (err) { 
    console.error("❌ Erreur Scraper ANAPEC:", err.message); 
    if (force || IS_VERCEL) {
      return { added: 0, errors: 0, error: err.message };
    }
    return { added: 0, errors: 0, error: err.message };
  }
}

module.exports = { runScraper, runJobScraper, runAnapecScraper, normalizeEmploiPublicUrl, validateEmploiPublicUrl };
