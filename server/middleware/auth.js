const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Accès refusé. Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'atlasconcours_secret_jwt_2026_maroc');
    req.user = decoded;
    next();
  } catch (err) {
    console.error('❌ Auth Error:', err.message, 'Token:', token ? token.substring(0,10)+'...' : 'null');
    return res.status(403).json({ error: 'Token invalide ou expiré.' });
  }
};
