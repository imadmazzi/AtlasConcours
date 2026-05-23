const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const slugify = require('slugify');

// GET /api/concours — Liste paginée avec filtres
router.get('/', async (req, res) => {
  await db.syncFromAtlas(); // Always read fresh data from Atlas, bypass warm-container RAM cache
  const { page = 1, limit = 12, categorie, search, sort = 'recent' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];

  if (categorie) {
    where += ' AND LOWER(categorie) LIKE ?';
    params.push(`%${categorie.toLowerCase()}%`);
  }
  if (search) {
    where += ' AND (LOWER(titre) LIKE ? OR LOWER(description) LIKE ?)';
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  const orderBy = sort === 'recent' ? 'created_at DESC' : 'date_limite ASC';

  const total = db.prepare(`SELECT COUNT(*) as count FROM concours WHERE ${where}`).get(...params).count;
  const rows = db.prepare(`SELECT id, titre, slug, categorie, date_limite, description, created_at FROM concours WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

  res.json({ total, page: parseInt(page), limit: parseInt(limit), data: rows });
});

// GET /api/concours/similaires/:id
router.get('/similaires/:id', (req, res) => {
  const concours = db.prepare('SELECT * FROM concours WHERE id = ?').get(req.params.id);
  if (!concours) return res.json([]);

  const similaires = db.prepare(
    'SELECT id, titre, slug, categorie, date_limite FROM concours WHERE categorie = ? AND id != ? ORDER BY created_at DESC LIMIT 4'
  ).all(concours.categorie, req.params.id);

  res.json(similaires);
});

// GET /api/concours/:idOrSlug — Détail par ID ou slug
router.get('/:idOrSlug', async (req, res) => {
  await db.syncFromAtlas(); // Always read fresh data from Atlas
  const { idOrSlug } = req.params;
  let concours;
  
  if (!isNaN(idOrSlug)) {
    concours = db.prepare('SELECT * FROM concours WHERE id = ?').get(idOrSlug);
  } else {
    concours = db.prepare('SELECT * FROM concours WHERE slug = ?').get(idOrSlug);
  }
  
  if (!concours) return res.status(404).json({ error: 'Concours non trouvé.' });

  // Incrémenter les vues
  db.prepare('UPDATE concours SET vues = vues + 1 WHERE id = ?').run(concours.id);

  res.json({ ...concours, vues: (concours.vues || 0) + 1 });
});

// POST /api/concours (admin)
router.post('/', authMiddleware, (req, res) => {
  const { titre, description, categorie, date_limite, lien_source } = req.body;
  if (!titre) return res.status(400).json({ error: 'Le titre est requis.' });

  const slug = slugify(titre, { lower: true, strict: true, locale: 'fr' }) + '-' + Date.now();

  const result = db.prepare(
    'INSERT INTO concours (titre, slug, description, categorie, date_limite, lien_source) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(titre, slug, description || '', categorie || 'Général', date_limite || '', lien_source || '');

  res.status(201).json({ id: result.lastInsertRowid, slug });
});

// PUT /api/concours/:id (admin)
router.put('/:id', authMiddleware, (req, res) => {
  const { titre, description, categorie, date_limite, lien_source } = req.body;
  const existing = db.prepare('SELECT id FROM concours WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Concours non trouvé.' });

  db.prepare(
    'UPDATE concours SET titre=?, description=?, categorie=?, date_limite=?, lien_source=? WHERE id=?'
  ).run(titre, description, categorie, date_limite, lien_source, req.params.id);

  res.json({ message: 'Concours mis à jour.' });
});

// DELETE /api/concours/:id (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM concours WHERE id = ?').run(req.params.id);
  res.json({ message: 'Concours supprimé.' });
});

module.exports = router;
