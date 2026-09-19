const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM leads';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (search) { conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push('%'+search+'%','%'+search+'%','%'+search+'%'); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  res.json(all(sql, params));
});

router.get('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const lead = get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const followups = all('SELECT lf.*, u.full_name as admin_name FROM lead_followups lf LEFT JOIN users u ON lf.admin_id = u.id WHERE lf.lead_id = ? ORDER BY lf.created_at DESC', [req.params.id]);
  res.json({ lead, followups });
});

router.post('/', (req, res) => {
  const { source, name, phone, email, age, fitness_goal, preferred_date, preferred_time, message } = req.body;
  run('INSERT INTO leads (source, name, phone, email, age, fitness_goal, preferred_date, preferred_time, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [source || 'website', name, phone || '', email || '', age || null, fitness_goal || '', preferred_date || '', preferred_time || '', message || '']);
  res.status(201).json({ message: 'Lead captured successfully' });
});

router.put('/:id/status', authMiddleware, adminMiddleware, (req, res) => {
  const { status, notes } = req.body;
  run('UPDATE leads SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, notes || '', req.params.id]);
  res.json({ message: 'Lead status updated' });
});

router.post('/:id/followup', authMiddleware, adminMiddleware, (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'Note is required' });
  run('INSERT INTO lead_followups (lead_id, admin_id, note) VALUES (?, ?, ?)', [req.params.id, req.user.id, note]);
  res.status(201).json({ message: 'Follow-up added' });
});

router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  run('DELETE FROM leads WHERE id = ?', [req.params.id]);
  res.json({ message: 'Lead deleted' });
});

module.exports = router;
