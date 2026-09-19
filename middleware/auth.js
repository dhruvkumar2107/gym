const jwt = require('jsonwebtoken');
const { get } = require('../database/db');
const JWT_SECRET = process.env.JWT_SECRET || 'zacson-fitness-secret-key-2026';

function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = get('SELECT id, username, email, role, full_name, phone, avatar FROM users WHERE id = ?', [decoded.userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = get('SELECT id, username, email, role, full_name, phone, avatar FROM users WHERE id = ?', [decoded.userId]);
      if (user) req.user = user;
    } catch (err) {}
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, optionalAuth, JWT_SECRET };
