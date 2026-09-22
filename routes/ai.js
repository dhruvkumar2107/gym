const express = require('express');
const router = express.Router();
const { get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware, adminMiddleware);

const today = () => new Date().toISOString().slice(0, 10);
const monthStr = () => new Date().toISOString().slice(0, 7);

function c(sql, params) {
  try { return get(sql, params) ? get(sql, params).c : 0; } catch (e) { return 0; }
}

function s(sql, params) {
  try { const r = get(sql, params); return r ? r.t : 0; } catch (e) { return 0; }
}

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function humanize(n) {
  return Number(n).toLocaleString('en-IN');
}

function answerActiveMembers() {
  const active = c("SELECT COUNT(*) as c FROM memberships WHERE status = 'active'");
  const total = c('SELECT COUNT(*) as c FROM memberships');
  const branches = c('SELECT COUNT(*) as c FROM branches');
  return {
    type: 'active_members',
    answer: `You have ${humanize(active)} active members out of ${humanize(total)} total memberships across ${humanize(branches)} branch${branches === 1 ? '' : 'es'}.`,
    data: [{ active_members: active, total_memberships: total, branches }]
  };
}

function answerExpiring(days) {
  const rows = all("SELECT m.id, u.full_name, m.end_date, mp.name as plan_name FROM memberships m JOIN users u ON m.user_id = u.id JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.status = 'active' AND m.end_date >= date('now') AND m.end_date <= date('now', ?) ORDER BY m.end_date", ['+' + days + ' days']);
  return {
    type: 'expiring',
    answer: `${humanize(rows.length)} membership${rows.length === 1 ? ' is' : 's are'} expiring in the next ${days} days.`,
    data: rows
  };
}

function answerInactive(days) {
  const rows = all("SELECT u.id, u.full_name, u.phone FROM users u JOIN memberships m ON m.user_id = u.id AND m.status = 'active' WHERE u.role = 'member' AND u.is_active = 1 AND u.id NOT IN (SELECT user_id FROM attendance WHERE date >= date('now', ?))", ['-' + days + ' days']);
  return {
    type: 'inactive_members',
    answer: `${humanize(rows.length)} active member${rows.length === 1 ? ' has' : 's have'} not visited in the last ${days} days.`,
    data: rows
  };
}

function answerTopSalesperson() {
  const row = get("SELECT e.full_name, COUNT(*) as conversions FROM leads l JOIN employees e ON l.assigned_salesperson = e.id WHERE l.status = 'CONVERTED' GROUP BY l.assigned_salesperson ORDER BY conversions DESC LIMIT 1");
  const total = c("SELECT COUNT(*) as c FROM leads WHERE status = 'CONVERTED'");
  if (!row) return { type: 'top_salesperson', answer: 'No sales conversions found yet.', data: [] };
  return {
    type: 'top_salesperson',
    answer: `${row.full_name} converted the most leads with ${humanize(row.conversions)} conversion${row.conversions === 1 ? '' : 's'} out of ${humanize(total)} total.`,
    data: [{ name: row.full_name, conversions: row.conversions, total }]
  };
}

function answerRevenueThisMonth() {
  const rev = s("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'completed' AND strftime('%Y-%m', created_at) = ?", [monthStr()]);
  const count = c("SELECT COUNT(*) as c FROM payments WHERE status = 'completed' AND strftime('%Y-%m', created_at) = ?", [monthStr()]);
  return {
    type: 'monthly_revenue',
    answer: `Revenue generated this month is ${inr(rev)} from ${humanize(count)} completed payment${count === 1 ? '' : 's'}.`,
    data: [{ month: monthStr(), revenue: rev, payments: count }]
  };
}

function answerPopularClass() {
  const row = get("SELECT c.name, COUNT(*) as bookings FROM class_bookings cb JOIN classes c ON cb.class_id = c.id WHERE cb.status = 'booked' GROUP BY c.id ORDER BY bookings DESC LIMIT 1");
  if (!row) return { type: 'popular_class', answer: 'No class bookings yet.', data: [] };
  return {
    type: 'popular_class',
    answer: `The most popular class is ${row.name} with ${humanize(row.bookings)} booking${row.bookings === 1 ? '' : 's'}.`,
    data: [{ name: row.name, bookings: row.bookings }]
  };
}

function answerOutstanding() {
  const count = c("SELECT COUNT(*) as c FROM invoices WHERE status IN ('pending', 'partial')");
  const total = s("SELECT COALESCE(SUM(balance), 0) as t FROM invoices WHERE status IN ('pending', 'partial')");
  return {
    type: 'outstanding',
    answer: `There ${count === 1 ? 'is' : 'are'} ${humanize(count)} unpaid invoice${count === 1 ? '' : 's'} totalling ${inr(total)} outstanding.`,
    data: [{ unpaid_invoices: count, outstanding_amount: total }]
  };
}

function answerTodayRevenue() {
  const rev = s("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'completed' AND date(created_at) = ?", [today()]);
  const count = c("SELECT COUNT(*) as c FROM payments WHERE status = 'completed' AND date(created_at) = ?", [today()]);
  return {
    type: 'today_revenue',
    answer: `Today's sales are ${inr(rev)} from ${humanize(count)} payment${count === 1 ? '' : 's'}.`,
    data: [{ date: today(), revenue: rev, payments: count }]
  };
}

function answerNeedsAttention() {
  const expiring = c("SELECT COUNT(*) as c FROM memberships WHERE status = 'active' AND end_date <= date('now', '+7 days')");
  const uncontacted = c("SELECT COUNT(*) as c FROM leads WHERE status IN ('NEW_LEAD', 'new_lead') AND created_at <= datetime('now', '-24 hours')");
  const unpaid = c("SELECT COUNT(*) as c FROM invoices WHERE status IN ('pending', 'partial')");
  const lowStock = c('SELECT COUNT(*) as c FROM products WHERE is_active = 1 AND stock <= minimum_stock');
  const tickets = c("SELECT COUNT(*) as c FROM tickets WHERE status IN ('open', 'in_progress')");
  return {
    type: 'needs_attention',
    answer: `You need attention on: ${humanize(expiring)} expiring memberships, ${humanize(uncontacted)} uncontacted leads, ${humanize(unpaid)} unpaid invoices, ${humanize(lowStock)} low-stock products and ${humanize(tickets)} open tickets.`,
    data: [{ expiring_memberships: expiring, uncontacted_leads: uncontacted, unpaid_invoices: unpaid, low_stock_products: lowStock, open_tickets: tickets }]
  };
}

function answerLeadFunnel() {
  const rows = all('SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC');
  const converted = c("SELECT COUNT(*) as c FROM leads WHERE status = 'CONVERTED'");
  const total = c('SELECT COUNT(*) as c FROM leads');
  const rate = total > 0 ? Math.round(converted / total * 1000) / 10 : 0;
  return {
    type: 'lead_funnel',
    answer: `Your lead pipeline has ${humanize(total)} leads with ${humanize(converted)} converted (${rate}% conversion rate).`,
    data: rows.concat([{ status: 'conversion_rate', count: rate }])
  };
}

function answerStaffAbsent() {
  const rows = all("SELECT e.full_name, e.department FROM employees e WHERE e.is_active = 1 AND e.id NOT IN (SELECT employee_id FROM employee_attendance WHERE date = ?)", [today()]);
  return {
    type: 'staff_absent',
    answer: `${humanize(rows.length)} staff member${rows.length === 1 ? ' is' : 's are'} absent today.`,
    data: rows
  };
}

function answerAttendanceToday() {
  const count = c('SELECT COUNT(*) as c FROM attendance WHERE date = ?', [today()]);
  return {
    type: 'attendance_today',
    answer: `${humanize(count)} member${count === 1 ? ' has' : 's have'} checked in today.`,
    data: [{ date: today(), attendance: count }]
  };
}

function answerExpensesThisMonth() {
  const total = s("SELECT COALESCE(SUM(amount), 0) as t FROM expenses WHERE strftime('%Y-%m', date) = ?", [monthStr()]);
  const count = c("SELECT COUNT(*) as c FROM expenses WHERE strftime('%Y-%m', date) = ?", [monthStr()]);
  return {
    type: 'monthly_expenses',
    answer: `Total expenses this month are ${inr(total)} across ${humanize(count)} expense${count === 1 ? '' : 's'}.`,
    data: [{ month: monthStr(), expenses: total, expense_count: count }]
  };
}

function answerLowStock() {
  const rows = all('SELECT name, stock, minimum_stock FROM products WHERE is_active = 1 AND stock <= minimum_stock ORDER BY (stock - minimum_stock)');
  return {
    type: 'low_stock',
    answer: `${humanize(rows.length)} product${rows.length === 1 ? ' is' : 's are'} at or below minimum stock level.`,
    data: rows
  };
}

function answerOpenTickets() {
  const count = c("SELECT COUNT(*) as c FROM tickets WHERE status IN ('open', 'in_progress')");
  return {
    type: 'open_tickets',
    answer: `You have ${humanize(count)} open support ticket${count === 1 ? '' : 's'}.`,
    data: [{ open_tickets: count }]
  };
}

function answerClassesToday() {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const count = c("SELECT COUNT(*) as c FROM class_schedules cs JOIN classes c ON cs.class_id = c.id WHERE cs.status = 'scheduled' AND (cs.day_of_week = ? OR cs.specific_date = ?) AND c.is_active = 1", [weekday, today()]);
  return {
    type: 'classes_today',
    answer: `${humanize(count)} class${count === 1 ? ' is' : 'es are'} scheduled today.`,
    data: [{ date: today(), classes: count }]
  };
}

function answerFullClasses() {
  const rows = all("SELECT c.name, c.max_participants, COUNT(cb.id) as booked FROM classes c JOIN class_bookings cb ON cb.class_id = c.id AND cb.status = 'booked' AND cb.booking_date = date('now') GROUP BY c.id HAVING booked >= c.max_participants");
  return {
    type: 'full_classes',
    answer: `${humanize(rows.length)} class${rows.length === 1 ? ' is' : 'es are'} fully booked today.`,
    data: rows
  };
}

function answerMembershipGrowth() {
  const rows = all("SELECT strftime('%Y-%m', created_at) as period, COUNT(*) as count FROM memberships WHERE created_at >= date('now', '-6 months') GROUP BY period ORDER BY period");
  const recent = rows.reduce((acc, r) => acc + r.count, 0);
  return {
    type: 'membership_growth',
    answer: `The gym has onboarded ${humanize(recent)} new membership${recent === 1 ? '' : 's'} in the last 6 months.`,
    data: rows
  };
}

function answerBranches() {
  const rows = all("SELECT b.id, b.name, COUNT(m.id) as active_members FROM branches b LEFT JOIN memberships m ON m.branch_id = b.id AND m.status = 'active' GROUP BY b.id ORDER BY active_members DESC");
  if (!rows.length) return { type: 'branches', answer: 'No branches configured yet.', data: [] };
  const top = rows[0];
  return {
    type: 'branches',
    answer: `${top.name} is the leading branch with ${humanize(top.active_members)} active member${top.active_members === 1 ? '' : 's'} out of ${humanize(rows.reduce((a, r) => a + r.active_members, 0))} total across ${rows.length} branch${rows.length === 1 ? '' : 'es'}.`,
    data: rows
  };
}

function answerMyTargets(req) {
  const period = monthStr();
  let employee = get('SELECT * FROM employees WHERE user_id = ?', [req.user.id]);
  if (!employee) employee = get('SELECT * FROM employees WHERE email = ?', [req.user.email]);
  const salesId = employee ? employee.id : null;
  const emailUserId = employee && employee.email ? ((get('SELECT id FROM users WHERE email = ?', [employee.email]) || {}).id || null) : null;
  const ids = [req.user.id, employee ? (employee.user_id || emailUserId) : null].filter(Boolean);
  let target = 0;
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const tr = get('SELECT COALESCE(SUM(target_amount), 0) as t FROM sales_targets WHERE user_id IN (' + ph + ') AND period = ?', ids.concat([period]));
    target = tr ? tr.t : 0;
  }
  let revenue = 0;
  if (salesId) {
    const r = get("SELECT COALESCE(SUM(p.amount), 0) as t FROM payments p JOIN memberships m ON (p.membership_id = m.id OR p.membership_id = m.membership_id) WHERE m.assigned_salesperson = ? AND p.status = 'completed' AND strftime('%Y-%m', p.created_at) = ?", [salesId, period]);
    revenue = r ? r.t : 0;
  }
  const pct = target > 0 ? Math.round(revenue / target * 10000) / 100 : 0;
  return {
    type: 'my_targets',
    answer: target > 0
      ? `Your target for ${period} is ${inr(target)} and you have achieved ${inr(revenue)} (${pct}%).`
      : `You have no target set for ${period}. Current month revenue attributed to you is ${inr(revenue)}.`,
    data: [{ period, target, revenue, achievement_pct: pct }]
  };
}

function handleQuestion(q, req) {
  const text = q.toLowerCase();

  const daysMatch = text.match(/(?:not|haven't|hasn't|never|no visit)\s*.{0,15}visited?\s*.{0,15}(?:in|for|last|since)\s*(\d+)\s*days/) || text.match(/(\d+)\s*days?\s*(?:without|since|with no)\s*(?:visit|attendance)/) || text.match(/not visited\s*(?:in|for)?\s*(\d+)/);
  if (daysMatch) return answerInactive(parseInt(daysMatch[1]));

  if (/(expir|ending soon|renew|ends (this|next) week)/.test(text) && /(7 days|7days|this week|next|week|soon|within)/.test(text)) return answerExpiring(7);
  if (/expir|renew|ending soon/.test(text)) return answerExpiring(7);

  if (/(inactive|haven't visited|not visiting|absent members|no shows)/.test(text)) return answerInactive(30);

  if (/(active members|total members|how many members|member count|customers do we have)/.test(text)) return answerActiveMembers();

  if (/(top sales|best sales|salesperson|sales rep|agent|employee)\s*.{0,25}(convert|top|most|best)/.test(text)) return answerTopSalesperson();

  if (/(revenue|sales|earnings|income|collected)\s*.{0,20}(this month|monthly|generated)/.test(text)) return answerRevenueThisMonth();

  if (/(popular class|most booked|best class|top class|popular workout)/.test(text)) return answerPopularClass();

  if (/(unpaid|outstanding|pending).*(invoice|billing|dues)/.test(text) || /(invoice|billing).*(unpaid|outstanding|pending)/.test(text)) return answerOutstanding();

  if (/(today'?s?|today).{0,10}(sales|revenue|earnings|collected)/.test(text) || /(sales|revenue).{0,10}(today)/.test(text)) return answerTodayRevenue();

  if (/(needs attention|attention|overview|dashboard|capsule|summary of)/.test(text)) return answerNeedsAttention();

  if (/(funnel|pipeline|conversion)/.test(text)) return answerLeadFunnel();

  if (/(staff|employees|team|people)\s*.{0,15}(absent|missing|took leave|on leave)/.test(text)) return answerStaffAbsent();

  if (/(attendance|checked in|check ?ins?|visits?)\s*.{0,12}today/.test(text)) return answerAttendanceToday();

  if (/(expenses?|spends?|cost).{0,15}(this month|monthly)/.test(text)) return answerExpensesThisMonth();

  if (/(low stock|out of stock|stock alert|reorder|inventory level)/.test(text)) return answerLowStock();

  if (/(open|unresolved|pending|active) tickets?/.test(text)) return answerOpenTickets();

  if (/(full classes|fully booked|classes full)/.test(text)) return answerFullClasses();

  if (/(classes?|sessions?)\s*(today|today's)/.test(text)) return answerClassesToday();

  if (/(growth|new members|membership trend|joined (last|this))/i.test(text)) return answerMembershipGrowth();

  if (/(which branch|top branch|best branch|branches|branch performance)/.test(text)) return answerBranches();

  if (/\bmy\b.{0,20}(target|sales|achievement)/.test(text)) return answerMyTargets(req);

  return null;
}

const SUGGESTIONS = [
  'How many active members do we have?',
  'Which memberships are expiring this week?',
  'Who converted the most leads?',
  'What is our revenue this month?',
  'Which is the most popular class?',
  'How much is outstanding on invoices?',
  'What were today\'s sales?',
  'How many members haven\'t visited in 14 days?',
  'What needs attention today?',
  'What is our lead conversion rate?',
  'Which staff are absent today?',
  'How many people checked in today?',
  'What are our expenses this month?',
  'Which products have low stock?',
  'How many open tickets are there?',
  'What is our membership growth?',
  'Which is the best performing branch?'
];

router.post('/ai', (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required' });
  const result = handleQuestion(String(question), req);
  if (!result) {
    return res.json({ answer: 'I could not find data matching that question. Try one of the suggested queries.', type: 'unknown', data: [] });
  }
  res.json(result);
});

router.get('/ai/suggestions', (req, res) => {
  res.json({ items: SUGGESTIONS });
});

module.exports = router;