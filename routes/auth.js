const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get, all } = require('../database/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.is_active) return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
  run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  run('INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, datetime("now", "+7 days"))',
    [user.id, token, req.ip, req.headers['user-agent']]);
  const employee = user.role !== 'member' && user.role !== 'user' ? get('SELECT * FROM employees WHERE email = ?', [user.email]) : null;
  res.json({
    token,
    user: {
      id: user.id, username: user.username, email: user.email, role: user.role,
      full_name: user.full_name, phone: user.phone, avatar: user.avatar,
      employee_id: employee ? employee.id : null,
      department: employee ? employee.department : null,
      designation: employee ? employee.designation : null,
      branch_id: employee ? employee.branch_id : null
    }
  });
});

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, full_name, name, phone, date_of_birth, gender, role } = req.body;
  const displayName = full_name || name || '';
  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(400).json({ error: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const userRole = (role === 'member' || role === 'user' || !role) ? 'member' : role;
  run('INSERT INTO users (email, password_hash, full_name, phone, date_of_birth, gender, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, hash, displayName, phone || '', date_of_birth || '', gender || '', userRole]);
  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  run('INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, datetime("now", "+7 days"))',
    [user.id, token, req.ip, req.headers['user-agent']]);
  res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
  });
});

router.post('/logout', authMiddleware, (req, res) => {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (token) run('DELETE FROM sessions WHERE token = ?', [token]);
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.post('/logout-all', authMiddleware, (req, res) => {
  run('DELETE FROM sessions WHERE user_id = ?', [req.user.id]);
  res.clearCookie('token');
  res.json({ message: 'Logged out from all devices' });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = get('SELECT id, username, email, role, full_name, phone, avatar, date_of_birth, gender, address, city, state, pincode, height, weight, fitness_level, fitness_goals, emergency_contact_name, emergency_contact_phone, medical_info, preferred_workout_time, email_verified, is_active, created_at FROM users WHERE id = ?', [req.user.id]);
  const employee = get('SELECT * FROM employees WHERE user_id = ? OR email = ?', [req.user.id, req.user.email]);
  const membership = get('SELECT m.*, mp.name as plan_name, mp.duration_months FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.user_id = ? AND m.status = "active" ORDER BY m.created_at DESC LIMIT 1', [req.user.id]);
  res.json({ user, employee, membership });
});

router.put('/profile', authMiddleware, (req, res) => {
  const { full_name, phone, date_of_birth, gender, address, city, state, pincode, height, weight, fitness_goals, emergency_contact_name, emergency_contact_phone, medical_info, preferred_workout_time } = req.body;
  run(`UPDATE users SET full_name=?, phone=?, date_of_birth=?, gender=?, address=?, city=?, state=?, pincode=?, height=?, weight=?, fitness_goals=?, emergency_contact_name=?, emergency_contact_phone=?, medical_info=?, preferred_workout_time=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [full_name || '', phone || '', date_of_birth || '', gender || '', address || '', city || '', state || '', pincode || '', height || null, weight || null, fitness_goals || '', emergency_contact_name || '', emergency_contact_phone || '', medical_info || '', preferred_workout_time || '', req.user.id]);
  res.json({ message: 'Profile updated' });
});

router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const user = get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(req.body.currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(req.body.newPassword, 10);
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ message: 'Password changed' });
});

router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], (req, res) => {
  const user = get('SELECT id, email FROM users WHERE email = ?', [req.body.email]);
  if (!user) return res.json({ message: 'If the email exists, a reset link has been sent.' });
  const resetToken = jwt.sign({ userId: user.id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ message: 'If the email exists, a reset link has been sent.', resetToken });
});

router.post('/reset-password', [body('token').notEmpty(), body('newPassword').isLength({ min: 6 })], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const decoded = jwt.verify(req.body.token, JWT_SECRET);
    if (decoded.purpose !== 'reset') return res.status(400).json({ error: 'Invalid token' });
    const hash = bcrypt.hashSync(req.body.newPassword, 10);
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, decoded.userId]);
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
});

router.get('/sessions', authMiddleware, (req, res) => {
  const sessions = all('SELECT id, ip_address, user_agent, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(sessions);
});

module.exports = router;
