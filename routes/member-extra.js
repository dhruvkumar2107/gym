const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authMiddleware);

let notifyMod = {};
try { notifyMod = require('../services/notify'); } catch (e) {}
const createNotification = notifyMod.createNotification || function (n) {
  try {
    run('INSERT INTO notifications (user_id, title, message, type, module) VALUES (?, ?, ?, ?, ?)',
      [n && n.user_id !== undefined ? n.user_id : null, (n && n.title) || '', (n && (n.body || n.message)) || '', (n && n.type) || 'info', (n && (n.link || n.module)) || null]);
  } catch (e) {}
  return null;
};

function notifyAdmins(payload) {
  const admins = all("SELECT id FROM users WHERE role IN ('admin', 'super_admin', 'branch_manager') AND is_active = 1");
  admins.forEach(a => {
    try { createNotification(Object.assign({}, payload, { user_id: a.id })); } catch (e) {}
  });
}

router.post('/documents', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { name, category } = req.body;
  const rec = run('INSERT INTO documents (user_id, uploaded_by, name, file_url, file_type, file_size, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.id, name || req.file.originalname, '/uploads/' + req.file.filename, req.file.mimetype, req.file.size, category || 'general']);
  const id = rec.lastID;
  notifyAdmins({ type: 'document', title: 'New document uploaded', body: `${req.user.full_name} uploaded '${name || req.file.originalname}'.`, link: '/admin?view=members' });
  res.json({ message: 'Document uploaded', id });
});

router.get('/documents', (req, res) => {
  const items = all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json({ items, total: items.length });
});

router.post('/progress-photos', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { notes, photo_type } = req.body;
  const rec = run('INSERT INTO progress_photos (user_id, photo_url, photo_type, notes, photo_date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, '/uploads/' + req.file.filename, photo_type || 'front', notes || '', new Date().toISOString().split('T')[0]]);
  const id = rec.lastID;
  res.json({ message: 'Photo uploaded', id });
});

router.get('/progress-photos', (req, res) => {
  const items = all('SELECT * FROM progress_photos WHERE user_id = ? ORDER BY photo_date DESC', [req.user.id]);
  res.json({ items, total: items.length });
});

router.post('/referrals/generate', (req, res) => {
  const existing = get('SELECT referral_code FROM referrals WHERE referrer_id = ? LIMIT 1', [req.user.id]);
  if (existing) return res.json({ code: existing.referral_code });
  let code = '';
  let tries = 0;
  do {
    code = 'ZF' + req.user.id + Math.floor(100 + Math.random() * 9000);
    tries++;
  } while (get('SELECT referral_code FROM referrals WHERE referral_code = ?', [code]) && tries < 5);
  run('INSERT INTO referrals (referrer_id, referral_code, reward_status) VALUES (?, ?, ?)', [req.user.id, code, 'pending']);
  res.json({ code });
});

router.get('/referrals', (req, res) => {
  const items = all('SELECT r.*, l.name as referred_lead_name, l.status as referred_lead_status, u.full_name as referred_member_name FROM referrals r LEFT JOIN leads l ON r.lead_id = l.id LEFT JOIN users u ON r.referred_email = u.email WHERE r.referrer_id = ? ORDER BY r.created_at DESC', [req.user.id]);
  const rewards = get('SELECT COALESCE(SUM(reward_amount), 0) as t FROM referrals WHERE referrer_id = ? AND converted = 1', [req.user.id]);
  const code = get('SELECT referral_code FROM referrals WHERE referrer_id = ? LIMIT 1', [req.user.id]);
  res.json({ items, total: items.length, rewards_earned: rewards ? rewards.t : 0, code: code ? code.referral_code : null });
});

router.post('/freeze-request', (req, res) => {
  const { days, reason } = req.body;
  if (!days) return res.status(400).json({ error: 'days is required' });
  const admin = get("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND is_active = 1 LIMIT 1");
  const today = new Date().toISOString().slice(0, 10);
  run('INSERT INTO tasks (title, description, assigned_to, assigned_by, department, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['Membership freeze request', `Member ${req.user.full_name} requested a ${days} day freeze${reason ? ': ' + reason : ''}.`, admin ? admin.id : null, req.user.id, 'admin', 'high', today, 'todo']);
  notifyAdmins({ type: 'freeze', title: 'Membership freeze request', body: `${req.user.full_name} requested a ${days} day freeze${reason ? ' (' + reason + ')' : ''}.`, link: '/admin?view=members' });
  res.json({ message: 'Freeze request submitted' });
});

function buildMemberInvoiceHTML(invoice, items, member, brand) {
  const gstPct = invoice.tax_rate !== null && invoice.tax_rate !== undefined ? Number(invoice.tax_rate) : 18;
  const subtotal = invoice.subtotal || items.reduce((s, it) => s + it.total, 0);
  const taxAmount = invoice.tax_amount !== null && invoice.tax_amount !== undefined ? invoice.tax_amount : Math.round(subtotal * gstPct / 100);
  const total = invoice.total || subtotal + taxAmount;
  const paid = invoice.amount_paid || 0;
  const balance = invoice.balance !== null && invoice.balance !== undefined ? invoice.balance : total - paid;
  const rows = items.map(it =>
    `<tr><td>${it.description}</td><td>${it.quantity}</td><td>&#8377;${Number(it.unit_price || 0).toLocaleString('en-IN')}</td><td>&#8377;${Number(it.total || 0).toLocaleString('en-IN')}</td></tr>`
  ).join('');
  const statusClass = invoice.status === 'paid' ? 'paid' : (invoice.status === 'pending' || invoice.status === 'partial' ? 'pending' : 'failed');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;color:#333;}
.doc{max-width:760px;margin:24px auto;background:#fff;padding:36px;}
.head{display:flex;justify-content:space-between;border-bottom:3px solid #c7a44e;padding-bottom:16px;margin-bottom:22px;}
.head h1{font-size:24px;color:#c7a44e;letter-spacing:3px;}
.head .meta{text-align:right;font-size:13px;color:#555;line-height:1.7;}
.status{display:inline-block;padding:3px 12px;border-radius:4px;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;}
.status.paid{background:#27ae60;}.status.pending{background:#f39c12;}.status.failed{background:#e74c3c;}
table{width:100%;border-collapse:collapse;margin:16px 0;}
th{background:#f7f7f7;color:#c7a44e;font-size:11px;text-transform:uppercase;text-align:left;padding:10px;letter-spacing:1px;}
th.num,td.num{text-align:right;}
td{padding:10px;border-bottom:1px solid #eee;font-size:13px;}
.sums{display:flex;justify-content:flex-end;}
.sums table{width:280px;}
.sums td{padding:8px 10px;border-bottom:none;font-size:13px;}
.sums .grand td{font-size:16px;font-weight:700;color:#c7a44e;}
.note{text-align:center;color:#999;font-size:11px;margin-top:20px;border-top:1px solid #eee;padding-top:14px;}
@media print{body{background:#fff;}.doc{margin:0;padding:24px;}}
</style></head><body>
<div class="doc">
<div class="head">
<h1>${brand.toUpperCase()}</h1>
<div class="meta"><strong>INVOICE ${invoice.invoice_number}</strong><br>Date: ${String(invoice.created_at || '').slice(0, 10)}<br>Due: ${invoice.due_date || 'N/A'}<br><span class="status ${statusClass}">${invoice.status}</span></div>
</div>
<p style="font-size:13px;color:#555;line-height:1.7;">Billed to: ${member.full_name || 'Member'}<br>${member.email || ''}<br>${member.phone || ''}</p>
<table><thead><tr><th>Description</th><th>Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sums">
<table>
<tr><td>Subtotal</td><td class="num">&#8377;${Number(subtotal).toLocaleString('en-IN')}</td></tr>
<tr><td>GST (${gstPct}%)</td><td class="num">&#8377;${Number(taxAmount).toLocaleString('en-IN')}</td></tr>
<tr><td>Paid</td><td class="num">&#8377;${Number(paid).toLocaleString('en-IN')}</td></tr>
<tr class="grand"><td>${balance > 0 ? 'Balance Due' : 'Total'}</td><td class="num">&#8377;${Number(balance > 0 ? balance : total).toLocaleString('en-IN')}</td></tr>
</table>
</div>
<p class="note">Thank you for choosing ${brand}! This is a computer-generated invoice and does not require a signature.</p>
</div></body></html>`;
}

router.get('/invoices', (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const items = all('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [req.user.id, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);
  const total = get('SELECT COUNT(*) as total FROM invoices WHERE user_id = ?', [req.user.id]).total;
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/invoices/:id', (req, res) => {
  const invoice = get('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const items = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
  res.json(Object.assign({}, invoice, { items }));
});

router.get('/invoices/:id/pdf', (req, res) => {
  const invoice = get('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const items = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
  const brandRow = get("SELECT value FROM site_settings WHERE key = 'brand_name'");
  const brand = brandRow && brandRow.value ? brandRow.value : 'Zacson Fitness';
  res.type('html').send(buildMemberInvoiceHTML(invoice, items, req.user, brand));
});

module.exports = router;