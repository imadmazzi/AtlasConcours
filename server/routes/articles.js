const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const slugify = require('slugify');

// GET /api/articles
router.get('/', (req, res) => {
  const { page = 1, limit = 9, tags, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];

  if (tags) {
    where += ' AND LOWER(tags) LIKE ?';
    params.push(`%${tags.toLowerCase()}%`);
  }
  if (search) {
    where += ' AND (LOWER(titre) LIKE ? OR LOWER(contenu) LIKE ?)';
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM articles WHERE ${where}`).get(...params).count;
  const rows = db.prepare(`SELECT id, titre, slug, tags, vues, created_at, SUBSTR(contenu, 1, 200) as extrait FROM articles WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

  res.json({ total, page: parseInt(page), data: rows });
});

// GET /api/articles/:slug
router.get('/:slug', (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE slug = ?').get(req.params.slug);
  if (!article) return res.status(404).json({ error: 'Article non trouvé.' });

  db.prepare('UPDATE articles SET vues = vues + 1 WHERE id = ?').run(article.id);
  res.json({ ...article, vues: article.vues + 1 });
});

// POST /api/articles (admin)
router.post('/', authMiddleware, (req, res) => {
  const { titre, contenu, tags } = req.body;
  if (!titre) return res.status(400).json({ error: 'Le titre est requis.' });

  const slug = slugify(titre, { lower: true, strict: true, locale: 'fr' }) + '-' + Date.now();

  const result = db.prepare(
    'INSERT INTO articles (titre, slug, contenu, tags) VALUES (?, ?, ?, ?)'
  ).run(titre, slug, contenu || '', tags || '');

  res.status(201).json({ id: result.lastInsertRowid, slug });
});

// PUT /api/articles/:id (admin)
router.put('/:id', authMiddleware, (req, res) => {
  const { titre, contenu, tags } = req.body;
  db.prepare('UPDATE articles SET titre=?, contenu=?, tags=? WHERE id=?')
    .run(titre, contenu, tags, req.params.id);
  res.json({ message: 'Article mis à jour.' });
});

// DELETE /api/articles/:id (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ message: 'Article supprimé.' });
});

module.exports = router;
