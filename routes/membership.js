const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

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
  let amount = plan.price * plan.duration_months;

  if (coupon_code) {
    const coupon = get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [coupon_code.toUpperCase()]);
    if (coupon && coupon.used_count < coupon.max_uses) {
      if (coupon.discount_percent > 0) amount -= amount * (coupon.discount_percent / 100);
      else amount -= coupon.discount_amount;
      if (amount < 0) amount = 0;
      run('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
    }
  }

  run("INSERT INTO payments (user_id, amount, method, razorpay_payment_id, razorpay_order_id, razorpay_signature, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')",
    [req.user.id, amount, payment_method, razorpay_payment_id || '', razorpay_order_id || '', razorpay_signature || '']);
  const payment = get('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);

  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + plan.duration_months * 30 * 24 * 60 * 60 * 1000).toISOString().split('0')[0];
  const memId = 'MEM-' + Date.now().toString(36).toUpperCase();
  run("INSERT INTO memberships (membership_id, user_id, plan_id, status, start_date, end_date, final_amount, payment_method, notes) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)",
    [memId, req.user.id, plan_id, startDate, endDate, amount, payment_method, 'Paid via ' + (payment_method || 'online')]);

  const invoiceNumber = 'ZAC-' + Date.now();
  run('INSERT INTO invoices (invoice_number, user_id, membership_id, subtotal, total, amount_paid, balance, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
    [invoiceNumber, req.user.id, get('SELECT id FROM memberships WHERE membership_id = ?', [memId])?.id || null, amount, amount, amount, 'paid', startDate, plan.name + ' membership']);

  run("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'success')",
    [req.user.id, 'Membership Activated', 'Your ' + plan.name + ' plan is now active!']);

  run("INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [req.user.id, req.user.full_name || 'Member', 'CREATE', 'membership', memId, plan.name, JSON.stringify({ plan: plan.name, amount, start: startDate, end: endDate })]);

  res.json({ message: 'Membership purchased successfully', invoice: invoiceNumber, amount, membership_id: memId });
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
  const coupon = get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [code.toUpperCase()]);
  if (!coupon) return res.status(404).json({ error: 'Invalid coupon code' });
  if (coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'Coupon usage limit reached' });
  const now = new Date().toISOString().split('T')[0];
  if (coupon.valid_from && now < coupon.valid_from) return res.status(400).json({ error: 'Coupon not yet valid' });
  if (coupon.valid_until && now > coupon.valid_until) return res.status(400).json({ error: 'Coupon has expired' });
  res.json({ discount_percent: coupon.discount_percent, discount_amount: coupon.discount_amount, code: coupon.code });
});

module.exports = router;
