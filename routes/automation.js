const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

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

router.post('/automation/run', (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const cronOk = cronSecret && req.headers.authorization === 'Bearer ' + cronSecret;
  const finish = () => {
    runAutomation().then(runs => res.json({ runs })).catch(() => res.status(500).json({ error: 'Automation run failed' }));
  };
  if (cronOk) return finish();
  authMiddleware(req, res, () => {
    if (!req.user) return;
    adminMiddleware(req, res, finish);
  });
});

router.use(authMiddleware, adminMiddleware);

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n) {
  return formatDate(new Date(Date.now() + n * 86400000));
}

function notRecentlyNotified(userId, title) {
  if (!userId) return true;
  const row = get("SELECT id FROM notifications WHERE user_id = ? AND title = ? AND created_at >= datetime('now', '-24 hours')", [userId, title]);
  return !row;
}

function notify(userId, payload) {
  if (!userId || !notRecentlyNotified(userId, payload.title)) return;
  try { createNotification(Object.assign({}, payload, { user_id: userId })); } catch (e) {}
}

function employeeUserId(emp) {
  if (!emp) return null;
  if (emp.user_id) return emp.user_id;
  if (emp.email) {
    const u = get('SELECT id FROM users WHERE email = ?', [emp.email]);
    if (u) return u.id;
  }
  return null;
}

function pickAssigneeUser(prefEmployeeId) {
  if (prefEmployeeId) {
    const emp = get('SELECT * FROM employees WHERE id = ?', [prefEmployeeId]);
    const uid = employeeUserId(emp);
    if (uid) return uid;
  }
  const sales = get("SELECT id FROM users WHERE role IN ('admin', 'sales_manager', 'sales_executive') AND is_active = 1 LIMIT 1");
  if (sales) return sales.id;
  const any = get("SELECT id FROM users WHERE role != 'member' AND is_active = 1 LIMIT 1");
  return any ? any.id : null;
}

function adminUserIds() {
  return all("SELECT id FROM users WHERE role IN ('admin', 'super_admin', 'accountant') AND is_active = 1").map(u => u.id);
}

function recordRun(ruleType, details) {
  try {
    run('INSERT INTO automation_runs (trigger_type, name, status, message) VALUES (?, ?, ?, ?)',
      [ruleType, String(ruleType).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), details.error ? 'error' : 'success', JSON.stringify(details)]);
  } catch (e) {}
}

function behaviorMembershipExpiring(days) {
  const type = days === 3 ? 'membership_expiring_3d' : 'membership_expiring_7d';
  const details = { threshold_days: days, members_notified: 0, tasks_created: 0, followups_created: 0 };
  const rows = all("SELECT m.id as membership_id, m.user_id, m.end_date, u.full_name, u.email, u.phone FROM memberships m JOIN users u ON m.user_id = u.id WHERE m.status = 'active' AND m.end_date >= date('now') AND m.end_date <= date('now', ?)", ['+' + days + ' days']);
  rows.forEach(r => {
    const title = 'Membership expiring soon';
    notify(r.user_id, { type: 'membership', title, body: `${r.end_date} - Your membership at Zacson Fitness expires in ${days} day(s). Renew to keep your access.`, link: '/portal?view=renew' });
    details.members_notified++;
    const assignee = pickAssigneeUser(leadSalespersonFor(r.email, r.phone));
    run("INSERT INTO tasks (title, description, assigned_to, assigned_by, department, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ['Renewal follow-up: ' + r.full_name, 'Renew membership expiring on ' + r.end_date, assignee, null, 'sales', 'high', formatDate(new Date()), 'todo']);
    details.tasks_created++;
    const lead = get('SELECT * FROM leads WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?) LIMIT 1', [r.email || '', r.phone || '']);
    if (lead) {
      try {
        run('INSERT INTO lead_followups (lead_id, admin_id, followup_type, note, next_followup_date) VALUES (?, ?, ?, ?, ?)',
          [lead.id, null, 'call', 'Renewal follow-up: membership expiring ' + r.end_date, formatDate(new Date())]);
        details.followups_created++;
      } catch (e) {}
    }
  });
  return { rule_type: type, count: rows.length, details };
}

function leadSalespersonFor(email, phone) {
  if (!email && !phone) return null;
  const lead = get('SELECT assigned_salesperson FROM leads WHERE (? != "" AND email = ?) OR (? != "" AND phone = ?) LIMIT 1', [email || '', email || '', phone || '', phone || '']);
  return lead ? lead.assigned_salesperson : null;
}

function behaviorInactiveMembers() {
  const details = { users_notified: 0, tasks_created: 0 };
  const rows = all("SELECT u.id, u.full_name, m.assigned_trainer, m.assigned_salesperson FROM users u JOIN memberships m ON m.user_id = u.id AND m.status = 'active' WHERE u.role = 'member' AND u.is_active = 1 AND u.id NOT IN (SELECT user_id FROM attendance WHERE date >= date('now', '-14 days'))");
  rows.forEach(r => {
    const title = 'We miss you at the gym';
    notify(r.id, { type: 'member', title, body: `Hi ${r.full_name}, you haven't visited in 14 days. Come back and keep your consistency streak alive!`, link: '/portal?view=schedule' });
    details.users_notified++;
    const assignee = pickAssigneeUser(r.assigned_trainer || r.assigned_salesperson);
    run("INSERT INTO tasks (title, description, assigned_to, assigned_by, department, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ['Retention follow-up: ' + r.full_name, 'Member inactive for 14 days', assignee, null, 'sales', 'high', formatDate(new Date()), 'todo']);
    details.tasks_created++;
  });
  return { rule_type: 'member_inactive_14d', count: rows.length, details };
}

function behaviorUncontactedLeads() {
  const details = { sales_notified: 0, tasks_created: 0 };
  const rows = all("SELECT l.*, e.full_name as salesperson_name FROM leads l LEFT JOIN employees e ON l.assigned_salesperson = e.id WHERE l.status IN ('NEW_LEAD', 'new_lead') AND l.created_at <= datetime('now', '-24 hours') AND NOT EXISTS (SELECT 1 FROM lead_activities la WHERE la.lead_id = l.id AND la.created_at > l.created_at)");
  rows.forEach(r => {
    const salesUser = pickAssigneeUser(r.assigned_salesperson);
    const title = 'Uncontacted lead: ' + r.name;
    notify(salesUser, { type: 'lead', title, body: 'Lead ' + r.phone + ' was created over 24h ago and has not been contacted.', link: '/admin?view=leads' });
    details.sales_notified++;
    run("INSERT INTO tasks (title, description, assigned_to, assigned_by, department, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [title, 'Contact lead immediately', salesUser, null, 'sales', 'high', formatDate(new Date()), 'todo']);
    details.tasks_created++;
  });
  return { rule_type: 'lead_uncontacted_24h', count: rows.length, details };
}

function behaviorTrialNotAttended() {
  const details = { tasks_created: 0 };
  const today = formatDate(new Date());
  const rows = all("SELECT * FROM leads WHERE status IN ('TRIAL_BOOKED', 'trial_booked') AND trial_attended = 0 AND COALESCE(trial_date, preferred_date) IS NOT NULL AND COALESCE(trial_date, preferred_date) < ?", [today]);
  rows.forEach(r => {
    const assignee = pickAssigneeUser(r.assigned_salesperson);
    const title = 'Trial not attended: ' + r.name;
    notify(assignee, { type: 'lead', title, body: 'Trial booked for ' + (r.trial_date || r.preferred_date) + ' was not attended.', link: '/admin?view=leads' });
    run("INSERT INTO tasks (title, description, assigned_to, assigned_by, department, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [title, 'Follow up and reschedule trial', assignee, null, 'sales', 'medium', formatDate(new Date()), 'todo']);
    details.tasks_created++;
  });
  return { rule_type: 'trial_not_attended', count: rows.length, details };
}

function behaviorPaymentDue() {
  const details = { members_notified: 0, accountants_notified: 0 };
  const rows = all("SELECT * FROM invoices WHERE status IN ('pending', 'partial') AND due_date IS NOT NULL AND due_date <= ?", [daysFromNow(3)]);
  rows.forEach(r => {
    notify(r.user_id, { type: 'payment', title: 'Payment due', body: 'Invoice ' + r.invoice_number + ' of ₹' + r.balance + ' is due by ' + r.due_date + '.', link: '/portal?view=payments' });
    details.members_notified++;
    adminUserIds().forEach(uid => {
      notify(uid, { type: 'payment', title: 'Payment due: ' + r.invoice_number, body: '₹' + r.balance + ' due from ' + (get('SELECT full_name FROM users WHERE id = ?', [r.user_id]) || {}).full_name + ' by ' + r.due_date, link: '/admin?view=invoices' });
      details.accountants_notified++;
    });
  });
  return { rule_type: 'payment_due', count: rows.length, details };
}

function behaviorLowStock() {
  const details = { products: 0 };
  const rows = all('SELECT * FROM products WHERE is_active = 1 AND stock <= minimum_stock');
  rows.forEach(r => {
    const title = 'Low stock: ' + r.name;
    adminUserIds().forEach(uid => {
      notify(uid, { type: 'inventory', title, body: 'Only ' + r.stock + ' units left in stock (minimum ' + r.minimum_stock + '). Reorder soon.', link: '/admin?view=inventory' });
    });
    details.products++;
  });
  return { rule_type: 'low_stock', count: rows.length, details };
}

function behaviorSlaWarning() {
  const details = { tickets: 0 };
  run("UPDATE tickets SET sla_deadline = datetime(created_at, '+48 hours') WHERE sla_deadline IS NULL AND status IN ('open', 'in_progress')");
  const rows = all("SELECT * FROM tickets WHERE status IN ('open', 'in_progress') AND sla_deadline IS NOT NULL AND sla_deadline <= datetime('now', '+24 hours')");
  rows.forEach(r => {
    adminUserIds().forEach(uid => {
      const title = 'SLA warning: ' + r.ticket_id;
      notify(uid, { type: 'ticket', title, body: 'Ticket "' + r.subject + '" is nearing its SLA deadline (' + String(r.sla_deadline).slice(0, 16) + ').', link: '/admin?view=support' });
    });
    details.tickets++;
  });
  return { rule_type: 'ticket_sla_warning', count: rows.length, details };
}

function behaviorClassReminder() {
  const details = { members_notified: 0 };
  const today = formatDate(new Date());
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const targetMin = nowMin + 60;
  const timeStr = function (min) {
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  };
  const lo = timeStr(nowMin);
  const hi = timeStr(targetMin);
  const schedules = all('SELECT cs.id as schedule_id, cs.class_id, cs.start_time, c.name as class_name FROM class_schedules cs JOIN classes c ON cs.class_id = c.id WHERE cs.status = "scheduled" AND (cs.day_of_week = ? OR cs.specific_date = ?) AND cs.start_time >= ? AND cs.start_time <= ?', [weekday, today, lo, hi]);
  schedules.forEach(s => {
    const bookings = all("SELECT user_id FROM class_bookings WHERE class_id = ? AND booking_date = ? AND status = 'booked'", [s.class_id, today]);
    bookings.forEach(b => {
      const title = 'Class starting soon: ' + s.class_name;
      notify(b.user_id, { type: 'class', title, body: 'Your class ' + s.class_name + ' starts at ' + s.start_time + '.', link: '/portal?view=classes' });
      details.members_notified++;
    });
  });
  return { rule_type: 'class_reminder', count: schedules.length, details };
}

const BEHAVIORS = {
  membership_expiring_7d: () => behaviorMembershipExpiring(7),
  membership_expiring_3d: () => behaviorMembershipExpiring(3),
  member_inactive_14d: behaviorInactiveMembers,
  lead_uncontacted_24h: behaviorUncontactedLeads,
  trial_not_attended: behaviorTrialNotAttended,
  payment_due: behaviorPaymentDue,
  low_stock: behaviorLowStock,
  ticket_sla_warning: behaviorSlaWarning,
  class_reminder: behaviorClassReminder
};

async function runAutomation() {
  const summary = [];
  let activeRules = [];
  try { activeRules = all('SELECT * FROM automation_rules WHERE is_active = 1'); } catch (e) { activeRules = []; }
  let types;
  if (activeRules.length) {
    types = activeRules.map(r => r.trigger_type).filter(t => BEHAVIORS[t]);
    if (!types.length) types = Object.keys(BEHAVIORS);
  } else {
    types = Object.keys(BEHAVIORS);
  }
  types.forEach(t => {
    try {
      const result = BEHAVIORS[t]();
      summary.push(result);
      recordRun(result.rule_type, { count: result.count, details: result.details });
    } catch (e) {
      const s = { rule_type: t, count: 0, error: String(e && e.message || e) };
      summary.push(s);
      recordRun(t, { error: String(e && e.message || e) });
    }
  });
  return summary;
}

let schedulerStarted = false;

function startAutomationScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setTimeout(() => { runAutomation().catch(() => {}); }, 10000);
  setInterval(() => { runAutomation().catch(() => {}); }, 6 * 60 * 60 * 1000);
}

router.get('/automation/rules', (req, res) => {
  let items = [];
  try { items = all('SELECT * FROM automation_rules ORDER BY created_at DESC'); } catch (e) {}
  res.json({ items, total: items.length });
});

router.post('/automation/rules', (req, res) => {
  const { name, trigger_type, trigger_config, action_type, action_config, is_active } = req.body;
  if (!name || !trigger_type) return res.status(400).json({ error: 'name and trigger_type are required' });
  let ins = null;
  try {
    ins = run('INSERT INTO automation_rules (name, trigger_type, trigger_config, action_type, action_config, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, trigger_type, JSON.stringify(trigger_config || {}), action_type || 'notify', JSON.stringify(action_config || {}), is_active === undefined ? 1 : (is_active ? 1 : 0)]);
  } catch (e) {}
  const id = ins && ins.lastID ? ins.lastID : 0;
  logAudit({ req, action: 'CREATE', entity_type: 'automation_rule', entity_id: id, entity_name: name });
  res.json({ message: 'Automation rule created', id });
});

router.put('/automation/rules/:id', (req, res) => {
  const prev = get('SELECT * FROM automation_rules WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Automation rule not found' });
  const { name, trigger_type, trigger_config, action_type, action_config, is_active } = req.body;
  run('UPDATE automation_rules SET name = ?, trigger_type = ?, trigger_config = ?, action_type = ?, action_config = ?, is_active = ? WHERE id = ?',
    [name || prev.name, trigger_type || prev.trigger_type, trigger_config !== undefined ? JSON.stringify(trigger_config) : prev.trigger_config, action_type || prev.action_type, action_config !== undefined ? JSON.stringify(action_config) : prev.action_config, is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active, req.params.id]);
  logAudit({ req, action: 'UPDATE', entity_type: 'automation_rule', entity_id: req.params.id, entity_name: prev.name, previous_value: JSON.stringify({ is_active: prev.is_active }), new_value: JSON.stringify({ is_active }) });
  res.json({ message: 'Automation rule updated' });
});

router.delete('/automation/rules/:id', (req, res) => {
  const prev = get('SELECT * FROM automation_rules WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Automation rule not found' });
  run('DELETE FROM automation_rules WHERE id = ?', [req.params.id]);
  logAudit({ req, action: 'DELETE', entity_type: 'automation_rule', entity_id: req.params.id, entity_name: prev.name });
  res.json({ message: 'Automation rule deleted' });
});

router.get('/automation/runs', (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  let items = [];
  let total = 0;
  try {
    total = get('SELECT COUNT(*) as total FROM automation_runs').total;
    items = all('SELECT * FROM automation_runs ORDER BY triggered_at DESC, id DESC LIMIT ? OFFSET ?', [parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);
  } catch (e) {}
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

module.exports = router;
module.exports.runAutomation = runAutomation;
module.exports.startAutomationScheduler = startAutomationScheduler;