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

function notifyAdminUsers(payload) {
  const admins = all("SELECT id FROM users WHERE role IN ('admin', 'super_admin', 'accountant') AND is_active = 1");
  admins.forEach(a => {
    try { createNotification(Object.assign({}, payload, { user_id: a.id })); } catch (e) {}
  });
}

router.put('/expenses/:id/approve', (req, res) => {
  const exp = get('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
  if (!exp) return res.status(404).json({ error: 'Expense not found' });
  run("UPDATE expenses SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, req.params.id]);
  logAudit({ req, action: 'APPROVE', entity_type: 'expense', entity_id: exp.id, entity_name: exp.description, previous_value: exp.status, new_value: 'approved' });
  res.json({ message: 'Expense approved' });
});

router.put('/expenses/:id/reject', (req, res) => {
  const exp = get('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
  if (!exp) return res.status(404).json({ error: 'Expense not found' });
  const { reason } = req.body;
  run("UPDATE expenses SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, req.params.id]);
  if (exp.created_by) {
    try { createNotification({ user_id: exp.created_by, type: 'expense', title: 'Expense rejected', body: `Your expense '${exp.description}' of ₹${exp.amount} was rejected.${reason ? ' Reason: ' + reason : ''}`, link: '/admin?view=expenses' }); } catch (e) {}
  }
  logAudit({ req, action: 'REJECT', entity_type: 'expense', entity_id: exp.id, entity_name: exp.description, previous_value: exp.status, new_value: reason || 'rejected' });
  res.json({ message: 'Expense rejected' });
});

router.get('/invoices/:id/items', (req, res) => {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const items = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
  res.json({ items, total: items.length });
});

function buildInvoiceHTML(invoice, items, member) {
  const gstPct = invoice.tax_rate !== null && invoice.tax_rate !== undefined ? Number(invoice.tax_rate) : 18;
  const subtotal = invoice.subtotal || items.reduce((s, it) => s + it.total, 0);
  const taxAmount = invoice.tax_amount !== null && invoice.tax_amount !== undefined ? invoice.tax_amount : Math.round(subtotal * gstPct / 100);
  const total = invoice.total || subtotal + taxAmount;
  const paid = invoice.amount_paid || 0;
  const balance = invoice.balance !== null && invoice.balance !== undefined ? invoice.balance : total - paid;
  const setting = function (key, fallback) {
    const s = get('SELECT value FROM site_settings WHERE key = ?', [key]);
    return s && s.value ? s.value : fallback;
  };
  const brand = setting('brand_name', 'Zacson Fitness');
  const address = setting('address', 'Andheri West, Mumbai');
  const gstin = setting('gstin', '') || setting('gst_number', '');
  const upi = setting('upi_id', '');
  const bank = setting('bank_name', '');
  const bankAccount = setting('bank_account_number', '') || setting('account_number', '');
  const bankIfsc = setting('ifsc_code', '');
  const memberName = member ? member.full_name || 'Member' : 'Member';
  const memberEmail = member ? member.email || '' : '';
  const memberPhone = member ? member.phone || '' : '';
  const statusClass = invoice.status === 'paid' ? 'paid' : (invoice.status === 'pending' || invoice.status === 'partial' ? 'pending' : 'failed');
  const rowsHtml = items.map(it =>
    `<tr><td>${it.description}</td><td>${it.quantity}</td><td>&#8377;${Number(it.unit_price || 0).toLocaleString('en-IN')}</td><td>&#8377;${Number(it.total || 0).toLocaleString('en-IN')}</td></tr>`
  ).join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number} | ${brand}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;color:#333;}
.doc{max-width:780px;margin:24px auto;background:#fff;padding:36px;}
.head{display:flex;justify-content:space-between;border-bottom:3px solid #c7a44e;padding-bottom:16px;margin-bottom:22px;}
.head .brand h1{font-size:26px;color:#c7a44e;letter-spacing:3px;}
.head .brand p{color:#777;font-size:12px;margin-top:3px;}
.meta{text-align:right;font-size:13px;color:#555;line-height:1.7;}
.status{display:inline-block;padding:3px 12px;border-radius:4px;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;}
.status.paid{background:#27ae60;}
.status.pending{background:#f39c12;}
.status.failed{background:#e74c3c;}
.party{display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px;line-height:1.7;color:#555;}
.party h3{font-size:11px;text-transform:uppercase;color:#c7a44e;letter-spacing:1px;margin-bottom:4px;}
table{width:100%;border-collapse:collapse;margin:14px 0;}
th{background:#f7f7f7;color:#c7a44e;font-size:11px;text-transform:uppercase;text-align:left;padding:10px;letter-spacing:1px;border-bottom:1px solid #eee;}
th.num,td.num{text-align:right;}
td{padding:10px;border-bottom:1px solid #eee;font-size:13px;}
.sum{display:flex;justify-content:flex-end;margin:14px 0;}
.sum table{width:280px;}
.sum td{padding:8px 10px;font-size:13px;border-bottom:none;}
.sum .grand td{font-size:16px;font-weight:700;color:#c7a44e;}
.pay{margin-top:18px;border-top:1px solid #eee;padding-top:14px;font-size:12px;color:#666;line-height:1.8;}
.note{text-align:center;color:#999;font-size:11px;margin-top:20px;border-top:1px solid #eee;padding-top:14px;}
@media print{body{background:#fff;}.doc{margin:0;padding:24px;}}
</style></head><body>
<div class="doc">
<div class="head">
<div class="brand"><h1>${brand.toUpperCase()}</h1><p>${address}</p>${gstin ? '<p>GSTIN: ' + gstin + '</p>' : ''}</div>
<div class="meta"><strong>INVOICE ${invoice.invoice_number}</strong><br>Date: ${String(invoice.created_at || '').slice(0, 10)}<br>Due: ${invoice.due_date || 'N/A'}<br><span class="status ${statusClass}">${invoice.status}</span></div>
</div>
<div class="party">
<div><h3>Bill To</h3>${memberName}<br>${memberEmail}<br>${memberPhone}</div>
<div><h3>Summary</h3>Subtotal: &#8377;${Number(subtotal).toLocaleString('en-IN')}<br>GST (${gstPct}%): &#8377;${Number(taxAmount).toLocaleString('en-IN')}<br>Total: &#8377;${Number(total).toLocaleString('en-IN')}</div>
</div>
<table><thead><tr><th>Description</th><th>Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
<tbody>${rowsHtml}</tbody></table>
<div class="sum">
<table>
<tr><td>Subtotal</td><td class="num">&#8377;${Number(subtotal).toLocaleString('en-IN')}</td></tr>
<tr><td>GST (${gstPct}%)</td><td class="num">&#8377;${Number(taxAmount).toLocaleString('en-IN')}</td></tr>
<tr><td>Amount Paid</td><td class="num">&#8377;${Number(paid).toLocaleString('en-IN')}</td></tr>
<tr class="grand"><td>${balance > 0 ? 'Balance Due' : 'Total'}</td><td class="num">&#8377;${Number(balance > 0 ? balance : total).toLocaleString('en-IN')}</td></tr>
</table>
</div>
${upi || bank ? '<div class="pay"><strong>Payment Details</strong><br>' + (upi ? 'UPI ID: ' + upi + '<br>' : '') + (bank ? 'Bank: ' + bank + '<br>' : '') + (bankAccount ? 'A/C: ' + bankAccount + '<br>' : '') + (bankIfsc ? 'IFSC: ' + bankIfsc : '') + '</div>' : ''}
<p class="note">Thank you for choosing ${brand}! This is a computer-generated invoice and does not require a signature.</p>
</div></body></html>`;
}

router.get('/invoices/:id/pdf', (req, res) => {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const items = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
  const member = get('SELECT * FROM users WHERE id = ?', [invoice.user_id]);
  let html = null;
  try {
    const generator = require('../services/invoice');
    if (generator && typeof generator.generateInvoiceHTML === 'function') {
      const payment = get('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1', [invoice.id]);
      let membership = invoice.membership_id ? get('SELECT * FROM memberships WHERE id = ?', [invoice.membership_id]) : null;
      if (!membership && invoice.membership_id) membership = get('SELECT * FROM memberships WHERE membership_id = ?', [invoice.membership_id]);
      const plan = membership ? get('SELECT * FROM membership_plans WHERE plan_id = ?', [membership.plan_id]) : null;
      if (plan) {
        html = generator.generateInvoiceHTML(invoice, payment || {}, member || {}, plan);
      }
    }
  } catch (e) {
    html = null;
  }
  if (!html) html = buildInvoiceHTML(invoice, items, member);
  res.type('html').send(html);
});

router.get('/refunds', (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  let sql = 'SELECT r.*, p.payment_number, p.method as payment_method, i.invoice_number, u.full_name as member_name FROM refunds r JOIN payments p ON r.payment_id = p.id LEFT JOIN invoices i ON p.invoice_id = i.id LEFT JOIN users u ON p.user_id = u.id';
  const total = get('SELECT COUNT(*) as total FROM refunds').total;
  sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  const items = all(sql, [parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/reports/hr', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const ago30 = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const monthStr = req.query.month || today.slice(0, 7);
  const headcount = get('SELECT COUNT(*) as c FROM employees WHERE is_active = 1').c;
  const presentToday = get("SELECT COUNT(*) as c FROM employee_attendance WHERE date = ? AND status = 'present'", [today]).c;
  const onLeave = get("SELECT COUNT(*) as c FROM leave_requests WHERE status = 'approved' AND start_date <= ? AND end_date >= ?", [today, today]).c;
  const pr = get("SELECT SUM(net_salary) as t FROM payroll WHERE month = ? AND year = ? AND status = 'paid'", [parseInt(monthStr.slice(5, 7)), parseInt(monthStr.slice(0, 4))]);
  const payrollCost = pr && pr.t ? pr.t : 0;
  const attendanceTrend = all("SELECT date as period, COUNT(*) as present FROM employee_attendance WHERE date >= ? GROUP BY date ORDER BY date", [ago30]);
  res.json({
    summary: { headcount, present_today: presentToday, on_leave: onLeave, payroll_cost: payrollCost },
    attendance_trend: attendanceTrend
  });
});

router.get('/reports/inventory', (req, res) => {
  const summary = {
    products: get('SELECT COUNT(*) as c FROM products WHERE is_active = 1').c,
    total_stock_value: get('SELECT COALESCE(SUM(stock * purchase_price), 0) as t FROM products WHERE is_active = 1').t,
    low_stock: get('SELECT COUNT(*) as c FROM products WHERE is_active = 1 AND stock <= minimum_stock').c,
    out_of_stock: get('SELECT COUNT(*) as c FROM products WHERE is_active = 1 AND stock <= 0').c
  };
  const byCategory = all("SELECT COALESCE(category, 'Other') as category, COUNT(*) as count, COALESCE(SUM(stock * purchase_price), 0) as value FROM products WHERE is_active = 1 GROUP BY category ORDER BY value DESC");
  res.json({ summary, by_category: byCategory });
});

module.exports = router;