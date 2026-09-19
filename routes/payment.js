const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { run, get, all } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const { sendMembershipConfirmation, sendAdminNotification } = require('../services/email');
const { generateInvoiceHTML } = require('../services/invoice');

let razorpay = null;

function getRazorpay() {
  if (razorpay) return razorpay;
  const keyId = get("SELECT value FROM site_settings WHERE key = 'razorpay_key_id'");
  const keySecret = get("SELECT value FROM site_settings WHERE key = 'razorpay_key_secret'");
  if (!keyId || !keyId.value || !keySecret || !keySecret.value) {
    console.warn('Razorpay not configured. Set razorpay_key_id and razorpay_key_secret in admin settings.');
    return null;
  }
  razorpay = new Razorpay({ key_id: keyId.value, key_secret: keySecret.value });
  return razorpay;
}

router.post('/create-order', authMiddleware, async (req, res) => {
  try {
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

    const rp = getRazorpay();
    if (!rp) {
      return res.status(503).json({ error: 'Payment gateway not configured. Please contact support.' });
    }

    const order = await rp.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `zac_${Date.now()}_${plan.slug}`,
      notes: { plan_id: plan.id, plan_name: plan.name, coupon: coupon_code || '', user_email: req.user.email }
    });

    run(`INSERT INTO payments (user_id, amount, method, razorpay_order_id, status, created_at)
      VALUES (?, ?, 'razorpay', ?, 'pending', datetime('now'))`,
      [req.user.id, amount, order.id]);

    res.json({
      order_id: order.id,
      amount: amount,
      currency: 'INR',
      key_id: rp.key_id,
      plan_name: plan.name,
      discount: discount,
      original_amount: plan.price * plan.duration_months,
      customer: { name: req.user.full_name || req.user.email, email: req.user.email, phone: req.user.phone || '' }
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, coupon_code } = req.body;

    const rp = getRazorpay();
    if (rp) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto.createHmac('sha256', rp.key_secret).update(body).digest('hex');
      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
      }
    }

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

    run(`UPDATE payments SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'completed'
      WHERE razorpay_order_id = ? AND user_id = ?`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id, req.user.id]);

    const payment = get('SELECT * FROM payments WHERE razorpay_order_id = ? AND user_id = ?',
      [razorpay_order_id, req.user.id]);

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + plan.duration_months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    run(`INSERT INTO memberships (user_id, plan_id, status, start_date, end_date, payment_id)
      VALUES (?, ?, 'active', ?, ?, ?)`,
      [req.user.id, plan_id, startDate, endDate, payment.id]);

    const invoiceNumber = 'ZAC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(payment.id).padStart(4, '0');
    run('INSERT INTO invoices (payment_id, invoice_number, data) VALUES (?, ?, ?)',
      [payment.id, invoiceNumber, JSON.stringify({ plan: plan.name, amount, date: startDate, customer: req.user.email })]);

    run("INSERT INTO notifications (title, message, type) VALUES (?, ?, 'success')",
      ['New Membership', `${req.user.email} purchased ${plan.name} plan - ₹${amount}`]);

    sendMembershipConfirmation(req.user, plan, { ...payment, amount, start_date: startDate, end_date: endDate }, invoiceNumber).catch(() => {});
    sendAdminNotification('new_payment', { amount, plan_name: plan.name, customer_name: req.user.full_name || req.user.email, email: req.user.email, razorpay_payment_id, invoice_number: invoiceNumber }).catch(() => {});

    res.json({
      message: 'Payment verified and membership activated!',
      invoice_number: invoiceNumber,
      plan: plan.name,
      amount: amount,
      valid_until: endDate
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const rp = getRazorpay();
  if (!rp) return res.status(503).json({ error: 'Not configured' });

  const signature = req.headers['x-razorpay-signature'];
  let body;
  try { body = JSON.parse(req.body); } catch { return res.status(400).json({ error: 'Invalid body' }); }

  const expectedSignature = crypto.createHmac('sha256', rp.key_secret).update(JSON.stringify(body)).digest('hex');
  if (expectedSignature !== signature) return res.status(400).json({ error: 'Invalid signature' });

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
    run("INSERT INTO notifications (title, message, type) VALUES (?, ?, 'warning')",
      ['Payment Failed', `Payment ${payment.id} failed for amount ₹${payment.amount / 100}`]);
  } else if (event === 'refund.created' || event === 'refund.processed') {
    const refund = payload.refund.entity;
    run("UPDATE payments SET status = 'refunded' WHERE razorpay_payment_id = ?", [refund.payment_id]);
    run("INSERT INTO notifications (title, message, type) VALUES (?, ?, 'info')",
      ['Refund Processed', `Refund of ₹${refund.amount / 100} processed for payment ${refund.payment_id}`]);
  }

  res.json({ status: 'ok' });
});

router.get('/invoices', authMiddleware, (req, res) => {
  const invoices = all(`SELECT i.*, p.amount, p.status as payment_status, p.razorpay_payment_id
    FROM invoices i JOIN payments p ON i.payment_id = p.id
    WHERE p.user_id = ? ORDER BY i.created_at DESC`, [req.user.id]);
  res.json(invoices);
});

router.get('/invoices/:id/html', authMiddleware, (req, res) => {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const payment = get('SELECT * FROM payments WHERE id = ?', [invoice.payment_id]);
  if (!payment || payment.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  let invoiceData = {};
  try { invoiceData = JSON.parse(invoice.data); } catch {}
  const plan = get('SELECT * FROM membership_plans WHERE name = ?', [invoiceData.plan]) || { name: 'Membership', duration_months: 1, price: payment.amount };
  const html = generateInvoiceHTML(invoice, payment, user, plan);
  res.send(html);
});

module.exports = router;
