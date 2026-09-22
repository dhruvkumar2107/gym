const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware, adminMiddleware);

let notifyMod = {};
try { notifyMod = require('../services/notify'); } catch (e) {}
const createNotification = notifyMod.createNotification || function (n) {
  try {
    run('INSERT INTO notifications (user_id, title, message, type, module) VALUES (?, ?, ?, ?, ?)',
      [n && n.user_id !== undefined ? n.user_id : null, (n && n.title) || '', (n && (n.body || n.message)) || '', (n && n.type) || 'info', (n && (n.link || n.module)) || null]);
  } catch (e) {}
  return null;
};
const logAudit = notifyMod.logAudit || function (a) {
  try {
    const u = (a && a.req && a.req.user) || null;
    run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [(a && a.user_id) || (u && u.id) || null, (u && u.full_name) || null, (a && a.action) || '', (a && a.entity_type) || null, (a && a.entity_id) || null, (a && a.entity_name) || null, a && a.previous_value != null ? String(a.previous_value) : null, a && a.new_value != null ? String(a.new_value) : null]);
  } catch (e) {}
  return null;
};

router.get('/tickets/:id', (req, res) => {
  const ticket = get('SELECT t.*, u.full_name as customer_name, u.email as customer_email, a.full_name as assigned_name FROM tickets t JOIN users u ON t.user_id = u.id LEFT JOIN users a ON t.assigned_to = a.id WHERE t.id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const messages = all('SELECT tm.*, u.full_name as sender_name, u.role as sender_role FROM ticket_messages tm JOIN users u ON tm.sender_id = u.id WHERE tm.ticket_id = ? ORDER BY tm.created_at', [ticket.id]);
  res.json({ ticket, messages });
});

router.post('/tickets', (req, res) => {
  const { customer_id, subject, category, priority, description, assigned_to } = req.body;
  if (!customer_id || !subject || !category) return res.status(400).json({ error: 'customer_id, subject and category are required' });
  const ticketId = 'TKT-' + Date.now().toString(36).toUpperCase();
  const ins = run('INSERT INTO tickets (ticket_id, user_id, category, priority, subject, description, assigned_to, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [ticketId, customer_id, category, priority || 'medium', subject, description || '', assigned_to || null, 'open']);
  const id = ins.lastID;
  const customer = get('SELECT full_name FROM users WHERE id = ?', [customer_id]);
  if (assigned_to) {
    try { createNotification({ user_id: assigned_to, type: 'ticket', title: 'Ticket assigned: ' + ticketId, body: `'${subject}' from ${customer ? customer.full_name : 'customer'} has been assigned to you.`, link: '/admin?view=support' }); } catch (e) {}
  }
  logAudit({ req, action: 'CREATE', entity_type: 'ticket', entity_id: id, entity_name: subject, new_value: JSON.stringify({ ticket_id: ticketId, priority, assigned_to }) });
  res.json({ message: 'Ticket created on behalf of customer', ticket_id: ticketId, id });
});

router.put('/tickets/:id', (req, res) => {
  const ticket = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const { status, assigned_to, priority, resolution } = req.body;
  run('UPDATE tickets SET status = ?, assigned_to = ?, priority = ?, resolution = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status !== undefined ? status : ticket.status, assigned_to !== undefined ? assigned_to : ticket.assigned_to, priority !== undefined ? priority : ticket.priority, resolution !== undefined ? resolution : ticket.resolution, status === 'resolved' ? new Date().toISOString() : ticket.resolved_at, req.params.id]);
  if (status === 'resolved' || status === 'closed') {
    try { createNotification({ user_id: ticket.user_id, type: 'ticket', title: 'Ticket resolved: ' + ticket.ticket_id, body: `Your ticket '${ticket.subject}' has been marked ${status}${resolution ? ': ' + resolution : ''}.`, link: '/portal?view=support' }); } catch (e) {}
  }
  logAudit({ req, action: 'UPDATE', entity_type: 'ticket', entity_id: ticket.id, entity_name: ticket.subject, previous_value: JSON.stringify({ status: ticket.status, priority: ticket.priority }), new_value: JSON.stringify({ status, priority, assigned_to }) });
  res.json({ message: 'Ticket updated' });
});

router.post('/tickets/:id/messages', (req, res) => {
  const ticket = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const { message, is_internal } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  run('INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal) VALUES (?, ?, ?, ?)',
    [ticket.id, req.user.id, message, is_internal ? 1 : 0]);
  const recipient = req.user.id === ticket.user_id
    ? (ticket.assigned_to || null)
    : ticket.user_id;
  if (recipient && recipient !== req.user.id) {
    try { createNotification({ user_id: recipient, type: 'ticket', title: 'New message on ' + ticket.ticket_id, body: `${req.user.full_name}: ${message}`, link: '/portal?view=support' }); } catch (e) {}
  }
  res.json({ message: 'Message added' });
});

const PRIORITY_ORDER = ['low', 'medium', 'high', 'urgent'];

router.post('/tickets/:id/escalate', (req, res) => {
  const ticket = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const current = PRIORITY_ORDER.indexOf(ticket.priority);
  const next = PRIORITY_ORDER[Math.min(current + 1, PRIORITY_ORDER.length - 1)];
  run('UPDATE tickets SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, ticket.id]);
  const managers = all("SELECT id FROM users WHERE role IN ('admin', 'super_admin', 'branch_manager') AND is_active = 1");
  managers.forEach(m => {
    try { createNotification({ user_id: m.id, type: 'ticket', title: 'Ticket escalated: ' + ticket.ticket_id, body: `'${ticket.subject}' escalated to ${next} priority.`, link: '/admin?view=support' }); } catch (e) {}
  });
  logAudit({ req, action: 'ESCALATE', entity_type: 'ticket', entity_id: ticket.id, entity_name: ticket.subject, previous_value: ticket.priority, new_value: next });
  res.json({ message: 'Ticket escalated', priority: next });
});

module.exports = router;