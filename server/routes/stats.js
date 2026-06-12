const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/stats (public)
// Async handler: always reads fresh data directly from MongoDB Atlas before computing
// any counts to avoid serving stale Vercel warm-container in-memory cache values.
router.get('/', async (req, res) => {
  try {
    await db.syncFromAtlas(); // Always read fresh data from Atlas, bypass warm-container RAM cache

    const totalConcours = db.prepare('SELECT COUNT(*) as count FROM concours').get().count;
    const totalEmplois  = db.prepare('SELECT COUNT(*) as count FROM emplois').get().count;
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
        vues: Math.max(100000, totalVuesConcours + totalVuesArticles)
      },
      concoursByMonth,
      topConcours,
      topArticles
    });
  } catch (err) {
    console.error('❌ Stats route error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

module.exports = router;
