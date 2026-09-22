const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { createNotification, logAuditReq } = require('../services/notify');

const GATEWAY_METHODS = ['razorpay', 'card', 'net_banking'];
const OFFLINE_METHODS = ['cash', 'upi'];
const ON_PAYMENT_NOT_CONFIGURED = 'Online payments are not configured. Please pay by cash/UPI at the gym or configure Razorpay keys.';

function razorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function issueAndActivate(req, { userId, plan, amount, paymentMethod, couponCode, razorpay }) {
  const paymentId = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

  if (razorpay) {
    run('INSERT INTO payments (payment_number, user_id, amount, method, razorpay_payment_id, razorpay_order_id, razorpay_signature, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [paymentId, userId, amount, paymentMethod, razorpay.razorpay_payment_id, razorpay.razorpay_order_id, razorpay.razorpay_signature, 'completed']);
  } else {
    run('INSERT INTO payments (payment_number, user_id, amount, method, status) VALUES (?, ?, ?, ?, ?)',
      [paymentId, userId, amount, paymentMethod, 'completed']);
  }

  const startDate = new Date().toISOString().split('T')[0];
  const endDateObj = new Date();
  endDateObj.setMonth(endDateObj.getMonth() + plan.duration_months);
  const endDate = endDateObj.toISOString().split('T')[0];

  run("INSERT INTO memberships (membership_id, user_id, plan_id, status, start_date, end_date, final_amount, payment_method, notes) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)",
    ['MEM-' + paymentId, userId, plan.id, startDate, endDate, amount, paymentMethod,
      couponCode ? `Paid via ${paymentMethod} (coupon ${couponCode})` : `Paid via ${paymentMethod}`]);
  const membership = get('SELECT id FROM memberships WHERE membership_id = ?', ['MEM-' + paymentId]);

  const invoiceNumber = 'ZAC-' + Date.now();
  run('INSERT INTO invoices (invoice_number, user_id, membership_id, subtotal, total, amount_paid, balance, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
    [invoiceNumber, userId, membership ? membership.id : null, amount, amount, amount, 'paid', startDate, plan.name + ' membership']);

  createNotification({ user_id: userId, type: 'success', title: 'Membership Activated', body: `Your ${plan.name} plan is now active!`, link: { module: 'membership' } });

  logAuditReq(req, {
    action: 'CREATE', entity_type: 'membership', entity_id: 'MEM-' + paymentId, entity_name: plan.name,
    new_value: { plan: plan.name, amount, start: startDate, end: endDate, payment_method: paymentMethod }
  });

  return { invoice: invoiceNumber, amount, membership_id: 'MEM-' + paymentId };
}

router.get('/plans', (req, res) => {
  const plans = all('SELECT * FROM membership_plans WHERE is_active = 1 ORDER BY sort_order');
  plans.forEach(p => { try { p.features = JSON.parse(p.features); } catch(e) { p.features = []; } });
  res.json(plans);
});

router.get('/plans/:slug', (req, res) => {
  const plan = get('SELECT * FROM membership_plans WHERE slug = ?', [req.params.slug]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  try { plan.features = JSON.parse(plan.features); } catch(e) { plan.features = []; }
  res.json(plan);
});

router.post('/purchase', authMiddleware, [
  body('plan_id').isInt(),
  body('payment_method').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { plan_id, payment_method, razorpay_payment_id, razorpay_order_id, razorpay_signature, coupon_code } = req.body;
  const plan = get('SELECT * FROM membership_plans WHERE id = ?', [plan_id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (!OFFLINE_METHODS.includes(payment_method) && !GATEWAY_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: 'Unsupported payment method' });
  }
  if (GATEWAY_METHODS.includes(payment_method) && !razorpayConfigured()) {
    return res.status(503).json({ error: ON_PAYMENT_NOT_CONFIGURED });
  }

  let amount = plan.price;

  if (coupon_code) {
    const coupon = get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [coupon_code.toUpperCase()]);
    if (coupon && coupon.used_count < coupon.max_uses) {
      if (coupon.discount_percent > 0) amount -= amount * (coupon.discount_percent / 100);
      else amount -= coupon.discount_amount;
      if (amount < 0) amount = 0;
      run('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
    }
  }

  if (GATEWAY_METHODS.includes(payment_method)) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(razorpay_signature), 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }
  }

  const result = issueAndActivate(req, {
    userId: req.user.id, plan, amount, paymentMethod: payment_method, couponCode: coupon_code,
    razorpay: GATEWAY_METHODS.includes(payment_method)
      ? { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      : null
  });
  res.json({ message: 'Membership purchased successfully', ...result });
});

router.get('/my-membership', authMiddleware, (req, res) => {
  const membership = get('SELECT m.*, mp.name as plan_name, mp.features FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 1', [req.user.id]);
  if (membership) {
    try { membership.features = JSON.parse(membership.features); } catch(e) { membership.features = []; }
  }
  res.json(membership || null);
});

router.post('/validate-coupon', (req, res) => {
  const { code, plan_id } = req.body;
  if (!code) return res.status(400).json({ error: 'Coupon code is required' });
  const coupon = get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [String(code).toUpperCase()]);
  if (!coupon) return res.status(404).json({ error: 'Invalid coupon code' });
  if (coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'Coupon usage limit reached' });
  const now = new Date().toISOString().split('T')[0];
  if (coupon.valid_from && now < coupon.valid_from) return res.status(400).json({ error: 'Coupon not yet valid' });
  if (coupon.valid_until && now > coupon.valid_until) return res.status(400).json({ error: 'Coupon has expired' });
  res.json({ discount_percent: coupon.discount_percent, discount_amount: coupon.discount_amount, code: coupon.code });
});

module.exports = router;