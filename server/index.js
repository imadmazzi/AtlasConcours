require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const mongodbVersion = require('mongodb/package.json').version;
const dbReady = db.init().catch(err => {
  // Log but never crash the process — Vercel must stay alive to handle requests.
  console.error('⚠️ DB init warning (continuing with in-memory data):', err.message);
});

// Automatisation (Scraper)
const { initAutomation } = require('./automation');

let cronRouteActiveRun = null;
let cronRouteActiveRunStartedAt = null;

function cronLog(message, level = 'log') {
  const line = `${new Date().toISOString()} [CRON AUTOMATION] ${message}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/sitemap.xml', async (req, res) => {
  res.header('Content-Type', 'application/xml');
  res.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  
  const baseUrl = 'https://www.atlasconcours.com';
  
  // Base static URLs
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  const staticPages = ['', '/concours', '/jobs', '/blog'];
  for (const page of staticPages) {
    xml += `  <url>\n    <loc>${baseUrl}${page}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
  }
  
  const { isExpired } = require('./utils/dateParser');

  // Dynamic Concours (by ID)
  if (db.data.concours) {
    const activeConcours = db.data.concours.filter(c => !isExpired(c.date_limite));
    for (const c of activeConcours) {
      if (c.id) {
        xml += `  <url>\n    <loc>${baseUrl}/concours/${c.id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }
    }
  }

  // Dynamic Emplois (Jobs) (by ID)
  if (db.data.emplois) {
    const activeEmplois = db.data.emplois.filter(e => !isExpired(e.created_at || e.date_limite || e.deadline));
    for (const e of activeEmplois) {
      if (e.id) {
        xml += `  <url>\n    <loc>${baseUrl}/jobs/${e.id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }
    }
  }
  
  // Dynamic Articles (by slug)
  if (db.data.articles) {
    for (const a of db.data.articles) {
      if (a.slug) {
        xml += `  <url>\n    <loc>${baseUrl}/blog/${a.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
      }
    }
  }
  
  xml += '</urlset>';
  res.send(xml);
});

app.use('/api', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    await dbReady;
    await db.syncFromAtlas(); // Bypass Vercel warm-container RAM cache on every request
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/api/debug/wipe', async (req, res) => {
  try {
    if ((process.env.VERCEL || process.env.NODE_ENV === 'production') && !authorizePush(req)) {
      return res.status(401).json({ error: 'Unauthorized debug operation.' });
    }
    if (db.storageMode === 'mongodb') {
      await db.collection.deleteOne({ _id: 'main_db' });
      db.data = {
        concours: [],
        emplois: [],
        articles: [],
        store: {}
      };
      await db.save();
      return res.json({ success: true, message: "Wiped Vercel's MongoDB Atlas." });
    }
    res.json({ success: false, message: "Not in MongoDB mode." });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/debug/upload', async (req, res) => {
  try {
    if ((process.env.VERCEL || process.env.NODE_ENV === 'production') && !authorizePush(req)) {
      return res.status(401).json({ error: 'Unauthorized debug operation.' });
    }
    if (db.storageMode === 'mongodb') {
      if (!req.body || !req.body.emplois) return res.status(400).json({error: "Invalid payload"});
      db.data = req.body;
      await db.save();
      return res.json({ success: true, message: `Uploaded ${db.data.emplois.length} emplois and ${db.data.concours?.length || 0} concours.`});
    }
    res.json({ success: false, message: "Not in MongoDB mode." });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

function getPushToken() {
  return process.env.LOCAL_SCRAPE_PUSH_TOKEN || process.env.SCRAPE_PUSH_TOKEN || '';
}

function authorizePush(req) {
  const configuredToken = getPushToken();
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = req.headers['x-scrape-push-token'];

  return !!configuredToken && (bearerToken === configuredToken || headerToken === configuredToken);
}

function normalizePushedListings(rows, type) {
  const { sanitizeDescription } = require('./maintenance-sanitize-descriptions');
  const { isExpired, stripExpiredPrefix } = require('./utils/dateParser');

  return rows
    .filter(row => {
      // Drop expired items before they reach the database
      const deadline = String(row.date_limite || row.deadline || '').trim();
      if (isExpired(deadline)) {
        console.warn(`  ⏭️  push-scrape: dropping expired item "${String(row.titre || row.title || '').substring(0, 60)}" (deadline: ${deadline})`);
        return false;
      }
      // Drop items whose title is already poisoned with [Expiré]
      const title = String(row.titre || row.title || '');
      if (title.includes('[Expir')) {
        console.warn(`  ⏭️  push-scrape: dropping [Expiré]-titled item "${title.substring(0, 60)}"`);
        return false;
      }
      return true;
    })
    .map((row, index) => {
    if (type === 'concours') {
      return {
        id: Number(row.id) || index + 1,
        titre: stripExpiredPrefix(String(row.titre || row.title || 'Concours')).trim(),
        slug: String(row.slug || `concours-${Date.now()}-${index + 1}`).trim(),
        description: sanitizeDescription(row.description || ''),
        categorie: String(row.categorie || row.category || 'Concours').trim(),
        date_limite: String(row.date_limite || row.deadline || '').trim(),
        lien_source: String(row.lien_source || row.url || '').trim(),
        vues: Number(row.vues) || 0,
        created_at: row.created_at || new Date().toISOString(),
      };
    }

    return {
      id: Number(row.id) || index + 1,
      titre: stripExpiredPrefix(String(row.titre || row.title || "Offre d'emploi")).trim(),
      entreprise: String(row.entreprise || row.enterprise || 'Administration').trim(),
      localisation: String(row.localisation || row.location || 'Maroc').trim(),
      description: sanitizeDescription(row.description || ''),
      lien_candidature: String(row.lien_candidature || row.url || '').trim(),
      created_at: row.created_at || new Date().toISOString(),
    };
  });
}

// Secure local scrape bridge. Use this when Moroccan government sites reject
// cloud egress IPs: run the scraper on a domestic IP, then push sanitized rows.
app.post('/api/admin/push-scrape', async (req, res) => {
  try {
    if (!authorizePush(req)) {
      return res.status(401).json({ error: 'Unauthorized scrape push.' });
    }
    if (db.storageMode !== 'mongodb') {
      return res.status(503).json({ error: `MongoDB persistence required. Active mode: ${db.storageMode}` });
    }

    const emplois = Array.isArray(req.body?.emplois) ? req.body.emplois : null;
    const concours = Array.isArray(req.body?.concours) ? req.body.concours : null;
    const allowEmpty = req.body?.allowEmpty === true;

    if (!emplois && !concours) {
      return res.status(400).json({ error: 'Payload must include emplois and/or concours arrays.' });
    }
    if (!allowEmpty && ((emplois && emplois.length === 0) || (concours && concours.length === 0))) {
      return res.status(400).json({ error: 'Refusing to replace listings with an empty array unless allowEmpty=true.' });
    }

    if (emplois) {
      const normalized = normalizePushedListings(emplois, 'emplois');
      const existingUrls = new Set(db.data.emplois.map(e => e.lien_candidature));
      for (const item of normalized) {
        if (!existingUrls.has(item.lien_candidature)) {
          item.id = db.data.emplois.length > 0 ? Math.max(...db.data.emplois.map(e => Number(e.id) || 0)) + 1 : 1;
          db.data.emplois.push(item);
          existingUrls.add(item.lien_candidature);
        }
      }
    }
    
    if (concours) {
      const normalized = normalizePushedListings(concours, 'concours');
      const existingUrls = new Set(db.data.concours.map(c => c.lien_source));
      for (const item of normalized) {
        if (!existingUrls.has(item.lien_source)) {
          item.id = db.data.concours.length > 0 ? Math.max(...db.data.concours.map(c => Number(c.id) || 0)) + 1 : 1;
          db.data.concours.push(item);
          existingUrls.add(item.lien_source);
        }
      }
    }

    await db.save();
    await db.flush();

    res.json({
      success: true,
      storageMode: db.storageMode,
      records: {
        emplois: db.data.emplois.length,
        concours: db.data.concours.length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route Cron Vercel — runs scrapers sequentially and AWAITS completion before
// sending the response.  On Vercel, once res.send() is called the function is
// killed, so fire-and-forget promises never finish.  Running ONE source per
// cron invocation keeps us comfortably within the 10-second limit.
// The cron schedule can hit this endpoint 3× with ?source=anapec|jobs|concours,
// or once with no param to run all sequentially.
app.get('/api/cron-scraper', async (req, res) => {
  const startMs = Date.now();
  const source = (req.query.source || 'all').toLowerCase();
  const force = req.query.force === 'true';
  cronLog(`Vercel cron route woke up at ${new Date().toISOString()} (source=${source}, force=${force}).`);

  if (cronRouteActiveRun) {
    const activeForMs = startMs - cronRouteActiveRunStartedAt;
    cronLog(`Skipping Vercel cron run because another scraper run has been active for ${activeForMs}ms.`, 'warn');
    return res.status(202).json({
      status: 'skipped',
      reason: 'scraper pipeline already running',
      activeForMs,
      source,
    });
  }

  const { runAnapecScraper, runJobScraper, runScraper } = require('./scraper');
  const results = {};
  cronRouteActiveRunStartedAt = startMs;
  cronRouteActiveRun = true;

  try {
    if (db.storageMode !== 'mongodb') {
      throw new Error(`Production scraper requires MongoDB persistence. Active storage mode: ${db.storageMode}`);
    }

    if (source === 'anapec' || source === 'all') {
      cronLog('Starting Vercel anapec scraper.');
      results.anapec = await runAnapecScraper(force);
      cronLog(`Finished Vercel anapec scraper: ${JSON.stringify(results.anapec)}`);
    }
    if (source === 'jobs' || source === 'all') {
      cronLog('Starting Vercel jobs scraper.');
      results.jobs = await runJobScraper(force);
      cronLog(`Finished Vercel jobs scraper: ${JSON.stringify(results.jobs)}`);
    }
    if (source === 'concours' || source === 'all') {
      cronLog('Starting Vercel concours scraper.');
      results.concours = await runScraper(force);
      cronLog(`Finished Vercel concours scraper: ${JSON.stringify(results.concours)}`);
    }
    if (!['anapec', 'jobs', 'concours', 'all'].includes(source)) {
      throw new Error(`Unknown scraper source "${source}".`);
    }
    await db.flush();
  } catch (err) {
    cronLog(`Vercel cron scraper error: ${err.stack || err.message}`, 'error');
    results.error = err.message;
  } finally {
    cronRouteActiveRun = null;
    cronRouteActiveRunStartedAt = null;
  }

  const durationMs = Date.now() - startMs;
  cronLog(`Vercel cron route completed in ${durationMs}ms (source=${source}).`);

  res.status(results.error ? 500 : 200).json({
    status: results.error ? 'error' : 'success',
    durationMs,
    source,
    results
  });
});

// Health & DB Diagnostics
app.get('/api/health', (req, res) => {
  const mongoConfigured = !!process.env.MONGODB_URI;
  const storageMode = db.storageMode || 'unknown';

  if (process.env.VERCEL && !mongoConfigured) {
    return res.status(200).json({
      status: 'degraded',
      storageMode,
      persistent: false,
      warning: 'MONGODB_URI is not set. Data will not persist between serverless invocations.',
      action: 'Go to Vercel Dashboard → Settings → Environment Variables and add MONGODB_URI with your MongoDB Atlas connection string.'
    });
  }

  res.status(200).json({
    status: 'ok',
    storageMode,
    persistent: storageMode === 'mongodb',
    mongoConfigured,
    lastMongoError: db.lastMongoError,
    runtime: {
      node: process.version,
      mongodb: mongodbVersion
    },
    records: {
      concours: db.data.concours?.length || 0,
      emplois: db.data.emplois?.length || 0,
      articles: db.data.articles?.length || 0
    }
  });
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/concours', require('./routes/concours'));
app.use('/api/emplois', require('./routes/emplois'));
app.use('/api/jobs', require('./routes/emplois'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/chat', require('./routes/chat'));


// Redirect legacy .html pages to React routes
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/emplois.html', (req, res) => res.redirect(301, '/jobs'));
app.get('/concours.html', (req, res) => res.redirect(301, '/concours'));
app.get('/blog.html', (req, res) => res.redirect(301, '/blog'));

// Admin Redirects
app.get('/admin/dashboard.html', (req, res) => res.redirect(301, '/admin/dashboard'));
app.get('/admin/concours.html', (req, res) => res.redirect(301, '/admin/concours'));
app.get('/admin/emplois.html', (req, res) => res.redirect(301, '/admin/emplois'));

// SPA Fallback: Servir index.html pour toutes les autres routes (React Router)
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// In Vercel serverless, just init the DB and export the app.
// app.listen() and cron scheduling only run in a persistent Node process (local dev / Railway).
dbReady.then(() => {
  if (!process.env.VERCEL) {
    initAutomation();
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    });
  } else {
    console.log('☁️ Vercel serverless mode — skipping app.listen and cron init.');
  }
});

module.exports = app;
