const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'atlasconcours_secret_jwt_2026_maroc';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, nom: user.nom },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: user.id, nom: user.nom, email: user.email, role: user.role }
  });
});

// POST /api/auth/register (création d'un admin supplémentaire — nécessite auth)
router.post('/register', authMiddleware, (req, res) => {
  const { nom, email, password } = req.body;

  if (!nom || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (nom, email, password, role) VALUES (?, ?, ?, ?)').run(
    nom, email, hashedPassword, 'admin'
  );

  res.status(201).json({ message: 'Compte créé avec succès.', id: result.lastInsertRowid });
});

module.exports = router;
