const { run, get, all } = require('../database/db');

function createNotification({ user_id, type, title, body, link }) {
  const module = (link && link.module) || null;
  const reference_id = (link && link.reference_id) !== undefined ? link.reference_id : null;
  const reference_type = (link && link.reference_type) || null;
  run('INSERT INTO notifications (user_id, title, message, type, module, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user_id || null, title || '', body || '', type || 'info', module, reference_id, reference_type]);
}

function notifyRole(role, payload) {
  const users = all('SELECT id, full_name FROM users WHERE role = ? AND is_active = 1', [role]);
  users.forEach(u => createNotification({ user_id: u.id, type: payload.type, title: payload.title, body: payload.body, link: payload.link }));
}

async function sendChannelEmail(to, subject, html) {
  const { sendEmail } = require('./email');
  return sendEmail(to, subject, html);
}

function logAudit({ user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value, ip_address, user_agent }) {
  run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id || null, user_name || null, action, entity_type || null, entity_id || null, entity_name || null,
      previous_value !== undefined ? JSON.stringify(previous_value) : null,
      new_value !== undefined ? JSON.stringify(new_value) : null,
      ip_address || null, user_agent || null]);
}

function logAuditReq(req, entry) {
  logAudit({
    user_id: req.user && req.user.id,
    user_name: req.user && req.user.full_name || null,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    entity_name: entry.entity_name,
    previous_value: entry.previous_value,
    new_value: entry.new_value,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'] ? String(req.headers['user-agent']).substring(0, 255) : null
  });
}

module.exports = { createNotification, notifyRole, sendChannelEmail, logAudit, logAuditReq };