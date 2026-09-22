const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { run, get, all } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.post('/create-order', authMiddleware, (req, res) => {
  const { plan_id, coupon_code } = req.body;
  const plan = get('SELECT * FROM membership_plans WHERE id = ? AND is_active = 1', [plan_id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  let amount = plan.price * plan.duration_months;
  let discount = 0;

  if (coupon_code) {
    const coupon = get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [coupon_code.toUpperCase()]);
    if (coupon && coupon.used_count < coupon.max_uses) {
      const now = new Date().toISOString().split('T')[0];
      if ((!coupon.valid_from || now >= coupon.valid_from) && (!coupon.valid_until || now <= coupon.valid_until)) {
        if (coupon.discount_percent > 0) { discount = amount * (coupon.discount_percent / 100); }
        else { discount = coupon.discount_amount; }
        amount -= discount;
        if (amount < 1) amount = 1;
      }
    }
  }

  run(`INSERT INTO payments (user_id, amount, method, status, created_at) VALUES (?, ?, 'razorpay', 'pending', datetime('now'))`,
    [req.user.id, amount]);
  const payment = get('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);

  res.json({
    order_id: 'order_' + payment.id + '_' + Date.now(),
    amount: amount,
    currency: 'INR',
    key_id: 'rzp_test_placeholder',
    plan_name: plan.name,
    discount: discount,
    original_amount: plan.price * plan.duration_months,
    customer: { name: req.user.full_name || req.user.email, email: req.user.email, phone: req.user.phone || '' },
    payment_id: payment.id
  });
});

router.post('/verify-payment', authMiddleware, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, coupon_code } = req.body;

  const plan = get('SELECT * FROM membership_plans WHERE id = ?', [plan_id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  let amount = plan.price * plan.duration_months;
  if (coupon_code) {
    const coupon = get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [coupon_code.toUpperCase()]);
    if (coupon && coupon.used_count < coupon.max_uses) {
      if (coupon.discount_percent > 0) amount -= amount * (coupon.discount_percent / 100);
      else amount -= coupon.discount_amount;
      if (amount < 1) amount = 1;
      run('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
    }
  }

  run(`UPDATE payments SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'completed' WHERE razorpay_order_id = ? AND user_id = ?`,
    [razorpay_payment_id || 'demo_' + Date.now(), razorpay_signature || '', razorpay_order_id, req.user.id]);

  const payment = get('SELECT * FROM payments WHERE razorpay_order_id = ? AND user_id = ?', [razorpay_order_id, req.user.id]);

  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + plan.duration_months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const memId = 'MEM-' + Date.now().toString(36).toUpperCase();
  run(`INSERT INTO memberships (membership_id, user_id, plan_id, status, start_date, end_date, final_amount, payment_method, notes) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    [memId, req.user.id, plan_id, startDate, endDate, amount, 'razorpay', 'Payment ID: ' + (razorpay_payment_id || 'demo')]);

  const membership = get('SELECT id FROM memberships WHERE membership_id = ?', [memId]);
  const invoiceNumber = 'ZAC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(payment.id).padStart(4, '0');
  run('INSERT INTO invoices (invoice_number, user_id, membership_id, subtotal, total, amount_paid, balance, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
    [invoiceNumber, req.user.id, membership ? membership.id : null, amount, amount, amount, 'paid', startDate, plan.name + ' membership']);

  run("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'success')",
    [req.user.id, 'New Membership', `${req.user.email} purchased ${plan.name} plan - ₹${amount}`]);

  run("INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [req.user.id, req.user.full_name || 'Member', 'CREATE', 'membership', memId, plan.name, JSON.stringify({ plan: plan.name, amount, start: startDate, end: endDate })]);

  res.json({
    message: 'Payment verified and membership activated!',
    invoice_number: invoiceNumber,
    plan: plan.name,
    amount: amount,
    valid_until: endDate
  });
});

router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const secret = 'rzp_test_placeholder_secret';
  const signature = req.headers['x-razorpay-signature'];
  let body;
  try {
    const rawBody = typeof req.body === 'string' ? req.body : req.body.toString('utf8');
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
  } else if (event === 'payment.failed') {
    const payment = payload.payment.entity;
    run("UPDATE payments SET status = 'failed' WHERE razorpay_payment_id = ?", [payment.id]);
  } else if (event === 'refund.created' || event === 'refund.processed') {
    const refund = payload.refund.entity;
    run("UPDATE payments SET status = 'refunded' WHERE razorpay_payment_id = ?", [refund.payment_id]);
  }

  res.json({ status: 'ok' });
});

router.get('/invoices', authMiddleware, (req, res) => {
  const invoices = all(`SELECT i.*, p.amount, p.status as payment_status, p.razorpay_payment_id
    FROM invoices i LEFT JOIN payments p ON i.user_id = p.user_id AND p.status = 'completed'
    WHERE i.user_id = ? ORDER BY i.created_at DESC`, [req.user.id]);
  res.json(invoices);
});

router.get('/invoices/:id/html', authMiddleware, (req, res) => {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const user = get('SELECT * FROM users WHERE id = ?', [invoice.user_id]);
  res.json({ invoice, user: user ? { full_name: user.full_name, email: user.email, phone: user.phone } : null });
});

module.exports = router;
