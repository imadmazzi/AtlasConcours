const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/emplois (et alias /api/jobs)
router.get('/', (req, res) => {
  const { page = 1, limit = 12, localisation, search, city, type, category } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];

  const loc = city || localisation;
  if (loc) {
    where += ' AND LOWER(localisation) LIKE ?';
    params.push(`%${loc.toLowerCase()}%`);
  }
  if (type) {
    where += ' AND LOWER(description) LIKE ?';
    params.push(`%${type.toLowerCase()}%`);
  }
  if (category) {
    where += ' AND (LOWER(entreprise) LIKE ? OR LOWER(description) LIKE ?)';
    params.push(`%${category.toLowerCase()}%`, `%${category.toLowerCase()}%`);
  }
  if (search) {
    where += ' AND (LOWER(titre) LIKE ? OR LOWER(entreprise) LIKE ?)';
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM emplois WHERE ${where}`).get(...params).count;
  const rows = db.prepare(`SELECT * FROM emplois WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

  res.json({ total, page: parseInt(page), data: rows });
});

// GET /api/emplois/:id
router.get('/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM emplois WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Offre non trouvée.' });
  res.json(job);
});

router.post('/', authMiddleware, (req, res) => {
  const { titre, entreprise, localisation, description, lien_candidature } = req.body;
  if (!titre || !entreprise) return res.status(400).json({ error: 'Titre et entreprise requis.' });

  const result = db.prepare(
    'INSERT INTO emplois (titre, entreprise, localisation, description, lien_candidature) VALUES (?, ?, ?, ?, ?)'
  ).run(titre, entreprise, localisation || 'Maroc', description || '', lien_candidature || '');

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/emplois/:id (admin)
router.put('/:id', authMiddleware, (req, res) => {
  const { titre, entreprise, localisation, description, lien_candidature } = req.body;
  db.prepare(
    'UPDATE emplois SET titre=?, entreprise=?, localisation=?, description=?, lien_candidature=? WHERE id=?'
  ).run(titre, entreprise, localisation, description, lien_candidature, req.params.id);
  res.json({ message: 'Offre mise à jour.' });
});

// DELETE /api/emplois/:id (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM emplois WHERE id = ?').run(req.params.id);
  res.json({ message: 'Offre supprimée.' });
});

module.exports = router;
