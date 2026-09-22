const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { run, get, all } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const { createNotification, logAuditReq } = require('../services/notify');
const { generateInvoiceHTML } = require('../services/invoice');

const Razorpay = require('razorpay');
const NOT_CONFIGURED = 'Online payments are not configured. Please pay by cash/UPI at the gym or configure Razorpay keys.';

function razorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function razorpayClient() {
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

function randNum() {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function applyCoupon(plan, code) {
  let amount = plan.price;
  let discount = 0;
  if (code) {
    const coupon = get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [String(code).toUpperCase()]);
    if (coupon && coupon.used_count < coupon.max_uses) {
      const now = new Date().toISOString().split('T')[0];
      if ((!coupon.valid_from || now >= coupon.valid_from) && (!coupon.valid_until || now <= coupon.valid_until)) {
        if (coupon.discount_percent > 0) discount = amount * (coupon.discount_percent / 100);
        else discount = Math.min(coupon.discount_amount, amount);
        amount -= discount;
        if (amount < 0) amount = 0;
      }
    }
  }
  return { amount: Math.round(amount * 100) / 100, discount: Math.round(discount * 100) / 100, original: plan.price };
}

router.post('/create-order', authMiddleware, async (req, res) => {
  if (!razorpayConfigured()) return res.status(503).json({ error: NOT_CONFIGURED });
  const { plan_id, coupon_code } = req.body;
  const plan = get('SELECT * FROM membership_plans WHERE id = ? AND is_active = 1', [plan_id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const { amount, discount, original } = applyCoupon(plan, coupon_code);
  if (amount < 1) return res.status(400).json({ error: 'Amount must be at least ₹1' });
  let order;
  try {
    order = await razorpayClient().orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: 'rcpt_' + Date.now(),
      notes: { plan_id: String(plan.id), user_id: String(req.user.id) }
    });
  } catch (err) {
    return res.status(400).json({ error: 'Could not create payment order: ' + (err.error && err.error.description || err.message) });
  }
  run('INSERT INTO payments (payment_number, user_id, amount, method, razorpay_order_id, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [randNum(), req.user.id, amount, 'razorpay', order.id, 'pending', JSON.stringify({ plan_id: plan.id })]);
  res.json({
    order_id: order.id,
    amount: amount,
    currency: 'INR',
    key_id: process.env.RAZORPAY_KEY_ID,
    plan_name: plan.name,
    discount: discount,
    original_amount: original,
    customer: { name: req.user.full_name || req.user.email, email: req.user.email, phone: req.user.phone || '' }
  });
});

router.post('/verify-payment', authMiddleware, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: NOT_CONFIGURED });
  }
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(razorpay_signature), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }

  const paymentRow = get('SELECT * FROM payments WHERE razorpay_order_id = ? AND user_id = ?', [razorpay_order_id, req.user.id]);
  if (!paymentRow) return res.status(404).json({ error: 'Order not found' });
  run("UPDATE payments SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'completed' WHERE id = ?",
    [razorpay_payment_id, razorpay_signature, paymentRow.id]);

  let planId = null;
  try {
    const notes = JSON.parse(paymentRow.notes || '{}');
    planId = notes.plan_id || null;
  } catch (e) {}
  const plan = planId ? get('SELECT * FROM membership_plans WHERE id = ?', [planId]) : null;
  const startDate = new Date().toISOString().split('T')[0];
  const endDateObj = new Date();
  endDateObj.setMonth(endDateObj.getMonth() + (plan ? plan.duration_months : 1));
  const endDate = endDateObj.toISOString().split('T')[0];
  const memId = 'MEM-' + randNum();
  run("INSERT INTO memberships (membership_id, user_id, plan_id, status, start_date, end_date, final_amount, payment_method, notes) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)",
    [memId, req.user.id, planId, startDate, endDate, paymentRow.amount, 'razorpay', 'Payment ID: ' + (razorpay_payment_id || '')]);

  const membership = get('SELECT id FROM memberships WHERE membership_id = ?', [memId]);
  run('UPDATE payments SET membership_id = ? WHERE id = ?', [membership ? membership.id : null, paymentRow.id]);
  const invoiceNumber = 'ZAC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(paymentRow.id).padStart(4, '0');
  run('INSERT INTO invoices (invoice_number, user_id, membership_id, subtotal, total, amount_paid, balance, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
    [invoiceNumber, req.user.id, membership ? membership.id : null, paymentRow.amount, paymentRow.amount, paymentRow.amount, 'paid', startDate, (plan ? plan.name : 'Membership') + ' membership']);

  createNotification({ user_id: req.user.id, type: 'success', title: 'New Membership', body: `${req.user.email} purchased ${plan ? plan.name : 'membership'} plan - ₹${paymentRow.amount}` });
  logAuditReq(req, { action: 'CREATE', entity_type: 'membership', entity_id: memId, entity_name: plan ? plan.name : 'Membership', new_value: { amount: paymentRow.amount, start: startDate, end: endDate } });

  res.json({
    message: 'Payment verified and membership activated!',
    invoice_number: invoiceNumber,
    plan: plan ? plan.name : 'Membership',
    amount: paymentRow.amount,
    valid_until: endDate
  });
});

router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'Webhook not configured' });
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body ? (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body)) : '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature || ''), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid body' });
  }
  const event = body.event;
  const payload = body.payload;
  if (event === 'payment.captured') {
    const payment = payload.payment.entity;
    const existing = get('SELECT * FROM payments WHERE razorpay_payment_id = ?', [payment.id]);
    if (existing && existing.status !== 'completed') {
      run("UPDATE payments SET status = 'completed' WHERE razorpay_payment_id = ?", [payment.id]);
    }
  }
  res.json({ status: 'ok' });
});

router.get('/status', (req, res) => {
  res.json({
    configured: razorpayConfigured(),
    mode: process.env.RAZORPAY_MODE || (String(process.env.RAZORPAY_KEY_ID || '').indexOf('live_') === 0 ? 'live' : 'test')
  });
});

router.get('/invoices', authMiddleware, (req, res) => {
  const invoices = all(`SELECT i.* FROM invoices i WHERE i.user_id = ? ORDER BY i.created_at DESC`, [req.user.id]);
  res.json({ items: invoices, total: invoices.length });
});

router.get('/invoices/:id/html', authMiddleware, (req, res) => {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const user = get('SELECT * FROM users WHERE id = ?', [invoice.user_id]);
  const membership = invoice.membership_id ? get('SELECT * FROM memberships WHERE id = ?', [invoice.membership_id]) : null;
  const plan = (membership && membership.plan_id) ? get('SELECT * FROM membership_plans WHERE id = ?', [membership.plan_id]) : null;
  const payment = get('SELECT * FROM payments WHERE membership_id = ? ORDER BY id DESC LIMIT 1', [invoice.membership_id]) ||
    get('SELECT * FROM payments WHERE amount = ? ORDER BY id DESC LIMIT 1', [invoice.amount]);
  const html = generateInvoiceHTML(invoice, payment || {}, user || {}, plan || { name: 'Membership', duration_months: 1, price: invoice.total }, invoice.due_date || (membership && membership.end_date));
  res.type('html').send(html);
});

module.exports = router;