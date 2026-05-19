require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Automatisation (Scraper)
const { initAutomation } = require('./automation');

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../public')));

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

db.init().then(() => {
  // Initialiser les tâches automatisées après le chargement de la BD
  initAutomation();

  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Échec critique de l\'initialisation de la base de données :', err);
  process.exit(1);
});

module.exports = app;
