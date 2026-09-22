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

function safeAll(sql, params) {
  try { return all(sql, params); } catch (e) { return []; }
}

function safeGet(sql, params) {
  try { return get(sql, params); } catch (e) { return null; }
}

function getCommissionPct() {
  const s = get("SELECT value FROM site_settings WHERE key = 'commission_pct'");
  return s && s.value !== '' && s.value !== null ? Number(s.value) : 5;
}

router.get('/leads/:id', (req, res) => {
  const lead = get('SELECT l.*, e.full_name as salesperson_name FROM leads l LEFT JOIN employees e ON l.assigned_salesperson = e.id WHERE l.id = ?', [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const activities = all('SELECT la.*, u.full_name as user_name FROM lead_activities la LEFT JOIN users u ON la.user_id = u.id WHERE la.lead_id = ? ORDER BY la.created_at DESC', [lead.id]);
  const followups = all('SELECT lf.*, u.full_name as admin_name FROM lead_followups lf LEFT JOIN users u ON lf.admin_id = u.id WHERE lf.lead_id = ? ORDER BY lf.created_at DESC', [lead.id]);
  res.json({ lead, activities, followups });
});

router.get('/followups', (req, res) => {
  const { status, assigned_to, page = 1, limit = 50 } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const conditions = ["l.next_followup_date IS NOT NULL"];
  const params = [];
  if (status === 'pending') { conditions.push("l.next_followup_date >= ? AND l.status NOT IN ('CONVERTED', 'LOST')"); params.push(today); }
  if (status === 'overdue') { conditions.push("l.next_followup_date < ? AND l.status NOT IN ('CONVERTED', 'LOST')"); params.push(today); }
  if (assigned_to) { conditions.push('l.assigned_salesperson = ?'); params.push(assigned_to); }
  const where = ' WHERE ' + conditions.join(' AND ');
  let base = 'SELECT l.id as lead_id, l.name as lead_name, l.phone, l.email, l.status as lead_status, l.next_followup_date, l.next_followup_time, l.assigned_salesperson, e.full_name as salesperson_name, lf.id as followup_id, lf.followup_type, lf.note as last_note, lf.created_at as last_followup_at FROM leads l LEFT JOIN employees e ON l.assigned_salesperson = e.id LEFT JOIN lead_followups lf ON lf.id = (SELECT id FROM lead_followups WHERE lead_id = l.id ORDER BY created_at DESC, id DESC LIMIT 1)';
  const total = get('SELECT COUNT(*) as total FROM leads l' + where, params).total;
  const items = all(base + where + ' ORDER BY l.next_followup_date LIMIT ? OFFSET ?', params.concat([parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]));
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/followups/:id/complete', (req, res) => {
  const { outcome, next_date } = req.body;
  const lf = get('SELECT * FROM lead_followups WHERE id = ?', [req.params.id]);
  const leadId = lf ? lf.lead_id : parseInt(req.params.id);
  const lead = get('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!lead) return res.status(404).json({ error: 'Lead or followup not found' });
  if (lf) {
    run('UPDATE lead_followups SET outcome = ? WHERE id = ?', [outcome !== undefined ? outcome : lf.outcome, lf.id]);
  }
  run("UPDATE leads SET next_followup_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [next_date || null, leadId]);
  run('INSERT INTO lead_activities (lead_id, user_id, activity_type, description, outcome, completed) VALUES (?, ?, ?, ?, ?, ?)',
    [leadId, req.user.id, 'followup_complete', 'Follow-up marked completed', outcome || '', 1]);
  logAudit({ req, action: 'COMPLETE', entity_type: 'lead_followup', entity_id: lf ? lf.id : leadId, entity_name: lead.name, previous_value: JSON.stringify({ next_followup_date: lead.next_followup_date }), new_value: JSON.stringify({ outcome, next_date }) });
  res.json({ message: 'Follow-up completed', lead_id: leadId });
});

router.get('/sales-targets', (req, res) => {
  const { period, page = 1, limit = 100 } = req.query;
  const conditions = [];
  const params = [];
  if (period) { conditions.push('st.period = ?'); params.push(period); }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const base = 'SELECT st.*, u.full_name as user_name FROM sales_targets st LEFT JOIN users u ON st.user_id = u.id';
  const totalRow = safeGet('SELECT COUNT(*) as total FROM sales_targets st' + where, params);
  const items = safeAll(base + where + ' ORDER BY st.period DESC LIMIT ? OFFSET ?', params.concat([parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]));
  res.json({ items, total: totalRow ? totalRow.total : 0, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/sales-targets', (req, res) => {
  const { user_id, period, target_amount } = req.body;
  if (!user_id || !period || !target_amount) return res.status(400).json({ error: 'user_id, period and target_amount are required' });
  const ins = run('INSERT INTO sales_targets (user_id, period, target_amount) VALUES (?, ?, ?)', [user_id, period, target_amount]);
  const id = ins.lastID;
  logAudit({ req, action: 'CREATE', entity_type: 'sales_target', entity_id: id, entity_name: period, new_value: JSON.stringify({ user_id, period, target_amount }) });
  res.json({ message: 'Sales target created', id });
});

router.put('/sales-targets/:id', (req, res) => {
  const prev = safeGet('SELECT * FROM sales_targets WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Sales target not found' });
  const { user_id, period, target_amount } = req.body;
  run('UPDATE sales_targets SET user_id = ?, period = ?, target_amount = ? WHERE id = ?',
    [user_id !== undefined ? user_id : prev.user_id, period || prev.period, target_amount !== undefined ? target_amount : prev.target_amount, req.params.id]);
  logAudit({ req, action: 'UPDATE', entity_type: 'sales_target', entity_id: req.params.id, entity_name: prev.period, previous_value: JSON.stringify(prev), new_value: JSON.stringify({ user_id, period, target_amount }) });
  res.json({ message: 'Sales target updated' });
});

router.delete('/sales-targets/:id', (req, res) => {
  const prev = safeGet('SELECT * FROM sales_targets WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Sales target not found' });
  run('DELETE FROM sales_targets WHERE id = ?', [req.params.id]);
  logAudit({ req, action: 'DELETE', entity_type: 'sales_target', entity_id: req.params.id, entity_name: prev.period });
  res.json({ message: 'Sales target deleted' });
});

function employeeUserIds(emp) {
  const ids = [];
  if (emp.user_id) ids.push(emp.user_id);
  if (emp.email) {
    const u = get('SELECT id FROM users WHERE email = ?', [emp.email]);
    if (u) ids.push(u.id);
  }
  return ids;
}

router.get('/reports/salesperson', (req, res) => {
  const { start_date, end_date, user_id } = req.query;
  const today = new Date().toISOString(); 
  const end = end_date || today.slice(0, 10);
  const start = start_date || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const startPeriod = start.slice(0, 7);
  const endPeriod = end.slice(0, 7);
  const commissionPct = getCommissionPct();
  const employees = all('SELECT * FROM employees WHERE is_active = 1');
  const items = [];
  const userIdFilter = user_id && user_id !== 'all' ? parseInt(user_id) : null;
  employees.forEach(emp => {
    const uids = employeeUserIds(emp);
    if (userIdFilter && !uids.includes(userIdFilter) && emp.id !== userIdFilter) return;
    const leadsAssigned = get("SELECT COUNT(*) as c FROM leads WHERE assigned_salesperson = ? AND created_at BETWEEN ? AND ?", [emp.id, start, end]).c;
    const leadsConverted = get("SELECT COUNT(*) as c FROM leads WHERE assigned_salesperson = ? AND status = 'CONVERTED' AND created_at BETWEEN ? AND ?", [emp.id, start, end]).c;
    const revenueRow = get("SELECT COALESCE(SUM(p.amount), 0) as t FROM payments p JOIN memberships m ON (p.membership_id = m.id OR p.membership_id = m.membership_id) WHERE m.assigned_salesperson = ? AND p.status = 'completed' AND date(p.created_at) BETWEEN ? AND ?", [emp.id, start, end]);
    const revenue = revenueRow ? revenueRow.t : 0;
    let target = 0;
    const uidMatch = uids;
    if (uidMatch.length) {
      const placeholders = uidMatch.map(() => '?').join(',');
      const targetRow = safeGet("SELECT COALESCE(SUM(target_amount), 0) as t FROM sales_targets WHERE user_id IN (" + placeholders + ") AND period BETWEEN ? AND ?", uidMatch.concat([startPeriod, endPeriod]));
      if (targetRow) target = targetRow.t;
    }
    const achievementPct = target > 0 ? Math.round(revenue / target * 10000) / 100 : 0;
    items.push({
      employee_id: emp.id,
      user_ids: uids,
      full_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      leads_assigned: leadsAssigned,
      leads_converted: leadsConverted,
      conversion_rate: leadsAssigned > 0 ? Math.round(leadsConverted / leadsAssigned * 10000) / 100 : 0,
      revenue: Math.round(revenue * 100) / 100,
      target,
      achievement_pct: achievementPct,
      commission: Math.round(revenue * commissionPct) / 100
    });
  });
  res.json({ items });
});

router.get('/dashboard/sales', (req, res) => {
  const now = new Date();
  const period = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const monthStart = period + '-01';
  let employee = get('SELECT * FROM employees WHERE user_id = ?', [req.user.id]);
  if (!employee) employee = get('SELECT * FROM employees WHERE email = ?', [req.user.email]);
  const salesId = employee ? employee.id : req.user.id;
  const myLeads = get('SELECT COUNT(*) as c FROM leads WHERE assigned_salesperson = ?', [salesId]).c;
  const myFollowupsDue = get("SELECT COUNT(*) as c FROM leads WHERE assigned_salesperson = ? AND next_followup_date IS NOT NULL AND next_followup_date >= ? AND status NOT IN ('CONVERTED', 'LOST')", [salesId, today]).c;
  const myConversions = get("SELECT COUNT(*) as c FROM leads WHERE assigned_salesperson = ? AND status = 'CONVERTED' AND (conversion_date IS NULL OR date(conversion_date) >= ?)", [salesId, monthStart]).c;
  const myRevenueRow = get("SELECT COALESCE(SUM(p.amount), 0) as t FROM payments p JOIN memberships m ON (p.membership_id = m.id OR p.membership_id = m.membership_id) WHERE m.assigned_salesperson = ? AND p.status = 'completed' AND strftime('%Y-%m', p.created_at) = ?", [salesId, period]);
  const myRevenue = myRevenueRow ? myRevenueRow.t : 0;
  let myTarget = 0;
  const myUid = employeeUserIds(employee || { id: req.user.id });
  if (myUid.length) {
    const ph = myUid.map(() => '?').join(',');
    const tr = safeGet('SELECT COALESCE(SUM(target_amount), 0) as t FROM sales_targets WHERE user_id IN (' + ph + ') AND period = ?', myUid.concat([period]));
    if (tr) myTarget = tr.t;
  }
  const achievementPct = myTarget > 0 ? Math.round(myRevenue / myTarget * 10000) / 100 : 0;
  const recentLeads = all('SELECT * FROM leads WHERE assigned_salesperson = ? ORDER BY created_at DESC LIMIT 5', [salesId]);
  res.json({
    employee_id: employee ? employee.id : null,
    my_leads: myLeads,
    my_followups_due: myFollowupsDue,
    my_conversions_this_month: myConversions,
    my_revenue: Math.round(myRevenue * 100) / 100,
    my_target: myTarget,
    my_achievement_pct: achievementPct,
    recent_leads: recentLeads
  });
});

module.exports = router;