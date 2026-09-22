const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { run, get, all } = require('../database/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/email');

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function issueToken(user, expiresIn, rememberMe) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: expiresIn });
}

function sendTokenResponse(res, user, token, rememberMe, req) {
  const ms = (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000;
  res.cookie('token', token, { httpOnly: true, maxAge: ms, sameSite: 'lax' });
  run('INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, datetime("now", ?))',
    [user.id, token, req.ip || '', String(req.headers['user-agent'] || '').substring(0, 255), rememberMe ? '+30 days' : '+1 days']);
  const employee = !['member', 'user'].includes(user.role) ? get('SELECT * FROM employees WHERE email = ?', [user.email]) : null;
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
}

function createOtp(user, purpose) {
  const code = generateOtp();
  run('INSERT INTO otps (user_id, email, otp_code, purpose, expires_at) VALUES (?, ?, ?, ?, datetime("now", "+10 minutes"))',
    [user.id, user.email, code, purpose]);
  return code;
}

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('remember_me').optional().isBoolean()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, remember_me } = req.body;
  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.is_active) return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
  run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  if (user.two_factor_enabled) {
    const code = createOtp(user, '2fa');
    if (process.env.FROM_EMAIL) sendOtpEmail(user.email, code, '2fa').catch(() => {});
    const tmpToken = jwt.sign({ userId: user.id, purpose: '2fa' }, JWT_SECRET, { expiresIn: '5m' });
    return res.json({ requires_2fa: true, tmp_token: tmpToken, message: 'Two-factor authentication required. Check your email for the OTP.' });
  }
  const token = issueToken(user, remember_me ? '30d' : '1d', remember_me);
  sendTokenResponse(res, user, token, remember_me, req);
});

router.post('/verify-2fa', [
  body('tmp_token').notEmpty(),
  body('otp').notEmpty()
], (req, res) => {
  let decoded;
  try {
    decoded = jwt.verify(req.body.tmp_token, JWT_SECRET);
  } catch (err) {
    return res.status(400).json({ error: 'Session expired. Please log in again.' });
  }
  if (decoded.purpose !== '2fa') return res.status(400).json({ error: 'Invalid token' });
  const otpRow = get('SELECT * FROM otps WHERE user_id = ? AND purpose = "2fa" AND used = 0 AND expires_at > datetime("now") ORDER BY id DESC LIMIT 1', [decoded.userId]);
  if (!otpRow || otpRow.otp_code !== String(req.body.otp).trim()) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }
  run('UPDATE otps SET used = 1 WHERE id = ?', [otpRow.id]);
  const user = get('SELECT * FROM users WHERE id = ?', [decoded.userId]);
  if (!user) return res.status(401).json({ error: 'User not found' });
  const token = issueToken(user, '1d', false);
  sendTokenResponse(res, user, token, false, req);
});

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const regSetting = get("SELECT value FROM site_settings WHERE key = 'enable_registration'");
  if (regSetting && String(regSetting.value) === '0') {
    return res.status(403).json({ error: 'Registration is currently disabled. Please contact the gym.' });
  }
  const { email, password, full_name, name, phone, date_of_birth, gender } = req.body;
  const displayName = full_name || name || '';
  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(400).json({ error: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  run('INSERT INTO users (email, password_hash, full_name, phone, date_of_birth, gender, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, hash, displayName, phone || '', date_of_birth || '', gender || '', 'member']);
  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  const token = issueToken(user, '1d', false);
  sendTokenResponse(res, user, token, false, req);
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

router.post('/send-otp', authMiddleware, (req, res) => {
  const { purpose } = req.body;
  const otpPurpose = purpose === 'verify' ? 'verify' : 'verify';
  const code = createOtp(req.user, otpPurpose);
  if (process.env.FROM_EMAIL) sendOtpEmail(req.user.email, code, otpPurpose).catch(() => {});
  res.json({ message: 'OTP sent to your email address' });
});

router.post('/verify-otp', authMiddleware, (req, res) => {
  const otpRow = get('SELECT * FROM otps WHERE user_id = ? AND purpose = "verify" AND used = 0 AND expires_at > datetime("now") ORDER BY id DESC LIMIT 1', [req.user.id]);
  if (!otpRow || otpRow.otp_code !== String(req.body.otp || '').trim()) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }
  run('UPDATE otps SET used = 1 WHERE id = ?', [otpRow.id]);
  run('UPDATE users SET email_verified = 1 WHERE id = ?', [req.user.id]);
  res.json({ message: 'Email verified successfully' });
});

router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], (req, res) => {
  const user = get('SELECT id, email FROM users WHERE email = ?', [req.body.email]);
  if (!user) return res.json({ message: 'If the email exists, a reset link has been sent.' });
  const resetToken = jwt.sign({ userId: user.id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '1h' });
  const baseUrl = process.env.APP_URL || 'https://zacsonfitness.com';
  const link = `${baseUrl}/reset-password?token=${resetToken}`;
  if (process.env.FROM_EMAIL) sendPasswordResetEmail(user.email, link).catch(() => {});
  const allowInResponse = String(process.env.ALLOW_RESET_TOKEN_IN_RESPONSE) === 'true';
  const body = { message: 'If the email exists, a reset link has been sent.' };
  if (allowInResponse) body.resetToken = resetToken;
  res.json(body);
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

router.post('/2fa/enable', authMiddleware, (req, res) => {
  run('UPDATE users SET two_factor_enabled = 1 WHERE id = ?', [req.user.id]);
  res.json({ message: 'Two-factor authentication enabled' });
});

router.post('/2fa/disable', authMiddleware, (req, res) => {
  run('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?', [req.user.id]);
  res.json({ message: 'Two-factor authentication disabled' });
});

router.get('/sessions', authMiddleware, (req, res) => {
  const sessions = all('SELECT id, ip_address, user_agent, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(sessions);
});

module.exports = router;