const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { body, validationResult } = require('express-validator');
const { sendContactConfirmation, sendFreeTrialConfirmation, sendAdminNotification } = require('../services/email');

router.post('/submit', [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('message').notEmpty().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, phone, subject, message } = req.body;
  run('INSERT INTO contact_submissions (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
    [name, email, phone || '', subject || '', message]);
  run("INSERT INTO notifications (title, message, type) VALUES (?, ?, 'info')",
    ['New Contact', name + ' submitted a contact form.']);
  sendContactConfirmation({ name, email, subject, message }).catch(() => {});
  sendAdminNotification('new_contact', { name, email, phone, message }).catch(() => {});
  res.json({ message: 'Message sent successfully! We will get back to you soon.' });
});

router.post('/free-trial', [
  body('name').notEmpty().trim(),
  body('phone').notEmpty().trim(),
  body('email').isEmail().normalizeEmail()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, phone, email, age, fitness_goal, preferred_date, preferred_time, message } = req.body;
  const recent = get("SELECT id FROM leads WHERE email = ? AND created_at > datetime('now', '-1 day')", [email]);
  if (recent) return res.status(429).json({ error: 'You have already submitted a trial request recently.' });
  run('INSERT INTO leads (source, name, phone, email, age, fitness_goal, preferred_date, preferred_time, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['free_trial', name, phone, email, age || null, fitness_goal || '', preferred_date || '', preferred_time || '', message || '']);
  run("INSERT INTO notifications (title, message, type) VALUES (?, ?, 'info')",
    ['New Free Trial', name + ' requested a free trial.']);
  sendFreeTrialConfirmation({ name, phone, email, fitness_goal, preferred_date, preferred_time }).catch(() => {});
  sendAdminNotification('new_trial', { name, phone, email, fitness_goal, preferred_date }).catch(() => {});
  res.json({ message: 'Free trial booked! We will contact you to confirm your session.' });
});

router.post('/membership-enquiry', [
  body('name').notEmpty().trim(),
  body('phone').notEmpty().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, phone, email, message } = req.body;
  run('INSERT INTO leads (source, name, phone, email, message) VALUES (?, ?, ?, ?, ?)',
    ['membership_enquiry', name, phone, email || '', message || '']);
  run("INSERT INTO notifications (title, message, type) VALUES (?, ?, 'info')",
    ['New Membership Enquiry', name + ' enquired about membership.']);
  res.json({ message: 'Enquiry submitted! We will get back to you shortly.' });
});

module.exports = router;
