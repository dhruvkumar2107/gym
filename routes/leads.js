const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware, requirePerm } = require('../middleware/auth');

function validateLead(body) {
  if (!body.name || String(body.name).trim().length < 2) return 'Name must be at least 2 characters';
  const phone = String(body.phone || '').trim();
  if (phone && !/^\+?[0-9\s-]{8,15}$/.test(phone)) return 'Invalid phone number';
  return null;
}

router.get('/', authMiddleware, adminMiddleware, requirePerm('leads', 'view'), (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT * FROM leads';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (search) { conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push('%'+search+'%','%'+search+'%','%'+search+'%'); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const total = get('SELECT COUNT(*) as c FROM leads' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params).c;
  const p = parseInt(page) || 1;
  const l = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  sql += ' ORDER BY created_at DESC LIMIT ' + l + ' OFFSET ' + ((p - 1) * l);
  const leads = all(sql, params);
  res.json({ items: leads, total, page: p, limit: l });
});

router.get('/:id', authMiddleware, adminMiddleware, requirePerm('leads', 'view'), (req, res) => {
  const lead = get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const followups = all('SELECT lf.*, u.full_name as admin_name FROM lead_followups lf LEFT JOIN users u ON lf.admin_id = u.id WHERE lf.lead_id = ? ORDER BY lf.created_at DESC', [req.params.id]);
  res.json({ lead, followups });
});

router.post('/', (req, res) => {
  const { source, name, phone, email, age, fitness_goal, preferred_date, preferred_time, message, notes } = req.body;
  const error = validateLead(req.body);
  if (error) return res.status(400).json({ error });
  const leadNotes = notes || message || '';
  const result = run('INSERT INTO leads (source, name, phone, email, age, fitness_goal, preferred_date, preferred_time, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [source || 'website', name.trim(), (phone || '').trim(), email || '', age || null, fitness_goal || '', preferred_date || '', preferred_time || '', leadNotes, 'new_lead']);
  res.status(201).json({ message: 'Lead captured successfully', id: result.lastID });
});

router.put('/:id/status', authMiddleware, adminMiddleware, requirePerm('leads', 'edit'), (req, res) => {
  const { status, notes } = req.body;
  run('UPDATE leads SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, notes || '', req.params.id]);
  res.json({ message: 'Lead status updated' });
});

router.post('/:id/followup', authMiddleware, adminMiddleware, requirePerm('followups', 'create'), (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'Note is required' });
  run('INSERT INTO lead_followups (lead_id, admin_id, note) VALUES (?, ?, ?)', [req.params.id, req.user.id, note]);
  res.status(201).json({ message: 'Follow-up added' });
});

router.delete('/:id', authMiddleware, adminMiddleware, requirePerm('leads', 'delete'), (req, res) => {
  run('DELETE FROM leads WHERE id = ?', [req.params.id]);
  res.json({ message: 'Lead deleted' });
});

module.exports = router;