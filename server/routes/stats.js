const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/stats (public)
router.get('/', (req, res) => {
  const totalConcours = db.prepare('SELECT COUNT(*) as count FROM concours').get().count;
  const totalEmplois = db.prepare('SELECT COUNT(*) as count FROM emplois').get().count;
  const totalArticles = db.prepare('SELECT COUNT(*) as count FROM articles').get().count;
  const totalVuesConcours = db.prepare('SELECT SUM(vues) as total FROM concours').get().total || 0;
  const totalVuesArticles = db.prepare('SELECT SUM(vues) as total FROM articles').get().total || 0;

  const concoursByMonth = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as mois, COUNT(*) as count
    FROM concours
    GROUP BY mois
    ORDER BY mois DESC
    LIMIT 12
  `).all();

  const topConcours = db.prepare('SELECT titre, slug, vues FROM concours ORDER BY vues DESC LIMIT 5').all();
  const topArticles = db.prepare('SELECT titre, slug, vues FROM articles ORDER BY vues DESC LIMIT 5').all();

  res.json({
    totaux: {
      concours: totalConcours,
      emplois: totalEmplois,
      articles: totalArticles,
      vues: totalVuesConcours + totalVuesArticles
    },
    concoursByMonth,
    topConcours,
    topArticles
  });
});

module.exports = router;
