const jwt = require('jsonwebtoken');
const { get } = require('../database/db');
const JWT_SECRET = process.env.JWT_SECRET || 'zacson-fitness-secret-key-2026';

function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = get('SELECT id, username, email, role, full_name, phone, avatar, is_active FROM users WHERE id = ?', [decoded.userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  const adminRoles = ['admin', 'super_admin', 'branch_manager', 'trainer', 'receptionist', 'sales_manager', 'sales_executive', 'accountant', 'nutritionist', 'hr_manager', 'staff'];
  if (!req.user || !adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function roleMiddleware(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function permissionMiddleware(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'super_admin' || req.user.role === 'admin') return next();
    const userRole = get('SELECT id FROM roles WHERE name = ?', [req.user.role]);
    if (userRole) {
      const hasPermission = get('SELECT id FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ? AND p.name = ?', [userRole.id, permission]);
      if (hasPermission) return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
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

module.exports = { authMiddleware, adminMiddleware, roleMiddleware, permissionMiddleware, optionalAuth, JWT_SECRET };
