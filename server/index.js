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

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    next(err);
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
  console.log('⏰ [Vercel Cron] Triggered cron-scraper route...');
  const { runAnapecScraper, runJobScraper, runScraper } = require('./scraper');
  const source = (req.query.source || 'all').toLowerCase();
  const force = req.query.force === 'true';

  const results = {};
  try {
    if (db.storageMode !== 'mongodb') {
      throw new Error(`Production scraper requires MongoDB persistence. Active storage mode: ${db.storageMode}`);
    }

    if (source === 'anapec' || source === 'all') {
      results.anapec = await runAnapecScraper(force);
    }
    if (source === 'jobs' || source === 'all') {
      results.jobs = await runJobScraper(force);
    }
    if (source === 'concours' || source === 'all') {
      results.concours = await runScraper(force);
    }
    await db.flush();
  } catch (err) {
    console.error('❌ [Vercel Cron] Scraper error:', err.message);
    results.error = err.message;
  }

  const durationMs = Date.now() - startMs;
  console.log(`⏰ [Vercel Cron] Completed in ${durationMs}ms`);

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

// Sitemap dynamique
app.get('/sitemap.xml', (req, res) => {
  const db = require('./db');
  const concours = db.prepare('SELECT slug, created_at FROM concours').all();
  const articles = db.prepare('SELECT slug, created_at FROM articles').all();
  const baseUrl = 'https://atlasconcours.ma';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${baseUrl}/concours.html</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${baseUrl}/emplois.html</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/blog.html</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`;

  concours.forEach(c => {
    xml += `\n  <url><loc>${baseUrl}/concours-detail.html?slug=${c.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${c.created_at.slice(0,10)}</lastmod></url>`;
  });
  articles.forEach(a => {
    xml += `\n  <url><loc>${baseUrl}/article-detail.html?slug=${a.slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority><lastmod>${a.created_at.slice(0,10)}</lastmod></url>`;
  });

  xml += `\n</urlset>`;
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://atlasconcours.ma/sitemap.xml`);
});

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
