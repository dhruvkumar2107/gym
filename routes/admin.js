const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const upload = require('../middleware/upload');
const bcrypt = require('bcryptjs');

router.use(authMiddleware, adminMiddleware);

router.get('/dashboard', (req, res) => {
  const stats = {
    totalLeads: get('SELECT COUNT(*) as count FROM leads').count,
    newLeads: get("SELECT COUNT(*) as count FROM leads WHERE status = 'NEW'").count,
    totalMembers: get("SELECT COUNT(*) as count FROM memberships WHERE status = 'active'").count,
    totalRevenue: get("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'").total,
    totalBlogPosts: get('SELECT COUNT(*) as count FROM blog_posts').count,
    totalTrainers: get('SELECT COUNT(*) as count FROM trainers WHERE is_active = 1').count,
    totalClasses: get('SELECT COUNT(*) as count FROM classes WHERE is_active = 1').count,
    totalGallery: get('SELECT COUNT(*) as count FROM gallery WHERE is_active = 1').count,
    recentLeads: all('SELECT * FROM leads ORDER BY created_at DESC LIMIT 5'),
    recentPayments: all('SELECT p.*, u.full_name, u.email FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 5')
  };
  res.json(stats);
});

router.get('/users', (req, res) => {
  res.json(all('SELECT id, username, email, role, full_name, phone, created_at FROM users ORDER BY created_at DESC'));
});

router.post('/users', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').notEmpty(),
  body('role').isIn(['user', 'admin', 'trainer'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, full_name, phone, role } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  run('INSERT INTO users (email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?)', [email, hash, full_name, phone || '', role || 'user']);
  res.json({ message: 'User created', user: get('SELECT * FROM users WHERE email = ?', [email]) });
});

router.put('/users/:id', (req, res) => {
  const { full_name, phone, role } = req.body;
  run('UPDATE users SET full_name = ?, phone = ?, role = ? WHERE id = ?', [full_name, phone, role, req.params.id]);
  res.json({ message: 'User updated' });
});

router.delete('/users/:id', (req, res) => {
  run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: 'User deleted' });
});

router.get('/plans', (req, res) => {
  res.json(all('SELECT * FROM membership_plans ORDER BY sort_order'));
});
router.post('/plans', (req, res) => {
  const { name, slug, description, price, original_price, duration_months, features, is_popular, is_active, sort_order } = req.body;
  run('INSERT INTO membership_plans (name, slug, description, price, original_price, duration_months, features, is_popular, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, slug, description, price, original_price, duration_months, JSON.stringify(features || []), is_popular ? 1 : 0, is_active !== false ? 1 : 0, sort_order || 0]);
  res.json({ message: 'Plan created' });
});
router.put('/plans/:id', (req, res) => {
  const { name, slug, description, price, original_price, duration_months, features, is_popular, is_active, sort_order } = req.body;
  run('UPDATE membership_plans SET name=?, slug=?, description=?, price=?, original_price=?, duration_months=?, features=?, is_popular=?, is_active=?, sort_order=? WHERE id=?',
    [name, slug, description, price, original_price, duration_months, JSON.stringify(features || []), is_popular ? 1 : 0, is_active ? 1 : 0, sort_order || 0, req.params.id]);
  res.json({ message: 'Plan updated' });
});
router.delete('/plans/:id', (req, res) => {
  run('DELETE FROM membership_plans WHERE id = ?', [req.params.id]);
  res.json({ message: 'Plan deleted' });
});

router.get('/trainers', (req, res) => {
  res.json(all('SELECT * FROM trainers ORDER BY sort_order'));
});
router.post('/trainers', (req, res) => {
  const t = req.body;
  run('INSERT INTO trainers (name, slug, photo, designation, experience_years, certifications, specializations, bio, social_links, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [t.name, t.slug, t.photo, t.designation, t.experience_years || 0, JSON.stringify(t.certifications || []), JSON.stringify(t.specializations || []), t.bio, JSON.stringify(t.social_links || {}), t.is_active !== false ? 1 : 0, t.sort_order || 0]);
  res.json({ message: 'Trainer created' });
});
router.put('/trainers/:id', (req, res) => {
  const t = req.body;
  run('UPDATE trainers SET name=?, slug=?, photo=?, designation=?, experience_years=?, certifications=?, specializations=?, bio=?, social_links=?, is_active=?, sort_order=? WHERE id=?',
    [t.name, t.slug, t.photo, t.designation, t.experience_years, JSON.stringify(t.certifications || []), JSON.stringify(t.specializations || []), t.bio, JSON.stringify(t.social_links || {}), t.is_active ? 1 : 0, t.sort_order || 0, req.params.id]);
  res.json({ message: 'Trainer updated' });
});
router.delete('/trainers/:id', (req, res) => {
  run('DELETE FROM trainers WHERE id = ?', [req.params.id]);
  res.json({ message: 'Trainer deleted' });
});

router.get('/classes', (req, res) => {
  res.json(all('SELECT c.*, t.name as trainer_name FROM classes c LEFT JOIN trainers t ON c.trainer_id = t.id ORDER BY c.id'));
});
router.post('/classes', (req, res) => {
  const c = req.body;
  run('INSERT INTO classes (name, slug, description, trainer_id, duration_minutes, difficulty, category, max_participants, image, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [c.name, c.slug, c.description, c.trainer_id, c.duration_minutes || 60, c.difficulty || 'intermediate', c.category, c.max_participants || 20, c.image, c.is_active !== false ? 1 : 0]);
  res.json({ message: 'Class created' });
});
router.put('/classes/:id', (req, res) => {
  const c = req.body;
  run('UPDATE classes SET name=?, slug=?, description=?, trainer_id=?, duration_minutes=?, difficulty=?, category=?, max_participants=?, image=?, is_active=? WHERE id=?',
    [c.name, c.slug, c.description, c.trainer_id, c.duration_minutes, c.difficulty, c.category, c.max_participants, c.image, c.is_active ? 1 : 0, req.params.id]);
  res.json({ message: 'Class updated' });
});
router.delete('/classes/:id', (req, res) => {
  run('DELETE FROM classes WHERE id = ?', [req.params.id]);
  res.json({ message: 'Class deleted' });
});

router.get('/schedules', (req, res) => {
  res.json(all('SELECT cs.*, c.name as class_name FROM class_schedules cs JOIN classes c ON cs.class_id = c.id ORDER BY CASE cs.day_of_week WHEN "Monday" THEN 1 WHEN "Tuesday" THEN 2 WHEN "Wednesday" THEN 3 WHEN "Thursday" THEN 4 WHEN "Friday" THEN 5 WHEN "Saturday" THEN 6 WHEN "Sunday" THEN 7 END, cs.start_time'));
});
router.post('/schedules', (req, res) => {
  const s = req.body;
  run('INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, location) VALUES (?, ?, ?, ?, ?)',
    [s.class_id, s.day_of_week, s.start_time, s.end_time, s.location]);
  res.json({ message: 'Schedule created' });
});
router.delete('/schedules/:id', (req, res) => {
  run('DELETE FROM class_schedules WHERE id = ?', [req.params.id]);
  res.json({ message: 'Schedule deleted' });
});

router.get('/facilities', (req, res) => { res.json(all('SELECT * FROM facilities ORDER BY sort_order')); });
router.post('/facilities', (req, res) => {
  const f = req.body;
  run('INSERT INTO facilities (name, description, icon, image, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [f.name, f.description, f.icon, f.image, f.is_active !== false ? 1 : 0, f.sort_order || 0]);
  res.json({ message: 'Facility created' });
});
router.put('/facilities/:id', (req, res) => {
  const f = req.body;
  run('UPDATE facilities SET name=?, description=?, icon=?, image=?, is_active=?, sort_order=? WHERE id=?',
    [f.name, f.description, f.icon, f.image, f.is_active ? 1 : 0, f.sort_order || 0, req.params.id]);
  res.json({ message: 'Facility updated' });
});
router.delete('/facilities/:id', (req, res) => { run('DELETE FROM facilities WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); });

router.get('/gallery', (req, res) => { res.json(all('SELECT * FROM gallery ORDER BY sort_order')); });
router.post('/gallery', upload.single('image'), (req, res) => {
  const g = req.body;
  if (req.file) g.image = '/uploads/' + req.file.filename;
  run('INSERT INTO gallery (title, image, category, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [g.title, g.image, g.category, g.description, g.sort_order || 0, 1]);
  res.json({ message: 'Gallery item created' });
});
router.delete('/gallery/:id', (req, res) => { run('DELETE FROM gallery WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); });

router.get('/testimonials', (req, res) => { res.json(all('SELECT * FROM testimonials ORDER BY date DESC')); });
router.post('/testimonials', (req, res) => {
  const t = req.body;
  run('INSERT INTO testimonials (name, photo, rating, testimonial, date, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [t.name, t.photo, t.rating || 5, t.testimonial, t.date, t.is_approved ? 1 : 0, t.is_active !== false ? 1 : 0]);
  res.json({ message: 'Testimonial created' });
});
router.put('/testimonials/:id', (req, res) => {
  const t = req.body;
  run('UPDATE testimonials SET name=?, photo=?, rating=?, testimonial=?, is_approved=?, is_active=? WHERE id=?',
    [t.name, t.photo, t.rating, t.testimonial, t.is_approved ? 1 : 0, t.is_active ? 1 : 0, req.params.id]);
  res.json({ message: 'Testimonial updated' });
});
router.delete('/testimonials/:id', (req, res) => { run('DELETE FROM testimonials WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); });

router.get('/payments', authMiddleware, adminMiddleware, (req, res) => {
  const payments = all('SELECT p.*, u.email as user_email FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC');
  res.json(payments);
});

router.get('/memberships', authMiddleware, adminMiddleware, (req, res) => {
  const memberships = all('SELECT m.*, mp.name as plan_name, u.email as user_email FROM memberships m LEFT JOIN membership_plans mp ON m.plan_id = mp.id LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC');
  res.json(memberships);
});

router.get('/transformations', (req, res) => { res.json(all('SELECT * FROM transformations')); });
router.post('/transformations', authMiddleware, adminMiddleware, (req, res) => {
  const { name, before_image, after_image, duration, start_weight, end_weight, story, testimonial } = req.body;
  run('INSERT INTO transformations (name, before_image, after_image, duration, start_weight, end_weight, story, testimonial) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [name, before_image||'', after_image||'', duration||'', start_weight||'', end_weight||'', story||'', testimonial||'']);
  res.status(201).json({ message: 'Transformation created' });
});
router.put('/transformations/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { name, before_image, after_image, duration, start_weight, end_weight, story, testimonial } = req.body;
  run('UPDATE transformations SET name=?, before_image=?, after_image=?, duration=?, start_weight=?, end_weight=?, story=?, testimonial=? WHERE id=?', [name, before_image||'', after_image||'', duration||'', start_weight||'', end_weight||'', story||'', testimonial||'', req.params.id]);
  res.json({ message: 'Transformation updated' });
});
router.delete('/transformations/:id', authMiddleware, adminMiddleware, (req, res) => {
  run('DELETE FROM transformations WHERE id = ?', [req.params.id]);
  res.json({ message: 'Transformation deleted' });
});

router.get('/blog', (req, res) => { res.json(all('SELECT bp.*, u.full_name as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id ORDER BY bp.created_at DESC')); });
router.get('/blog-categories', (req, res) => { res.json(all('SELECT * FROM blog_categories')); });
router.post('/blog-categories', (req, res) => {
  const { name, slug, description } = req.body;
  run('INSERT INTO blog_categories (name, slug, description) VALUES (?, ?, ?)', [name, slug, description]);
  res.json({ message: 'Category created' });
});

router.get('/faqs', (req, res) => { res.json(all('SELECT * FROM faqs ORDER BY sort_order')); });
router.post('/faqs', (req, res) => {
  const f = req.body;
  run('INSERT INTO faqs (question, answer, category, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
    [f.question, f.answer, f.category || 'general', f.sort_order || 0, f.is_active !== false ? 1 : 0]);
  res.json({ message: 'FAQ created' });
});
router.put('/faqs/:id', (req, res) => {
  const f = req.body;
  run('UPDATE faqs SET question=?, answer=?, category=?, sort_order=?, is_active=? WHERE id=?',
    [f.question, f.answer, f.category, f.sort_order, f.is_active ? 1 : 0, req.params.id]);
  res.json({ message: 'FAQ updated' });
});
router.delete('/faqs/:id', (req, res) => { run('DELETE FROM faqs WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); });

router.get('/offers', (req, res) => { res.json(all('SELECT * FROM offers ORDER BY created_at DESC')); });
router.post('/offers', (req, res) => {
  const o = req.body;
  run('INSERT INTO offers (name, description, discount_percent, start_date, end_date, coupon_code, plan_ids, usage_limit, used_count, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [o.name, o.description, o.discount_percent || 0, o.start_date, o.end_date, o.coupon_code, JSON.stringify(o.plan_ids || []), o.usage_limit || 100, 0, o.is_active !== false ? 1 : 0]);
  res.json({ message: 'Offer created' });
});
router.put('/offers/:id', (req, res) => {
  const o = req.body;
  run('UPDATE offers SET name=?, description=?, discount_percent=?, start_date=?, end_date=?, coupon_code=?, plan_ids=?, usage_limit=?, is_active=? WHERE id=?',
    [o.name, o.description, o.discount_percent, o.start_date, o.end_date, o.coupon_code, JSON.stringify(o.plan_ids || []), o.usage_limit, o.is_active ? 1 : 0, req.params.id]);
  res.json({ message: 'Offer updated' });
});
router.delete('/offers/:id', (req, res) => { run('DELETE FROM offers WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); });

router.get('/coupons', (req, res) => { res.json(all('SELECT * FROM coupons')); });
router.post('/coupons', (req, res) => {
  const c = req.body;
  run('INSERT INTO coupons (code, discount_percent, discount_amount, max_uses, valid_from, valid_until, plan_ids, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [c.code, c.discount_percent || 0, c.discount_amount || 0, c.max_uses || 100, c.valid_from, c.valid_until, JSON.stringify(c.plan_ids || []), 1]);
  res.json({ message: 'Coupon created' });
});
router.delete('/coupons/:id', (req, res) => { run('DELETE FROM coupons WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); });

router.get('/leads', (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM leads';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (search) { conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push('%'+search+'%','%'+search+'%','%'+search+'%'); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  res.json(all(sql, params));
});
router.put('/leads/:id', (req, res) => {
  const { status, notes } = req.body;
  run('UPDATE leads SET status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, notes, req.params.id]);
  res.json({ message: 'Lead updated' });
});
router.post('/leads/:id/followup', (req, res) => {
  run('INSERT INTO lead_followups (lead_id, admin_id, note) VALUES (?, ?, ?)', [req.params.id, req.user.id, req.body.note]);
  res.json({ message: 'Follow-up added' });
});

router.get('/contact-submissions', (req, res) => {
  res.json(all('SELECT * FROM contact_submissions ORDER BY created_at DESC'));
});
router.put('/contact-submissions/:id', (req, res) => {
  run('UPDATE contact_submissions SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ message: 'Updated' });
});

router.get('/appointments', (req, res) => {
  res.json(all('SELECT a.*, t.name as trainer_name FROM appointments a LEFT JOIN trainers t ON a.trainer_id = t.id ORDER BY a.created_at DESC'));
});
router.put('/appointments/:id', (req, res) => {
  run('UPDATE appointments SET status = ?, notes = ? WHERE id = ?', [req.body.status, req.body.notes, req.params.id]);
  res.json({ message: 'Appointment updated' });
});

router.get('/locations', (req, res) => { res.json(all('SELECT * FROM locations')); });
router.post('/locations', (req, res) => {
  const l = req.body;
  run('INSERT INTO locations (name, slug, address, city, state, pincode, phone, email, opening_hours, map_embed_url, facilities, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [l.name, l.slug, l.address, l.city, l.state, l.pincode, l.phone, l.email, JSON.stringify(l.opening_hours || {}), l.map_embed_url, JSON.stringify(l.facilities || []), 1]);
  res.json({ message: 'Location created' });
});
router.put('/locations/:id', (req, res) => {
  const l = req.body;
  run('UPDATE locations SET name=?, slug=?, address=?, city=?, state=?, pincode=?, phone=?, email=?, opening_hours=?, map_embed_url=?, facilities=? WHERE id=?',
    [l.name, l.slug, l.address, l.city, l.state, l.pincode, l.phone, l.email, JSON.stringify(l.opening_hours || {}), l.map_embed_url, JSON.stringify(l.facilities || []), req.params.id]);
  res.json({ message: 'Location updated' });
});

router.get('/settings', authMiddleware, adminMiddleware, (req, res) => {
  const settings = all('SELECT * FROM site_settings');
  res.json(settings);
});
router.put('/settings', authMiddleware, adminMiddleware, (req, res) => {
  const settings = req.body;
  Object.keys(settings).forEach(key => {
    const existing = get('SELECT id FROM site_settings WHERE key = ?', [key]);
    if (existing) { run('UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [settings[key], key]); }
    else { run('INSERT INTO site_settings (key, value) VALUES (?, ?)', [key, settings[key]]); }
  });
  res.json({ message: 'Settings updated' });
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: '/uploads/' + req.file.filename, filename: req.file.filename });
});

module.exports = router;
