const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { get, all } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: JWT_SECRET is not set. Using a randomly generated secret. All tokens will be invalidated on every restart. Set JWT_SECRET in your environment (or .env) in production.');
  return generated;
})();

const STAFF_ROLES = ['admin', 'super_admin', 'branch_manager', 'trainer', 'receptionist', 'sales_manager', 'sales_executive', 'accountant', 'nutritionist', 'hr_manager', 'staff'];

let permsCache = new Map();
const PERMS_CACHE_TTL = 60 * 1000;

function loadPerms(role) {
  const cached = permsCache.get(role);
  if (cached && Date.now() - cached.at < PERMS_CACHE_TTL) return cached.perms;
  const perms = new Set();
  const roleRow = get('SELECT id FROM roles WHERE name = ?', [role]);
  if (roleRow) {
    const rows = all('SELECT p.module, p.name FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?', [roleRow.id]);
    rows.forEach(r => {
      const action = r.name.indexOf(r.module + '_') === 0 ? r.name.substring(r.module.length + 1) : r.name;
      perms.add(`${r.module}:${action}`);
    });
  }
  permsCache.set(role, { at: Date.now(), perms });
  return perms;
}

function clearPermsCache() {
  permsCache = new Map();
}

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

function adminMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!STAFF_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    req.perms = loadPerms(req.user.role);
  }
  next();
}

function can(user, permission) {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (!STAFF_ROLES.includes(user.role)) return false;
  return loadPerms(user.role).has(permission);
}

function requirePerm(module, action) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'super_admin' || req.user.role === 'admin') return next();
    if (module === 'dashboard') return next();
    if (req.perms && req.perms.has(`${module}:${action}`)) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

function hasPerm(reqUser, module, action) {
  if (!reqUser) return false;
  if (reqUser.role === 'super_admin' || reqUser.role === 'admin') return true;
  if (module === 'dashboard') return true;
  if (reqUser.perms && reqUser.perms.has(`${module}:${action}`)) return true;
  return loadPerms(reqUser.role).has(`${module}:${action}`);
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
    const [module, action] = permission.split(':');
    if (hasPerm(req.user, module, action)) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = { authMiddleware, adminMiddleware, roleMiddleware, permissionMiddleware, optionalAuth, requirePerm, can, hasPerm, clearPermsCache, JWT_SECRET };