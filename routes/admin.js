const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware, requirePerm } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');
const upload = require('../middleware/upload');
const bcrypt = require('bcryptjs');
const { logAuditReq } = require('../services/notify');

router.use(authMiddleware, adminMiddleware);

// ========== DASHBOARD ==========
router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const staffTotal = get("SELECT COUNT(*) as c FROM employees WHERE is_active = 1").c;
  const staffPresent = get("SELECT COUNT(*) as c FROM employee_attendance WHERE date = ? AND status = 'present'", [today]).c;
  const leadsTotal = get("SELECT COUNT(*) as c FROM leads").c;
  const leadsConverted = get("SELECT COUNT(*) as c FROM leads WHERE status = 'CONVERTED' OR status = 'converted'").c;
  const funnelRows = all("SELECT CASE UPPER(status) WHEN 'NEW_LEAD' THEN 'new_lead' WHEN 'CONTACTED' THEN 'contacted' WHEN 'INTERESTED' THEN 'interested' WHEN 'TRIAL_BOOKED' THEN 'trial_booked' WHEN 'TRIAL_ATTENDED' THEN 'trial_attended' WHEN 'NEGOTIATION' THEN 'negotiation' WHEN 'PAYMENT_PENDING' THEN 'payment_pending' WHEN 'CONVERTED' THEN 'converted' WHEN 'LOST' THEN 'lost' END as stage, COUNT(*) as count FROM leads GROUP BY stage");
  const funnelStages = ['new_lead', 'contacted', 'interested', 'trial_booked', 'trial_attended', 'negotiation', 'payment_pending', 'converted', 'lost'];
  const funnelMap = {};
  funnelRows.forEach(r => { if (r.stage) funnelMap[r.stage] = r.count; });
  const leadFunnel = funnelStages.map(stage => ({ status: stage, count: funnelMap[stage] || 0 }));

  const needsAttention = [
    {
      type: 'memberships',
      label: 'Memberships expiring soon',
      count: get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active' AND end_date <= ? AND end_date >= ?", [sevenDaysFromNow, today]).c,
      page: 'memberships'
    },
    {
      type: 'leads',
      label: 'Uncontacted leads',
      count: get("SELECT COUNT(*) as c FROM leads WHERE (status = 'NEW_LEAD' OR status = 'new_lead') AND created_at <= datetime('now', '-24 hours')").c,
      page: 'leads'
    },
    {
      type: 'payments',
      label: 'Unpaid invoices',
      count: get("SELECT COUNT(*) as c FROM invoices WHERE status = 'pending'").c,
      page: 'payments'
    },
    {
      type: 'inventory',
      label: 'Low stock items',
      count: get("SELECT COUNT(*) as c FROM products WHERE stock <= minimum_stock AND is_active = 1").c,
      page: 'inventory'
    },
    {
      type: 'tickets',
      label: 'Open support tickets',
      count: get("SELECT COUNT(*) as c FROM tickets WHERE status IN ('open', 'in_progress')").c,
      page: 'tickets'
    }
  ].filter(n => n.count > 0);

  res.json({
    total_members: get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active'").c,
    active_members: get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active' AND end_date >= date('now')").c,
    new_members_this_month: get("SELECT COUNT(*) as c FROM memberships WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").c,
    expiring_memberships: get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active' AND end_date <= ? AND end_date >= ?", [sevenDaysFromNow, today]).c,
    new_leads: get("SELECT COUNT(*) as c FROM leads WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").c,
    conversion_rate: leadsTotal > 0 ? Math.round((leadsConverted / leadsTotal) * 1000) / 10 : 0,
    today_revenue: get("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'completed' AND date(created_at) = date('now')").t,
    monthly_revenue: get("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'completed' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").t,
    outstanding_payments: get("SELECT COALESCE(SUM(balance), 0) as t FROM invoices WHERE status = 'pending'").t,
    today_attendance: get("SELECT COUNT(*) as c FROM attendance WHERE date = ?", [today]).c,
    active_pt_sessions: get("SELECT COUNT(*) as c FROM pt_sessions WHERE status = 'scheduled' AND scheduled_date = ?", [today]).c,
    classes_today: get("SELECT COUNT(*) as c FROM class_schedules cs JOIN classes c ON cs.class_id = c.id WHERE cs.day_of_week = ? AND c.is_active = 1", [new Date().toLocaleDateString('en-US', { weekday: 'long' })]).c,
    staff_present: staffPresent,
    staff_absent: Math.max(staffTotal - staffPresent, 0),
    open_tickets: get("SELECT COUNT(*) as c FROM tickets WHERE status IN ('open', 'in_progress')").c,
    low_stock_count: get("SELECT COUNT(*) as c FROM products WHERE stock <= minimum_stock AND is_active = 1").c,
    needs_attention: needsAttention,
    revenue_trend: all("SELECT date(created_at) as period, SUM(amount) as total FROM payments WHERE status = 'completed' AND created_at >= date('now', '-30 days') GROUP BY period ORDER BY period"),
    lead_funnel: leadFunnel,
    recent_leads: all("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5"),
    recent_payments: all("SELECT p.*, u.full_name FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 5")
  });
});

// ========== GLOBAL SEARCH ==========
router.get('/search', (req, res) => {
  const { q, type } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const term = `%${q}%`;
  const results = [];
  if (!type || type === 'members') {
    const members = all("SELECT id, full_name, email, phone, 'member' as type FROM users WHERE role = 'member' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?) LIMIT 10", [term, term, term]);
    results.push(...members);
  }
  if (!type || type === 'leads') {
    const leads = all("SELECT id, name, email, phone, status, 'lead' as type FROM leads WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? LIMIT 10", [term, term, term]);
    results.push(...leads);
  }
  if (!type || type === 'employees') {
    const emps = all("SELECT id, full_name, email, phone, department, 'employee' as type FROM employees WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ? LIMIT 10", [term, term, term]);
    results.push(...emps);
  }
  if (!type || type === 'invoices') {
    const inv = all("SELECT id, invoice_number, total, status, 'invoice' as type FROM invoices WHERE invoice_number LIKE ? LIMIT 10", [term]);
    results.push(...inv);
  }
  if (!type || type === 'payments') {
    const pays = all("SELECT id, payment_number, amount, status, 'payment' as type FROM payments WHERE payment_number LIKE ? LIMIT 10", [term]);
    results.push(...pays);
  }
  if (!type || type === 'products') {
    const prods = all("SELECT id, name, sku, 'product' as type FROM products WHERE name LIKE ? OR sku LIKE ? LIMIT 10", [term, term]);
    results.push(...prods);
  }
  if (!type || type === 'tickets') {
    const ticks = all("SELECT id, ticket_id, subject, status, 'ticket' as type FROM tickets WHERE ticket_id LIKE ? OR subject LIKE ? LIMIT 10", [term, term]);
    results.push(...ticks);
  }
  res.json(results);
});

// ========== USERS / MEMBERS ==========
router.get('/users', requirePerm('members', 'view'), (req, res) => {
  const { role, search, branch_id, status, page = 1, limit = 50 } = req.query;
  const p = parseInt(page) || 1;
  const l = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
  let sql = `SELECT u.*, mp.name as plan_name, m.status as membership_status, m.end_date as membership_end, b.name as branch_name
    FROM users u
    LEFT JOIN memberships m ON m.id = (SELECT id FROM memberships WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1)
    LEFT JOIN membership_plans mp ON m.plan_id = mp.id
    LEFT JOIN branches b ON m.branch_id = b.id`;
  const params = [];
  const conditions = [];
  if (role) { conditions.push('u.role = ?'); params.push(role); }
  if (search) { conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (branch_id) { conditions.push('m.branch_id = ?'); params.push(branch_id); }
  if (status === 'active') { conditions.push('u.is_active = 1'); }
  if (status === 'inactive') { conditions.push('u.is_active = 0'); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const countSource = `FROM users u
    LEFT JOIN memberships m ON m.id = (SELECT id FROM memberships WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1)
    LEFT JOIN membership_plans mp ON m.plan_id = mp.id
    LEFT JOIN branches b ON m.branch_id = b.id`;
  const total = get('SELECT COUNT(*)' + ' ' + countSource + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params).c;
  sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  const users = all(sql, params.concat(l, (p - 1) * l));
  users.forEach(u => delete u.password_hash);
  res.json({ items: users, total, page: p, limit: l });
});

router.get('/users/:id', requirePerm('members', 'view'), (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  delete user.password_hash;
  const membership = get('SELECT m.*, mp.name as plan_name FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 1', [req.params.id]);
  const recentAttendance = all('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT 10', [req.params.id]);
  const measurements = all('SELECT * FROM body_measurements WHERE user_id = ? ORDER BY measured_date DESC LIMIT 5', [req.params.id]);
  const ptAssignment = get('SELECT pta.*, e.full_name as trainer_name FROM pt_assignments pta JOIN employees e ON pta.trainer_id = e.id WHERE pta.user_id = ? AND pta.status = "active"', [req.params.id]);
  const workoutPlan = get('SELECT * FROM workout_plans WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1', [req.params.id]);
  const dietPlan = get('SELECT * FROM diet_plans WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1', [req.params.id]);
  const invoices = all('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
  const payments = all('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
  const tickets = all('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [req.params.id]);
  const timeline = all("SELECT 'membership' as type, created_at, 'Membership ' || status as description FROM memberships WHERE user_id = ? UNION ALL SELECT 'payment' as type, created_at, 'Payment of ₹' || amount as description FROM payments WHERE user_id = ? UNION ALL SELECT 'attendance' as type, date as created_at, 'Checked in' as description FROM attendance WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", [req.params.id, req.params.id, req.params.id]);
  res.json({ user, membership, recentAttendance, measurements, ptAssignment, workoutPlan, dietPlan, invoices, payments, tickets, timeline });
});

router.post('/users', requirePerm('members', 'create'), [
  body('email').isEmail().normalizeEmail(),
  body('full_name').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, full_name, phone, role, gender, date_of_birth, address, city, fitness_goals } = req.body;
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can create another super admin' });
  }
  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  const hash = bcrypt.hashSync(password || 'password123', 10);
  run('INSERT INTO users (email, password_hash, full_name, phone, role, gender, date_of_birth, address, city, fitness_goals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [email, hash, full_name, phone || '', role || 'member', gender || '', date_of_birth || '', address || '', city || '', fitness_goals || '']);
  const user = get('SELECT id, email, full_name, role FROM users WHERE email = ?', [email]);
  run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.full_name, 'CREATE', 'user', user.id, full_name]);
  res.json({ message: 'User created', user });
});

router.put('/users/:id', requirePerm('members', 'edit'), (req, res) => {
  const { full_name, phone, role, gender, date_of_birth, address, city, state, pincode, fitness_goals, height, weight, fitness_level, is_active } = req.body;
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can create another super admin' });
  }
  const prev = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  run('UPDATE users SET full_name=?, phone=?, role=?, gender=?, date_of_birth=?, address=?, city=?, state=?, pincode=?, fitness_goals=?, height=?, weight=?, fitness_level=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [full_name || prev.full_name, phone || prev.phone, role || prev.role, gender || prev.gender, date_of_birth || prev.date_of_birth, address || prev.address, city || prev.city, state || prev.state, pincode || prev.pincode, fitness_goals || prev.fitness_goals, height || prev.height, weight || prev.weight, fitness_level || prev.fitness_level, is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active, req.params.id]);
  run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.full_name, 'UPDATE', 'user', req.params.id, full_name || prev.full_name, JSON.stringify({ role: prev.role, is_active: prev.is_active }), JSON.stringify({ role, is_active })]);
  res.json({ message: 'User updated' });
});

router.delete('/users/:id', requirePerm('members', 'delete'), (req, res) => {
  run('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'User deactivated' });
});

// ========== MEMBERSHIP PLANS ==========
router.get('/plans', requirePerm('plans', 'view'), (req, res) => {
  res.json(all('SELECT * FROM membership_plans ORDER BY sort_order'));
});

router.get('/plans/:id', (req, res) => {
  const plan = get('SELECT * FROM membership_plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const memberCount = get("SELECT COUNT(*) as c FROM memberships WHERE plan_id = ? AND status = 'active'", [req.params.id]).c;
  const revenue = get("SELECT COALESCE(SUM(amount), 0) as t FROM payments p JOIN memberships m ON p.membership_id = m.id WHERE m.plan_id = ? AND p.status = 'completed'", [req.params.id]).t;
  res.json({ ...plan, memberCount, revenue });
});

router.post('/plans', requirePerm('plans', 'create'), (req, res) => {
  const p = req.body;
  run('INSERT INTO membership_plans (name, slug, description, price, original_price, duration_months, features, gym_access, class_access, pt_sessions, sauna_access, locker_included, guest_passes, nutrition_consultation, freeze_days, branch_access, terms_conditions, is_popular, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [p.name, p.slug, p.description, p.price, p.original_price, p.duration_months, JSON.stringify(p.features || []), p.gym_access ? 1 : 0, p.class_access ? 1 : 0, p.pt_sessions || 0, p.sauna_access ? 1 : 0, p.locker_included ? 1 : 0, p.guest_passes || 0, p.nutrition_consultation ? 1 : 0, p.freeze_days || 0, p.branch_access || 'all', p.terms_conditions || '', p.is_popular ? 1 : 0, p.is_active !== false ? 1 : 0, p.sort_order || 0]);
  res.json({ message: 'Plan created' });
});

router.put('/plans/:id', requirePerm('plans', 'edit'), (req, res) => {
  const p = req.body;
  run('UPDATE membership_plans SET name=?, slug=?, description=?, price=?, original_price=?, duration_months=?, features=?, gym_access=?, class_access=?, pt_sessions=?, sauna_access=?, locker_included=?, guest_passes=?, nutrition_consultation=?, freeze_days=?, branch_access=?, terms_conditions=?, is_popular=?, is_active=?, sort_order=? WHERE id=?',
    [p.name, p.slug, p.description, p.price, p.original_price, p.duration_months, JSON.stringify(p.features || []), p.gym_access ? 1 : 0, p.class_access ? 1 : 0, p.pt_sessions || 0, p.sauna_access ? 1 : 0, p.locker_included ? 1 : 0, p.guest_passes || 0, p.nutrition_consultation ? 1 : 0, p.freeze_days || 0, p.branch_access || 'all', p.terms_conditions || '', p.is_popular ? 1 : 0, p.is_active !== false ? 1 : 0, p.sort_order || 0, req.params.id]);
  res.json({ message: 'Plan updated' });
});

router.delete('/plans/:id', requirePerm('plans', 'delete'), (req, res) => {
  run('UPDATE membership_plans SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Plan deactivated' });
});

// ========== MEMBERSHIPS ==========
router.get('/memberships', requirePerm('memberships', 'view'), (req, res) => {
  const { status, plan_id, branch_id, search, page = 1, limit = 50 } = req.query;
  const p = parseInt(page) || 1;
  const l = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
  let sql = 'SELECT m.*, mp.name as plan_name, u.full_name, u.email, u.phone, b.name as branch_name FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id JOIN users u ON m.user_id = u.id LEFT JOIN branches b ON m.branch_id = b.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('m.status = ?'); params.push(status); }
  if (plan_id) { conditions.push('m.plan_id = ?'); params.push(plan_id); }
  if (branch_id) { conditions.push('m.branch_id = ?'); params.push(branch_id); }
  if (search) { conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR m.membership_id LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const total = get('SELECT COUNT(*) as c FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id JOIN users u ON m.user_id = u.id LEFT JOIN branches b ON m.branch_id = b.id' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params).c;
  sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  const memberships = all(sql, params.concat(l, (p - 1) * l));
  res.json({ items: memberships, total, page: p, limit: l });
});

router.get('/memberships/:id', requirePerm('memberships', 'view'), (req, res) => {
  const membership = get('SELECT m.*, mp.name as plan_name, mp.duration_months, mp.features, u.full_name, u.email, u.phone, b.name as branch_name FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id JOIN users u ON m.user_id = u.id LEFT JOIN branches b ON m.branch_id = b.id WHERE m.id = ?', [req.params.id]);
  if (!membership) return res.status(404).json({ error: 'Membership not found' });
  try { membership.features = JSON.parse(membership.features); } catch(e) { membership.features = []; }
  const payments = all("SELECT * FROM payments WHERE membership_id = ? OR user_id = ? ORDER BY created_at DESC LIMIT 10", [membership.id, membership.user_id]);
  const invoices = all('SELECT * FROM invoices WHERE membership_id = ? ORDER BY created_at DESC LIMIT 10', [membership.id]);
  const assignedTrainer = membership.assigned_trainer ? get('SELECT id, full_name FROM employees WHERE id = ?', [membership.assigned_trainer]) : null;
  const assignedSalesperson = membership.assigned_salesperson ? get('SELECT id, full_name FROM employees WHERE id = ?', [membership.assigned_salesperson]) : null;
  res.json({ membership, payments, invoices, assigned_trainer: assignedTrainer, assigned_salesperson: assignedSalesperson });
});

router.post('/memberships', requirePerm('memberships', 'create'), (req, res) => {
  const { user_id, plan_id, branch_id, start_date, end_date, discount, tax, payment_method, payment_reference, assigned_salesperson, assigned_trainer, notes, is_complimentary } = req.body;
  const plan = get('SELECT * FROM membership_plans WHERE id = ?', [plan_id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const user = get('SELECT id FROM users WHERE id = ?', [user_id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const complimentary = !!is_complimentary;
  const finalAmount = complimentary ? 0 : (plan.price - (discount || 0) + (tax || 0));
  const memId = 'MEM-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
  const dateAddition = (months) => {
    const d = new Date();
    d.setMonth(d.getMonth() + (months || 1));
    return d.toISOString().split('T')[0];
  };
  const noteText = notes || (payment_reference ? 'Payment ref: ' + payment_reference : '');
  const finalNotes = complimentary ? (noteText ? noteText + ' | Complimentary' : 'Complimentary membership') : noteText;
  run('INSERT INTO memberships (membership_id, user_id, plan_id, branch_id, status, start_date, end_date, assigned_salesperson, assigned_trainer, discount, tax, final_amount, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [memId, user_id, plan_id, branch_id || 1, 'active', start_date || new Date().toISOString().split('T')[0], end_date || dateAddition(plan.duration_months), assigned_salesperson || null, assigned_trainer || null, complimentary ? 0 : (discount || 0), complimentary ? 0 : (tax || 0), finalAmount, complimentary ? 'complimentary' : (payment_method || 'cash'), finalNotes]);
  run('UPDATE users SET role = "member" WHERE id = ?', [user_id]);
  const membershipRow = get('SELECT id FROM memberships WHERE membership_id = ?', [memId]);
  if (payment_reference) {
    run('INSERT INTO payments (user_id, membership_id, amount, method, transaction_ref, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user_id, membershipRow ? membershipRow.id : null, finalAmount || plan.price, payment_method || 'cash', payment_reference || '', 'completed', noteText]);
  }
  logAuditReq(req, { action: 'CREATE', entity_type: 'membership', entity_id: memId, entity_name: plan.name, new_value: { user_id, plan_id, final_amount: finalAmount, complimentary } });
  res.json({ message: 'Membership created', membership_id: memId });
});

router.put('/memberships/:id', requirePerm('memberships', 'edit'), (req, res) => {
  const { status, end_date, notes, freeze_reason } = req.body;
  const prev = get('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Membership not found' });
  const nextStatus = status || prev.status;
  run('UPDATE memberships SET status=?, end_date=?, notes=?, freeze_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [nextStatus, end_date || prev.end_date, notes || prev.notes, freeze_reason || prev.freeze_reason, req.params.id]);
  if (nextStatus === 'frozen') run('UPDATE memberships SET freeze_date = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  const user = get('SELECT id, full_name FROM users WHERE id = ?', [prev.user_id]);
  if (user) run("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
    [user.id, 'Membership updated', `Your membership has been updated (${nextStatus}).`]);
  logAuditReq(req, { action: 'UPDATE', entity_type: 'membership', entity_id: req.params.id, entity_name: prev.membership_id, previous_value: { status: prev.status }, new_value: { status: nextStatus } });
  res.json({ message: 'Membership updated' });
});

router.post('/memberships/:id/freeze', requirePerm('memberships', 'edit'), (req, res) => {
  const mem = get('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
  if (!mem) return res.status(404).json({ error: 'Membership not found' });
  if (mem.status === 'frozen') return res.status(400).json({ error: 'Membership already frozen' });
  const { reason } = req.body;
  run('UPDATE memberships SET status = "frozen", freeze_reason = ?, freeze_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [reason || '', req.params.id]);
  const user = get('SELECT id FROM users WHERE id = ?', [mem.user_id]);
  if (user) run("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Membership frozen', ?, 'info')",
    [user.id, reason ? `Your membership has been frozen. Reason: ${reason}` : 'Your membership has been frozen.']);
  logAuditReq(req, { action: 'FREEZE', entity_type: 'membership', entity_id: req.params.id, entity_name: mem.membership_id, new_value: { reason } });
  res.json({ message: 'Membership frozen' });
});

router.post('/memberships/:id/unfreeze', requirePerm('memberships', 'edit'), (req, res) => {
  const mem = get('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
  if (!mem) return res.status(404).json({ error: 'Membership not found' });
  if (mem.status !== 'frozen') return res.status(400).json({ error: 'Membership is not frozen' });
  run('UPDATE memberships SET status = "active", freeze_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  const user = get('SELECT id FROM users WHERE id = ?', [mem.user_id]);
  if (user) run("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Membership unfrozen', 'Your membership is active again.', 'info')", [user.id]);
  logAuditReq(req, { action: 'UNFREEZE', entity_type: 'membership', entity_id: req.params.id, entity_name: mem.membership_id });
  res.json({ message: 'Membership unfrozen' });
});

router.post('/memberships/:id/cancel', requirePerm('memberships', 'edit'), (req, res) => {
  const mem = get('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
  if (!mem) return res.status(404).json({ error: 'Membership not found' });
  const { reason } = req.body;
  run('UPDATE memberships SET status = "cancelled", notes = CASE WHEN ? = "" THEN notes ELSE notes || " | Cancelled: " || ? END, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [reason || '', reason || '', req.params.id]);
  const user = get('SELECT id FROM users WHERE id = ?', [mem.user_id]);
  if (user) run("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Membership cancelled', 'Your membership has been cancelled.', 'warning')", [user.id]);
  logAuditReq(req, { action: 'CANCEL', entity_type: 'membership', entity_id: req.params.id, entity_name: mem.membership_id, new_value: { reason } });
  res.json({ message: 'Membership cancelled' });
});

router.post('/memberships/:id/renew', requirePerm('memberships', 'edit'), (req, res) => {
  const mem = get('SELECT m.*, mp.duration_months, mp.price, mp.name as plan_name FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.id = ?', [req.params.id]);
  if (!mem) return res.status(404).json({ error: 'Membership not found' });
  const base = new Date(mem.end_date > new Date().toISOString().split('T')[0] ? mem.end_date : new Date().toISOString().split('T')[0]);
  const newEnd = new Date(base);
  newEnd.setMonth(newEnd.getMonth() + mem.duration_months);
  run('UPDATE memberships SET status = "active", start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [base.toISOString().split('T')[0], newEnd.toISOString().split('T')[0], req.params.id]);
  const user = get('SELECT id FROM users WHERE id = ?', [mem.user_id]);
  if (user) run("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Membership renewed', ?, 'success')",
    [user.id, `Your ${mem.plan_name} membership has been renewed.`]);
  logAuditReq(req, { action: 'RENEW', entity_type: 'membership', entity_id: req.params.id, entity_name: mem.membership_id, new_value: { new_end: newEnd.toISOString().split('T')[0] } });
  res.json({ message: 'Membership renewed', new_end_date: newEnd.toISOString().split('T')[0] });
});

router.post('/memberships/:id/transfer', requirePerm('memberships', 'edit'), (req, res) => {
  const { new_user_id } = req.body;
  const prev = get('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Membership not found' });
  run('UPDATE memberships SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [new_user_id, req.params.id]);
  logAuditReq(req, { action: 'TRANSFER', entity_type: 'membership', entity_id: req.params.id, entity_name: prev.membership_id, previous_value: { user_id: prev.user_id }, new_value: { user_id: new_user_id } });
  res.json({ message: 'Membership transferred' });
});

// ========== BRANCHES ==========
router.get('/branches', (req, res) => {
  const branches = all('SELECT b.*, e.full_name as manager_name FROM branches b LEFT JOIN employees e ON b.manager_id = e.id ORDER BY b.name');
  branches.forEach(b => {
    b.memberCount = get("SELECT COUNT(*) as c FROM memberships WHERE branch_id = ? AND status = 'active'", [b.id]).c;
    b.revenue = get("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE branch_id = ? AND status = 'completed'", [b.id]).t;
  });
  res.json(branches);
});

router.post('/branches', (req, res) => {
  const b = req.body;
  run('INSERT INTO branches (name, slug, address, city, state, pincode, phone, email, manager_id, opening_hours, facilities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [b.name, b.slug, b.address, b.city, b.state, b.pincode, b.phone, b.email, b.manager_id || null, JSON.stringify(b.opening_hours || {}), JSON.stringify(b.facilities || [])]);
  res.json({ message: 'Branch created' });
});

router.put('/branches/:id', (req, res) => {
  const b = req.body;
  run('UPDATE branches SET name=?, slug=?, address=?, city=?, state=?, pincode=?, phone=?, email=?, manager_id=?, opening_hours=?, facilities=? WHERE id=?',
    [b.name, b.slug, b.address, b.city, b.state, b.pincode, b.phone, b.email, b.manager_id || null, JSON.stringify(b.opening_hours || {}), JSON.stringify(b.facilities || []), req.params.id]);
  res.json({ message: 'Branch updated' });
});

// ========== ATTENDANCE ==========
router.get('/attendance', (req, res) => {
  const { date, user_id, branch_id, page = 1, limit = 100 } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  let sql = 'SELECT a.*, u.full_name, u.email, u.phone FROM attendance a JOIN users u ON a.user_id = u.id';
  const params = [];
  const conditions = ['a.date = ?'];
  params.push(targetDate);
  if (user_id) { conditions.push('a.user_id = ?'); params.push(user_id); }
  if (branch_id) { conditions.push('a.branch_id = ?'); params.push(branch_id); }
  sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY a.check_in DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const records = all(sql, params);
  const total = get("SELECT COUNT(*) as c FROM attendance a JOIN users u ON a.user_id = u.id WHERE " + conditions.join(' AND '), params.slice(0, params.length - 2)).c;
  const summary = {
    total: get("SELECT COUNT(*) as c FROM attendance WHERE date = ?", [targetDate]).c,
    checkedIn: get("SELECT COUNT(*) as c FROM attendance WHERE date = ? AND check_out IS NULL", [targetDate]).c,
    checkedOut: get("SELECT COUNT(*) as c FROM attendance WHERE date = ? AND check_out IS NOT NULL", [targetDate]).c,
    peakHour: get("SELECT substr(check_in, 1, 2) as hour, COUNT(*) as count FROM attendance WHERE date = ? GROUP BY hour ORDER BY count DESC LIMIT 1", [targetDate])
  };
  res.json({ items: records, total, summary, page: 1, limit: records.length });
});

router.post('/attendance/checkin', (req, res) => {
  const { user_id, branch_id, entry_method } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const existing = get("SELECT id FROM attendance WHERE user_id = ? AND date = ? AND check_out IS NULL", [user_id, today]);
  if (existing) return res.status(400).json({ error: 'Already checked in' });
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  run('INSERT INTO attendance (user_id, branch_id, check_in, entry_method, date) VALUES (?, ?, ?, ?, ?)',
    [user_id, branch_id || 1, time, entry_method || 'manual', today]);
  run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_name) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, req.user.full_name, 'CHECKIN', 'attendance', `User #${user_id} checked in`]);
  res.json({ message: 'Checked in successfully', time });
});

router.post('/attendance/checkout', (req, res) => {
  const { user_id } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const record = get("SELECT * FROM attendance WHERE user_id = ? AND date = ? AND check_out IS NULL", [user_id, today]);
  if (!record) return res.status(400).json({ error: 'No active check-in found' });
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const checkInParts = record.check_in.split(':');
  const duration = (now.getHours() - parseInt(checkInParts[0])) * 60 + (now.getMinutes() - parseInt(checkInParts[1]));
  run('UPDATE attendance SET check_out = ?, duration_minutes = ? WHERE id = ?', [time, Math.max(duration, 0), record.id]);
  res.json({ message: 'Checked out successfully', duration: Math.max(duration, 0) });
});

router.get('/attendance/report', (req, res) => {
  const { start_date, end_date, branch_id, user_id } = req.query;
  const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = end_date || new Date().toISOString().split('T')[0];
  let sql = "SELECT date, COUNT(*) as count, AVG(duration_minutes) as avg_duration FROM attendance WHERE date BETWEEN ? AND ?";
  const params = [start, end];
  if (branch_id) { sql += ' AND branch_id = ?'; params.push(branch_id); }
  if (user_id) { sql += ' AND user_id = ?'; params.push(user_id); }
  sql += ' GROUP BY date ORDER BY date';
  const daily = all(sql, params);
  const totalDays = all("SELECT COUNT(DISTINCT date) as days FROM attendance WHERE date BETWEEN ? AND ?", [start, end])[0].days;
  const totalCheckins = daily.reduce((sum, d) => sum + d.count, 0);
  res.json({ daily, totalDays, totalCheckins, avgDaily: totalDays ? (totalCheckins / totalDays).toFixed(1) : 0 });
});

// ========== CLASSES ==========
router.get('/classes', (req, res) => {
  const classes = all('SELECT c.*, e.full_name as trainer_name, b.name as branch_name FROM classes c LEFT JOIN employees e ON c.trainer_id = e.id LEFT JOIN branches b ON c.branch_id = b.id ORDER BY c.id');
  classes.forEach(c => {
    c.bookedCount = get("SELECT COUNT(*) as c FROM class_bookings WHERE class_id = ? AND status = 'booked' AND booking_date = date('now')", [c.id]).c;
  });
  res.json(classes);
});

router.post('/classes', (req, res) => {
  const c = req.body;
  run('INSERT INTO classes (name, slug, description, trainer_id, branch_id, duration_minutes, difficulty, category, max_participants, room, image, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [c.name, c.slug, c.description, c.trainer_id, c.branch_id, c.duration_minutes || 60, c.difficulty || 'intermediate', c.category, c.max_participants || 20, c.room, c.image, c.is_active !== false ? 1 : 0]);
  res.json({ message: 'Class created' });
});

router.put('/classes/:id', (req, res) => {
  const c = req.body;
  run('UPDATE classes SET name=?, slug=?, description=?, trainer_id=?, branch_id=?, duration_minutes=?, difficulty=?, category=?, max_participants=?, room=?, image=?, is_active=? WHERE id=?',
    [c.name, c.slug, c.description, c.trainer_id, c.branch_id, c.duration_minutes, c.difficulty, c.category, c.max_participants, c.room, c.image, c.is_active ? 1 : 0, req.params.id]);
  res.json({ message: 'Class updated' });
});

router.get('/class-schedules', (req, res) => {
  const schedules = all('SELECT cs.*, c.name as class_name, c.duration_minutes, c.category, e.full_name as trainer_name FROM class_schedules cs JOIN classes c ON cs.class_id = c.id LEFT JOIN employees e ON c.trainer_id = e.id ORDER BY CASE cs.day_of_week WHEN "Monday" THEN 1 WHEN "Tuesday" THEN 2 WHEN "Wednesday" THEN 3 WHEN "Thursday" THEN 4 WHEN "Friday" THEN 5 WHEN "Saturday" THEN 6 WHEN "Sunday" THEN 7 END, cs.start_time');
  res.json(schedules);
});

router.post('/class-schedules', (req, res) => {
  const s = req.body;
  run('INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, location) VALUES (?, ?, ?, ?, ?)',
    [s.class_id, s.day_of_week, s.start_time, s.end_time, s.location]);
  res.json({ message: 'Schedule created' });
});

router.delete('/class-schedules/:id', (req, res) => {
  run('DELETE FROM class_schedules WHERE id = ?', [req.params.id]);
  res.json({ message: 'Schedule deleted' });
});

router.get('/class-bookings', (req, res) => {
  const { class_id, user_id, date, status } = req.query;
  let sql = 'SELECT cb.*, c.name as class_name, u.full_name, u.email FROM class_bookings cb JOIN classes c ON cb.class_id = c.id JOIN users u ON cb.user_id = u.id';
  const params = [];
  const conditions = [];
  if (class_id) { conditions.push('cb.class_id = ?'); params.push(class_id); }
  if (user_id) { conditions.push('cb.user_id = ?'); params.push(user_id); }
  if (date) { conditions.push('cb.booking_date = ?'); params.push(date); }
  if (status) { conditions.push('cb.status = ?'); params.push(status); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY cb.created_at DESC';
  res.json(all(sql, params));
});

// ========== PERSONAL TRAINING ==========
router.get('/pt/assignments', (req, res) => {
  const { status, trainer_id } = req.query;
  let sql = 'SELECT pta.*, u.full_name as member_name, u.phone as member_phone, e.full_name as trainer_name, pp.name as package_name FROM pt_assignments pta JOIN users u ON pta.user_id = u.id JOIN employees e ON pta.trainer_id = e.id LEFT JOIN pt_packages pp ON pta.package_id = pp.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('pta.status = ?'); params.push(status); }
  if (trainer_id) { conditions.push('pta.trainer_id = ?'); params.push(trainer_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY pta.created_at DESC';
  res.json(all(sql, params));
});

router.post('/pt/assignments', (req, res) => {
  const { user_id, trainer_id, package_id, sessions_total, start_date, end_date } = req.body;
  const pkg = package_id ? get('SELECT * FROM pt_packages WHERE id = ?', [package_id]) : null;
  const sessions = sessions_total || (pkg ? pkg.sessions : 8);
  run('INSERT INTO pt_assignments (user_id, trainer_id, package_id, sessions_total, sessions_remaining, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id, trainer_id, package_id || null, sessions, sessions, start_date || new Date().toISOString().split('T')[0], end_date, 'active']);
  res.json({ message: 'PT assignment created' });
});

router.get('/pt/sessions', (req, res) => {
  const { date, trainer_id, user_id, status } = req.query;
  let sql = 'SELECT pts.*, u.full_name as member_name, e.full_name as trainer_name FROM pt_sessions pts JOIN users u ON pts.user_id = u.id JOIN employees e ON pts.trainer_id = e.id';
  const params = [];
  const conditions = [];
  if (date) { conditions.push('pts.scheduled_date = ?'); params.push(date); }
  if (trainer_id) { conditions.push('pts.trainer_id = ?'); params.push(trainer_id); }
  if (user_id) { conditions.push('pts.user_id = ?'); params.push(user_id); }
  if (status) { conditions.push('pts.status = ?'); params.push(status); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY pts.scheduled_date, pts.scheduled_time';
  res.json(all(sql, params));
});

router.put('/pt/sessions/:id', (req, res) => {
  const { status, notes, trainer_notes, rating, feedback } = req.body;
  const prev = get('SELECT * FROM pt_sessions WHERE id = ?', [req.params.id]);
  run('UPDATE pt_sessions SET status=?, notes=?, trainer_notes=?, rating=?, feedback=?, completed_at=? WHERE id=?',
    [status || prev.status, notes || prev.notes, trainer_notes || prev.trainer_notes, rating || prev.rating, feedback || prev.feedback, status === 'completed' ? new Date().toISOString() : prev.completed_at, req.params.id]);
  if (status === 'completed' && prev.status !== 'completed') {
    run('UPDATE pt_assignments SET sessions_completed = sessions_completed + 1, sessions_remaining = sessions_remaining - 1 WHERE id = ?', [prev.assignment_id]);
  } else if (status !== 'completed' && prev.status === 'completed') {
    run('UPDATE pt_assignments SET sessions_completed = sessions_completed - 1, sessions_remaining = sessions_remaining + 1 WHERE id = ?', [prev.assignment_id]);
  }
  res.json({ message: 'Session updated' });
});

router.get('/pt/packages', (req, res) => {
  res.json(all('SELECT * FROM pt_packages WHERE is_active = 1 ORDER BY sessions'));
});

router.post('/pt/packages', (req, res) => {
  const { name, sessions, price, duration_days, description } = req.body;
  run('INSERT INTO pt_packages (name, sessions, price, duration_days, description) VALUES (?, ?, ?, ?, ?)', [name, sessions, price, duration_days || 30, description || '']);
  res.json({ message: 'Package created' });
});

// ========== WORKOUTS ==========
router.get('/workout-plans', (req, res) => {
  const plans = all('SELECT wp.*, u.full_name as member_name, e.full_name as trainer_name FROM workout_plans wp LEFT JOIN users u ON wp.user_id = u.id LEFT JOIN employees e ON wp.trainer_id = e.id ORDER BY wp.created_at DESC');
  plans.forEach(p => {
    p.days = all('SELECT * FROM workout_days WHERE plan_id = ? ORDER BY day_number', [p.id]);
    p.days.forEach(d => {
      d.exercises = all('SELECT * FROM workout_exercises WHERE day_id = ? ORDER BY sort_order', [d.id]);
    });
  });
  res.json(plans);
});

router.post('/workout-plans', (req, res) => {
  const { user_id, trainer_id, name, description, duration_weeks, difficulty, goal, days } = req.body;
  run('INSERT INTO workout_plans (user_id, trainer_id, name, description, duration_weeks, difficulty, goal) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user_id || null, trainer_id || null, name, description || '', duration_weeks || 4, difficulty || 'intermediate', goal || '']);
  const planId = get("SELECT last_insert_rowid() as id").id;
  if (days && days.length) {
    days.forEach((day, idx) => {
      run('INSERT INTO workout_days (plan_id, day_number, day_name, focus, notes) VALUES (?, ?, ?, ?, ?)',
        [planId, idx + 1, day.day_name, day.focus || '', day.notes || '']);
      const dayId = get("SELECT last_insert_rowid() as id").id;
      if (day.exercises && day.exercises.length) {
        day.exercises.forEach((ex, ei) => {
          run('INSERT INTO workout_exercises (day_id, exercise_name, sets, reps, weight, rest_seconds, tempo, notes, video_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [dayId, ex.exercise_name, ex.sets || 3, ex.reps || '10', ex.weight || '', ex.rest_seconds || 60, ex.tempo || '', ex.notes || '', ex.video_url || '', ei + 1]);
        });
      }
    });
  }
  res.json({ message: 'Workout plan created', id: planId });
});

router.get('/exercise-library', (req, res) => {
  const { category, muscle_group, search } = req.query;
  let sql = 'SELECT * FROM exercise_library';
  const params = [];
  const conditions = [];
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (muscle_group) { conditions.push('muscle_group = ?'); params.push(muscle_group); }
  if (search) { conditions.push('name LIKE ?'); params.push(`%${search}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY name';
  res.json(all(sql, params));
});

// ========== DIET PLANS ==========
router.get('/diet-plans', (req, res) => {
  const plans = all('SELECT dp.*, u.full_name as member_name FROM diet_plans dp LEFT JOIN users u ON dp.user_id = u.id ORDER BY dp.created_at DESC');
  res.json(plans);
});

router.post('/diet-plans', (req, res) => {
  const { user_id, name, description, total_calories, protein_grams, carbs_grams, fats_grams, meals, supplements, water_intake_ml, notes, start_date } = req.body;
  run('INSERT INTO diet_plans (user_id, name, description, total_calories, protein_grams, carbs_grams, fats_grams, meals, supplements, water_intake_ml, notes, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id || null, name, description || '', total_calories || 2000, protein_grams || 150, carbs_grams || 200, fats_grams || 70, JSON.stringify(meals || []), JSON.stringify(supplements || []), water_intake_ml || 3000, notes || '', start_date || new Date().toISOString().split('T')[0]]);
  res.json({ message: 'Diet plan created' });
});

// ========== BODY MEASUREMENTS ==========
router.get('/measurements', (req, res) => {
  const { user_id } = req.query;
  let sql = 'SELECT bm.*, u.full_name FROM body_measurements bm JOIN users u ON bm.user_id = u.id';
  const params = [];
  if (user_id) { sql += ' WHERE bm.user_id = ?'; params.push(user_id); }
  sql += ' ORDER BY bm.measured_date DESC';
  res.json(all(sql, params));
});

router.post('/measurements', (req, res) => {
  const { user_id, weight, height, body_fat, chest, waist, arms, thighs, hips, shoulders, neck, calves, notes } = req.body;
  const bmi = height ? (weight / ((height / 100) ** 2)).toFixed(1) : null;
  run('INSERT INTO body_measurements (user_id, weight, height, bmi, body_fat, chest, waist, arms, thighs, hips, shoulders, neck, calves, notes, measured_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id, weight || null, height || null, bmi, body_fat || null, chest || null, waist || null, arms || null, thighs || null, hips || null, shoulders || null, neck || null, calves || null, notes || '', new Date().toISOString().split('T')[0]]);
  run('UPDATE users SET weight = ?, height = ? WHERE id = ?', [weight || null, height || null, user_id]);
  res.json({ message: 'Measurements recorded', bmi });
});

// ========== CRM / LEADS ==========
router.get('/leads', (req, res) => {
  const { status, source, assigned_salesperson, search, page = 1, limit = 50 } = req.query;
  const p2 = parseInt(page) || 1;
  const l2 = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
  let sql2 = 'SELECT l.*, e.full_name as salesperson_name FROM leads l LEFT JOIN employees e ON l.assigned_salesperson = e.id';
  const params2 = [];
  const conditions2 = [];
  if (status) { conditions2.push('l.status = ?'); params2.push(status); }
  if (source) { conditions2.push('l.source = ?'); params2.push(source); }
  if (assigned_salesperson) { conditions2.push('l.assigned_salesperson = ?'); params2.push(assigned_salesperson); }
  if (search) { conditions2.push('(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)'); params2.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (conditions2.length) sql2 += ' WHERE ' + conditions2.join(' AND ');
  const total2 = get("SELECT COUNT(*) as c FROM leads" + (conditions2.length ? ' WHERE ' + conditions2.join(' AND ') : ''), params2).c;
  sql2 += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  const leads = all(sql2, params2.concat(l2, (p2 - 1) * l2));
  res.json({ items: leads, total: total2, page: p2, limit: l2 });
});

router.get('/leads/pipeline', (req, res) => {
  const pipeline = ['new_lead', 'contacted', 'interested', 'trial_booked', 'trial_attended', 'negotiation', 'payment_pending', 'converted', 'lost'];
  const upper = { new_lead: 'NEW_LEAD', contacted: 'CONTACTED', interested: 'INTERESTED', trial_booked: 'TRIAL_BOOKED', trial_attended: 'TRIAL_ATTENDED', negotiation: 'NEGOTIATION', payment_pending: 'PAYMENT_PENDING', converted: 'CONVERTED', lost: 'LOST' };
  const result = { stages: pipeline };
  pipeline.forEach(stage => {
    const leads = all(`SELECT l.*, e.full_name as salesperson_name FROM leads l LEFT JOIN employees e ON l.assigned_salesperson = e.id WHERE (l.status = ? OR l.status = ?) ORDER BY l.created_at DESC`, [stage, upper[stage]]);
    result[stage] = leads;
    result[upper[stage]] = leads;
  });
  res.json(result);
});

router.post('/leads', requirePerm('leads', 'create'), (req, res) => {
  const { source, name, phone, email, gender, age, fitness_goal, interested_plan, preferred_branch, preferred_date, preferred_time, message, assigned_salesperson, notes, tags } = req.body;
  const leadId = 'LD-' + Date.now().toString(36).toUpperCase();
  run('INSERT INTO leads (lead_id, source, name, phone, email, gender, age, fitness_goal, interested_plan, preferred_branch, preferred_date, preferred_time, message, assigned_salesperson, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [leadId, source || 'website', name, phone || '', email || '', gender || '', age || null, fitness_goal || '', interested_plan || '', preferred_branch || null, preferred_date || '', preferred_time || '', message || '', assigned_salesperson || null, notes || '', JSON.stringify(tags || [])]);
  run('INSERT INTO notifications (user_id, title, message, type, module) VALUES (?, ?, ?, ?, ?)',
    [assigned_salesperson, 'New Lead Assigned', `New lead ${name} has been assigned to you.`, 'info', 'crm']);
  res.json({ message: 'Lead created', lead_id: leadId });
});

router.put('/leads/:id', requirePerm('leads', 'edit'), (req, res) => {
  const { status, notes, assigned_salesperson, lead_score, next_followup_date } = req.body;
  const prev = get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
  const canonical = {
    NEW_LEAD: 'new_lead', CONTACTED: 'contacted', INTERESTED: 'interested', TRIAL_BOOKED: 'trial_booked', TRIAL_ATTENDED: 'trial_attended', NEGOTIATION: 'negotiation', PAYMENT_PENDING: 'payment_pending', CONVERTED: 'converted', LOST: 'lost'
  };
  const nextStatus = status ? (canonical[String(status).toUpperCase()] || status) : prev.status;
  run('UPDATE leads SET status=?, notes=?, assigned_salesperson=?, lead_score=?, next_followup_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [nextStatus, notes || prev.notes, assigned_salesperson || prev.assigned_salesperson, lead_score || prev.lead_score, next_followup_date || prev.next_followup_date, req.params.id]);
  if (nextStatus === 'converted') {
    run("UPDATE leads SET conversion_date = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
  }
  logAuditReq(req, { action: 'UPDATE', entity_type: 'lead', entity_id: req.params.id, entity_name: prev.name, previous_value: { status: prev.status }, new_value: { status: nextStatus } });
  res.json({ message: 'Lead updated' });
});

router.post('/leads/:id/followup', (req, res) => {
  const { followup_type, note, outcome, next_followup_date } = req.body;
  run('INSERT INTO lead_followups (lead_id, admin_id, followup_type, note, outcome, next_followup_date) VALUES (?, ?, ?, ?, ?, ?)',
    [req.params.id, req.user.id, followup_type || 'call', note || '', outcome || '', next_followup_date || null]);
  run('INSERT INTO lead_activities (lead_id, user_id, activity_type, description, outcome) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, req.user.id, followup_type || 'call', note || '', outcome || '']);
  if (next_followup_date) {
    run('UPDATE leads SET next_followup_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next_followup_date, req.params.id]);
  }
  res.json({ message: 'Follow-up added' });
});

router.get('/leads/:id/activities', (req, res) => {
  const activities = all('SELECT la.*, u.full_name as user_name FROM lead_activities la LEFT JOIN users u ON la.user_id = u.id WHERE la.lead_id = ? ORDER BY la.created_at DESC', [req.params.id]);
  const followups = all('SELECT lf.*, u.full_name as admin_name FROM lead_followups lf LEFT JOIN users u ON lf.admin_id = u.id WHERE lf.lead_id = ? ORDER BY lf.created_at DESC', [req.params.id]);
  res.json({ activities, followups });
});

// ========== EMPLOYEES / HR ==========
router.get('/employees', (req, res) => {
  const { department, branch_id, search, is_active } = req.query;
  let sql = 'SELECT e.*, b.name as branch_name, m.full_name as manager_name FROM employees e LEFT JOIN branches b ON e.branch_id = b.id LEFT JOIN employees m ON e.manager_id = m.id';
  const params = [];
  const conditions = [];
  if (department) { conditions.push('e.department = ?'); params.push(department); }
  if (branch_id) { conditions.push('e.branch_id = ?'); params.push(branch_id); }
  if (search) { conditions.push('(e.full_name LIKE ? OR e.email LIKE ? OR e.phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (is_active !== undefined) { conditions.push('e.is_active = ?'); params.push(is_active === 'true' ? 1 : 0); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY e.full_name';
  const employees = all(sql, params);
  employees.forEach(e => {
    e.user = get('SELECT id, email, role FROM users WHERE email = ?', [e.email]);
  });
  res.json(employees);
});

router.post('/employees', (req, res) => {
  const e = req.body;
  const empId = 'E' + String(Date.now()).slice(-4);
  run('INSERT INTO employees (employee_id, full_name, email, phone, department, designation, branch_id, manager_id, joining_date, salary, salary_type, bank_account, ifsc_code, pan_number, aadhar_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [empId, e.full_name, e.email, e.phone, e.department, e.designation, e.branch_id || null, e.manager_id || null, e.joining_date || new Date().toISOString().split('T')[0], e.salary || 0, e.salary_type || 'monthly', e.bank_account || '', e.ifsc_code || '', e.pan_number || '', e.aadhar_number || '']);
  if (e.email && e.password) {
    const hash = bcrypt.hashSync(e.password, 10);
    run('INSERT INTO users (email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?)',
      [e.email, hash, e.full_name, e.phone || '', e.role || 'staff']);
    const user = get('SELECT id FROM users WHERE email = ?', [e.email]);
    if (user) run('UPDATE employees SET user_id = ? WHERE email = ?', [user.id, e.email]);
  }
  res.json({ message: 'Employee created' });
});

router.put('/employees/:id', (req, res) => {
  const e = req.body;
  run('UPDATE employees SET full_name=?, email=?, phone=?, department=?, designation=?, branch_id=?, manager_id=?, salary=?, bank_account=?, ifsc_code=?, pan_number=?, aadhar_number=?, is_active=? WHERE id=?',
    [e.full_name, e.email, e.phone, e.department, e.designation, e.branch_id, e.manager_id, e.salary, e.bank_account, e.ifsc_code, e.pan_number, e.aadhar_number, e.is_active !== undefined ? (e.is_active ? 1 : 0) : 1, req.params.id]);
  res.json({ message: 'Employee updated' });
});

router.get('/employee-attendance', (req, res) => {
  const { date, employee_id, month, year } = req.query;
  let sql = 'SELECT ea.*, e.full_name, e.department FROM employee_attendance ea JOIN employees e ON ea.employee_id = e.id';
  const params = [];
  const conditions = [];
  if (date) { conditions.push('ea.date = ?'); params.push(date); }
  if (employee_id) { conditions.push('ea.employee_id = ?'); params.push(employee_id); }
  if (month && year) { conditions.push("strftime('%m', ea.date) = ? AND strftime('%Y', ea.date) = ?", [String(month).padStart(2, '0'), String(year)]); params.push(String(month).padStart(2, '0'), String(year)); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY ea.date DESC, ea.check_in DESC';
  res.json(all(sql, params));
});

router.post('/employee-attendance', (req, res) => {
  const { employee_id, date, check_in, check_out, status, notes } = req.body;
  const workingHours = check_in && check_out ? ((parseInt(check_out.split(':')[0]) * 60 + parseInt(check_out.split(':')[1])) - (parseInt(check_in.split(':')[0]) * 60 + parseInt(check_in.split(':')[1]))) / 60 : 0;
  run('INSERT INTO employee_attendance (employee_id, date, check_in, check_out, working_hours, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [employee_id, date || new Date().toISOString().split('T')[0], check_in || '', check_out || '', workingHours, status || 'present', notes || '']);
  res.json({ message: 'Attendance recorded' });
});

router.get('/leave-requests', (req, res) => {
  const { employee_id, status } = req.query;
  let sql = 'SELECT lr.*, e.full_name, e.department FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id';
  const params = [];
  const conditions = [];
  if (employee_id) { conditions.push('lr.employee_id = ?'); params.push(employee_id); }
  if (status) { conditions.push('lr.status = ?'); params.push(status); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY lr.created_at DESC';
  res.json(all(sql, params));
});

router.post('/leave-requests', (req, res) => {
  const { employee_id, leave_type, start_date, end_date, days, reason } = req.body;
  run('INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [employee_id, leave_type, start_date, end_date, days || 1, reason || '', 'pending']);
  res.json({ message: 'Leave request submitted' });
});

router.put('/leave-requests/:id', (req, res) => {
  const { status } = req.body;
  run('UPDATE leave_requests SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, req.user.id, req.params.id]);
  res.json({ message: 'Leave request updated' });
});

router.get('/payroll', (req, res) => {
  const { month, year, employee_id } = req.query;
  let sql = 'SELECT p.*, e.full_name, e.department, e.designation FROM payroll p JOIN employees e ON p.employee_id = e.id';
  const params = [];
  const conditions = [];
  if (month) { conditions.push('p.month = ?'); params.push(month); }
  if (year) { conditions.push('p.year = ?'); params.push(year); }
  if (employee_id) { conditions.push('p.employee_id = ?'); params.push(employee_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY p.year DESC, p.month DESC';
  res.json(all(sql, params));
});

// ========== FINANCE ==========
router.get('/invoices', (req, res) => {
  const { status, user_id, search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT i.*, u.full_name, u.email FROM invoices i JOIN users u ON i.user_id = u.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('i.status = ?'); params.push(status); }
  if (user_id) { conditions.push('i.user_id = ?'); params.push(user_id); }
  if (search) { conditions.push('(i.invoice_number LIKE ? OR u.full_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const totalInv = get('SELECT COUNT(*) as c FROM invoices i JOIN users u ON i.user_id = u.id' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params).c;
  sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
  const invoices = all(sql, params.concat(parseInt(limit), (parseInt(page) - 1) * parseInt(limit)));
  invoices.forEach(inv => {
    inv.items = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
  });
  res.json({ items: invoices, total: totalInv, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/invoices', (req, res) => {
  const { user_id, membership_id, items, discount, tax_rate, due_date, notes } = req.body;
  const invoiceNumber = 'INV-' + Date.now().toString(36).toUpperCase();
  let subtotal = 0;
  if (items && items.length) {
    items.forEach(item => { subtotal += (item.quantity || 1) * (item.unit_price || 0); });
  }
  const discountAmount = discount || 0;
  const tax = tax_rate || 18;
  const taxAmount = Math.round((subtotal - discountAmount) * tax / 100);
  const total = subtotal - discountAmount + taxAmount;
  run('INSERT INTO invoices (invoice_number, user_id, membership_id, subtotal, discount, tax_rate, tax_amount, total, balance, status, due_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [invoiceNumber, user_id, membership_id || null, subtotal, discountAmount, tax, taxAmount, total, total, 'pending', due_date || new Date().toISOString().split('T')[0], notes || '', req.user.id]);
  const invoiceId = get("SELECT last_insert_rowid() as id").id;
  if (items && items.length) {
    items.forEach(item => {
      const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
      run('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total, item_type) VALUES (?, ?, ?, ?, ?, ?)',
        [invoiceId, item.description, item.quantity || 1, item.unit_price || 0, itemTotal, item.item_type || 'membership']);
    });
  }
  res.json({ message: 'Invoice created', invoice_number: invoiceNumber });
});

router.get('/payments', requirePerm('payments', 'view'), (req, res) => {
  const { status, method, user_id, date, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT p.*, u.full_name FROM payments p JOIN users u ON p.user_id = u.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('p.status = ?'); params.push(status); }
  if (method) { conditions.push('p.method = ?'); params.push(method); }
  if (user_id) { conditions.push('p.user_id = ?'); params.push(user_id); }
  if (date) { conditions.push("date(p.created_at) = ?"); params.push(date); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const totalPays = get('SELECT COUNT(*) as c FROM payments p JOIN users u ON p.user_id = u.id' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params).c;
  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const payments = all(sql, params);
  res.json({ items: payments, total: totalPays, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/payments', requirePerm('payments', 'create'), (req, res) => {
  const { invoice_id, user_id, amount, method, transaction_ref, membership_id, notes } = req.body;
  const paymentNumber = 'PAY-' + Date.now().toString(36).toUpperCase();
  run('INSERT INTO payments (payment_number, invoice_id, membership_id, user_id, amount, method, transaction_ref, status, branch_id, received_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [paymentNumber, invoice_id || null, membership_id || null, user_id, amount, method || 'cash', transaction_ref || '', 'completed', req.body.branch_id || 1, req.user.id, notes || '']);
  if (invoice_id) {
    const invoice = get('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
    if (invoice) {
      const newPaid = invoice.amount_paid + amount;
      const newBalance = invoice.total - newPaid;
      run('UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?',
        [newPaid, Math.max(newBalance, 0), newBalance <= 0 ? 'paid' : 'partial', invoice_id]);
    }
  }
  res.json({ message: 'Payment recorded', payment_number: paymentNumber });
});

router.post('/payments/:id/refund', (req, res) => {
  const { amount, reason } = req.body;
  const payment = get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  run('UPDATE payments SET status = "refunded", refund_amount = ?, refund_reason = ? WHERE id = ?', [amount || payment.amount, reason || '', req.params.id]);
  run('INSERT INTO refunds (payment_id, amount, reason, status, processed_by, processed_at) VALUES (?, ?, ?, ?, ?, ?)',
    [req.params.id, amount || payment.amount, reason || '', 'processed', req.user.id, new Date().toISOString()]);
  res.json({ message: 'Refund processed' });
});

router.get('/expenses', (req, res) => {
  const { category, branch_id, start_date, end_date } = req.query;
  let sql = 'SELECT * FROM expenses';
  const params = [];
  const conditions = [];
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (branch_id) { conditions.push('branch_id = ?'); params.push(branch_id); }
  if (start_date) { conditions.push('date >= ?'); params.push(start_date); }
  if (end_date) { conditions.push('date <= ?'); params.push(end_date); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY date DESC';
  res.json(all(sql, params));
});

router.post('/expenses', (req, res) => {
  const { category, description, amount, date, branch_id, vendor, payment_method } = req.body;
  run('INSERT INTO expenses (category, description, amount, date, branch_id, vendor, payment_method, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [category, description || '', amount, date || new Date().toISOString().split('T')[0], branch_id || 1, vendor || '', payment_method || 'cash', 'approved', req.user.id]);
  res.json({ message: 'Expense recorded' });
});

// ========== INVENTORY ==========
router.get('/products', (req, res) => {
  const { category, search, low_stock } = req.query;
  let sql = 'SELECT * FROM products';
  const params = [];
  const conditions = [];
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (search) { conditions.push('(name LIKE ? OR sku LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (low_stock === 'true') { conditions.push('stock <= minimum_stock'); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY name';
  res.json(all(sql, params));
});

router.post('/products', (req, res) => {
  const p = req.body;
  run('INSERT INTO products (name, sku, barcode, category, description, purchase_price, selling_price, stock, minimum_stock, unit, supplier, branch_id, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [p.name, p.sku, p.barcode || '', p.category || '', p.description || '', p.purchase_price || 0, p.selling_price || 0, p.stock || 0, p.minimum_stock || 10, p.unit || 'piece', p.supplier || '', p.branch_id || null, p.image || '']);
  res.json({ message: 'Product created' });
});

router.put('/products/:id', (req, res) => {
  const p = req.body;
  run('UPDATE products SET name=?, sku=?, barcode=?, category=?, description=?, purchase_price=?, selling_price=?, stock=?, minimum_stock=?, unit=?, supplier=?, image=?, is_active=? WHERE id=?',
    [p.name, p.sku, p.barcode, p.category, p.description, p.purchase_price, p.selling_price, p.stock, p.minimum_stock, p.unit, p.supplier, p.image, p.is_active !== undefined ? (p.is_active ? 1 : 0) : 1, req.params.id]);
  res.json({ message: 'Product updated' });
});

router.post('/products/:id/stock', (req, res) => {
  const { quantity, transaction_type, notes } = req.body;
  const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  let newStock = product.stock;
  if (transaction_type === 'purchase' || transaction_type === 'adjustment_add') newStock += quantity;
  else if (transaction_type === 'sale' || transaction_type === 'return' || transaction_type === 'adjustment_remove') newStock -= quantity;
  else if (transaction_type === 'damage') newStock -= quantity;
  run('UPDATE products SET stock = ? WHERE id = ?', [newStock, req.params.id]);
  run('INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, transaction_type, quantity, notes || '', req.user.id]);
  res.json({ message: 'Stock updated', new_stock: newStock });
});

router.get('/inventory/transactions', (req, res) => {
  const { product_id, type } = req.query;
  let sql = 'SELECT it.*, p.name as product_name FROM inventory_transactions it JOIN products p ON it.product_id = p.id';
  const params = [];
  const conditions = [];
  if (product_id) { conditions.push('it.product_id = ?'); params.push(product_id); }
  if (type) { conditions.push('it.transaction_type = ?'); params.push(type); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY it.created_at DESC';
  res.json(all(sql, params));
});

// ========== POS ==========
router.post('/pos/orders', requirePerm('pos', 'create'), (req, res) => {
  const { user_id, items, discount, payment_method } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'No items' });
  const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
  let subtotal = 0;
  const enriched = items.map(item => {
    const product = get('SELECT * FROM products WHERE id = ?', [item.product_id]);
    if (!product) return { ...item, unit_price: Number(item.unit_price) || 0, invalid: true };
    const qty = parseInt(item.quantity) || 1;
    const unitPrice = Number(product.selling_price) || 0;
    subtotal += qty * unitPrice;
    return { ...item, product, quantity: qty, unit_price: unitPrice };
  });
  const discountAmount = discount || 0;
  const tax = Math.round((subtotal - discountAmount) * 0.18 * 100) / 100;
  const total = Math.round((subtotal - discountAmount + tax) * 100) / 100;

  run('INSERT INTO pos_orders (order_number, user_id, branch_id, subtotal, discount, tax, total, payment_method, payment_status, cashier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [orderNumber, user_id || null, req.body.branch_id || 1, subtotal, discountAmount, tax, total, payment_method || 'cash', 'paid', req.user.id]);
  const orderId = get("SELECT last_insert_rowid() as id").id;

  enriched.forEach(item => {
    const itemTotal = item.quantity * item.unit_price;
    run('INSERT INTO pos_order_items (order_id, product_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
      [orderId, item.product_id, item.quantity, item.unit_price, itemTotal]);
    run('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?', [item.quantity, item.product_id]);
    run('INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id, reference_type, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [item.product_id, 'SALE', item.quantity, orderId, 'pos_order', req.user.id]);
  });

  if (user_id) {
    run('INSERT INTO payments (payment_number, user_id, amount, method, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
      ['PAY-' + Date.now().toString(36).toUpperCase(), user_id, total, payment_method || 'cash', 'completed', `POS Order ${orderNumber}`]);
  }

  res.json({ message: 'Order created', order_number: orderNumber, total, subtotal, tax, discount: discountAmount });
});

router.get('/pos/orders', (req, res) => {
  const { date } = req.query;
  let sql = 'SELECT o.*, u.full_name as customer_name, e.full_name as cashier_name FROM pos_orders o LEFT JOIN users u ON o.user_id = u.id LEFT JOIN employees e ON o.cashier_id = e.id';
  const params = [];
  if (date) { sql += ' WHERE date(o.created_at) = ?'; params.push(date); }
  sql += ' ORDER BY o.created_at DESC';
  res.json(all(sql, params));
});

// ========== SUPPORT / TICKETS ==========
router.get('/tickets', (req, res) => {
  const { status, category, priority, assigned_to, search } = req.query;
  let sql = 'SELECT t.*, u.full_name as customer_name, u.email as customer_email, e.full_name as assigned_name FROM tickets t JOIN users u ON t.user_id = u.id LEFT JOIN employees e ON t.assigned_to = e.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('t.status = ?'); params.push(status); }
  if (category) { conditions.push('t.category = ?'); params.push(category); }
  if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
  if (assigned_to) { conditions.push('t.assigned_to = ?'); params.push(assigned_to); }
  if (search) { conditions.push('(t.ticket_id LIKE ? OR t.subject LIKE ? OR u.full_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY t.created_at DESC';
  res.json(all(sql, params));
});

router.put('/tickets/:id', (req, res) => {
  const { status, assigned_to, priority, resolution } = req.body;
  run('UPDATE tickets SET status=?, assigned_to=?, priority=?, resolution=?, resolved_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [status || null, assigned_to || null, priority || null, resolution || null, status === 'resolved' ? new Date().toISOString() : null, req.params.id]);
  if (assigned_to) {
    const ticket = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    run('INSERT INTO notifications (user_id, title, message, type, module) VALUES (?, ?, ?, ?, ?)',
      [null, 'Ticket Assigned', `Ticket ${ticket.ticket_id} has been assigned to you.`, 'info', 'support']);
  }
  res.json({ message: 'Ticket updated' });
});

router.post('/tickets/:id/messages', (req, res) => {
  const { message, is_internal } = req.body;
  run('INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, message, is_internal ? 1 : 0]);
  res.json({ message: 'Message added' });
});

router.get('/tickets/:id/messages', (req, res) => {
  const messages = all('SELECT tm.*, u.full_name as sender_name, u.role as sender_role FROM ticket_messages tm JOIN users u ON tm.sender_id = u.id WHERE tm.ticket_id = ? ORDER BY tm.created_at', [req.params.id]);
  res.json(messages);
});

// ========== TASKS ==========
router.get('/tasks', (req, res) => {
  const { status, assigned_to, priority } = req.query;
  let sql = 'SELECT t.*, u.full_name as assignee_name, a.full_name as assigner_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id LEFT JOIN users a ON t.assigned_by = a.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('t.status = ?'); params.push(status); }
  if (assigned_to) { conditions.push('t.assigned_to = ?'); params.push(assigned_to); }
  if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY CASE t.priority WHEN "urgent" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END, t.due_date';
  res.json(all(sql, params));
});

router.post('/tasks', (req, res) => {
  const { title, description, assigned_to, department, priority, due_date } = req.body;
  run('INSERT INTO tasks (title, description, assigned_to, assigned_by, department, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, description || '', assigned_to || null, req.user.id, department || '', priority || 'medium', due_date || '', 'todo']);
  if (assigned_to) {
    run('INSERT INTO notifications (user_id, title, message, type, module) VALUES (?, ?, ?, ?, ?)',
      [assigned_to, 'New Task Assigned', `You have been assigned: ${title}`, 'info', 'tasks']);
  }
  res.json({ message: 'Task created' });
});

router.put('/tasks/:id', (req, res) => {
  const { status, completion_notes } = req.body;
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  run('UPDATE tasks SET status=?, completion_notes=?, completed_at=? WHERE id=?',
    [status, completion_notes || '', completedAt, req.params.id]);
  res.json({ message: 'Task updated' });
});

// ========== CAMPAIGNS / MARKETING ==========
router.get('/campaigns', (req, res) => {
  res.json(all('SELECT * FROM campaigns ORDER BY created_at DESC'));
});

router.post('/campaigns', (req, res) => {
  const { name, type, budget, start_date, end_date, target_audience, notes } = req.body;
  run('INSERT INTO campaigns (name, type, status, budget, start_date, end_date, target_audience, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, type, 'draft', budget || 0, start_date, end_date, target_audience || '', notes || '', req.user.id]);
  res.json({ message: 'Campaign created' });
});

router.put('/campaigns/:id', (req, res) => {
  const { status, spent, leads_generated, conversions, revenue } = req.body;
  run('UPDATE campaigns SET status=?, spent=?, leads_generated=?, conversions=?, revenue=? WHERE id=?',
    [status, spent, leads_generated, conversions, revenue, req.params.id]);
  res.json({ message: 'Campaign updated' });
});

// ========== ANNOUNCEMENTS ==========
router.get('/announcements', (req, res) => {
  res.json(all('SELECT * FROM announcements ORDER BY created_at DESC'));
});

router.post('/announcements', (req, res) => {
  const { title, content, target, target_ids, priority, start_date, end_date } = req.body;
  run('INSERT INTO announcements (title, content, target, target_ids, priority, start_date, end_date, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, content, target || 'all', JSON.stringify(target_ids || []), priority || 'normal', start_date, end_date, 1, req.user.id]);
  res.json({ message: 'Announcement created' });
});

// ========== DOCUMENTS ==========
router.get('/documents', (req, res) => {
  const { user_id, category, entity_type } = req.query;
  let sql = 'SELECT d.*, u.full_name as uploaded_by_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id';
  const params = [];
  const conditions = [];
  if (user_id) { conditions.push('d.user_id = ?'); params.push(user_id); }
  if (category) { conditions.push('d.category = ?'); params.push(category); }
  if (entity_type) { conditions.push('d.entity_type = ?'); params.push(entity_type); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY d.created_at DESC';
  res.json(all(sql, params));
});

router.post('/documents', upload.single('file'), (req, res) => {
  const { user_id, name, category, entity_type, entity_id } = req.body;
  if (!req.file && !req.body.file_url) return res.status(400).json({ error: 'No file' });
  const fileUrl = req.file ? '/uploads/' + req.file.filename : req.body.file_url;
  run('INSERT INTO documents (user_id, uploaded_by, name, file_url, file_type, file_size, category, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id || null, req.user.id, name || req.file.originalname, fileUrl, req.file ? req.file.mimetype : '', req.file ? req.file.size : 0, category || 'general', entity_type || null, entity_id || null]);
  res.json({ message: 'Document uploaded' });
});

// ========== COUPONS ==========
router.get('/coupons', (req, res) => { res.json(all('SELECT * FROM coupons ORDER BY id DESC')); });
router.post('/coupons', (req, res) => {
  const c = req.body;
  run('INSERT INTO coupons (code, description, discount_percent, discount_amount, max_uses, valid_from, valid_until, plan_ids, min_purchase, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [c.code, c.description || '', c.discount_percent || 0, c.discount_amount || 0, c.max_uses || 100, c.valid_from, c.valid_until, JSON.stringify(c.plan_ids || []), c.min_purchase || 0, 1]);
  res.json({ message: 'Coupon created' });
});

router.delete('/coupons/:id', (req, res) => { run('DELETE FROM coupons WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); });

// ========== OFFERS ==========
router.get('/offers', (req, res) => { res.json(all('SELECT * FROM offers ORDER BY created_at DESC')); });
router.post('/offers', (req, res) => {
  const o = req.body;
  run('INSERT INTO offers (name, description, discount_percent, discount_amount, offer_type, start_date, end_date, coupon_code, plan_ids, branch_ids, usage_limit, min_purchase, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [o.name, o.description || '', o.discount_percent || 0, o.discount_amount || 0, o.offer_type || 'general', o.start_date, o.end_date, o.coupon_code, JSON.stringify(o.plan_ids || []), JSON.stringify(o.branch_ids || []), o.usage_limit || 100, o.min_purchase || 0, 1]);
  res.json({ message: 'Offer created' });
});

// ========== REFERRALS ==========
router.get('/referrals', (req, res) => {
  const referrals = all('SELECT r.*, u.full_name as referrer_name FROM referrals r JOIN users u ON r.referrer_id = u.id ORDER BY r.created_at DESC');
  res.json(referrals);
});

// ========== NOTIFICATIONS ==========
router.get('/notifications', (req, res) => {
  const notifs = all('SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json({ items: notifs, total: notifs.length });
});

router.put('/notifications/:id/read', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Marked as read' });
});

router.put('/notifications/read-all', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'All marked as read' });
});

// ========== AUDIT LOGS ==========
router.get('/audit-logs', requirePerm('audit', 'view'), (req, res) => {
  const { entity_type, user_id, page = 1, limit = 100 } = req.query;
  let sql = 'SELECT * FROM audit_logs';
  const params = [];
  const conditions = [];
  if (entity_type) { conditions.push('entity_type = ?'); params.push(entity_type); }
  if (user_id) { conditions.push('user_id = ?'); params.push(user_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const totalAudit = get('SELECT COUNT(*) as c FROM audit_logs' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params).c;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  res.json({ items: all(sql, params), total: totalAudit, page: parseInt(page), limit: parseInt(limit) });
});

// ========== SETTINGS ==========
router.get('/settings', (req, res) => {
  const settings = all('SELECT * FROM site_settings ORDER BY category, key');
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const settings = req.body;
  Object.keys(settings).forEach(key => {
    const existing = get('SELECT id FROM site_settings WHERE key = ?', [key]);
    if (existing) { run('UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [settings[key], key]); }
    else { run('INSERT INTO site_settings (key, value) VALUES (?, ?)', [key, settings[key]]); }
  });
  res.json({ message: 'Settings updated' });
});

// ========== REPORTS ==========
router.get('/reports/sales', (req, res) => {
  const { start_date, end_date } = req.query;
  const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = end_date || new Date().toISOString().split('T')[0];
  const leads = get("SELECT COUNT(*) as total FROM leads WHERE created_at BETWEEN ? AND ?", [start, end]).total;
  const converted = get("SELECT COUNT(*) as c FROM leads WHERE (status = 'CONVERTED' OR status = 'converted') AND created_at BETWEEN ? AND ?", [start, end]).c;
  const revenue = get("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ?", [start, end]).t;
  res.json({
    summary: {
      leads,
      converted,
      conversion_rate: leads > 0 ? Math.round((converted / leads) * 1000) / 10 : 0,
      revenue
    },
    by_source: all("SELECT source, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY source", [start, end]),
    by_status: all("SELECT STATUS, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY status", [start, end]),
    by_salesperson: all("SELECT e.full_name, COUNT(l.id) as leads, SUM(CASE WHEN l.status = 'CONVERTED' OR l.status = 'converted' THEN 1 ELSE 0 END) as conversions FROM leads l JOIN employees e ON l.assigned_salesperson = e.id WHERE l.created_at BETWEEN ? AND ? GROUP BY l.assigned_salesperson", [start, end])
  });
});

router.get('/reports/finance', (req, res) => {
  const { start_date, end_date } = req.query;
  const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = end_date || new Date().toISOString().split('T')[0];
  const revenue = get("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ?", [start, end]).total;
  const expenses = get("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?", [start, end]).total;
  const outstanding = get("SELECT COALESCE(SUM(balance), 0) as total FROM invoices WHERE status = 'pending'").total;
  const refunds = get("SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE status = 'processed' AND date(created_at) BETWEEN ? AND ?", [start, end]).total;
  res.json({
    summary: { revenue, expenses, profit: revenue - expenses, outstanding, refunds },
    by_method: all("SELECT method, COUNT(*) as count, SUM(amount) as total FROM payments WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ? GROUP BY method", [start, end]),
    trend: all("SELECT date(created_at) as period, SUM(amount) as total FROM payments WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ? GROUP BY period ORDER BY period", [start, end])
  });
});

router.get('/reports/members', (req, res) => {
  const total = get("SELECT COUNT(*) as c FROM memberships").c;
  const active = get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active'").c;
  const expired = get("SELECT COUNT(*) as c FROM memberships WHERE status = 'expired'").c;
  const frozen = get("SELECT COUNT(*) as c FROM memberships WHERE status = 'frozen'").c;
  const cancelled = get("SELECT COUNT(*) as c FROM memberships WHERE status = 'cancelled'").c;
  res.json({
    summary: { total, active, expired, frozen, cancelled },
    by_plan: all("SELECT mp.name, COUNT(*) as count FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id GROUP BY mp.name"),
    by_branch: all("SELECT b.name, COUNT(*) as count FROM memberships m JOIN branches b ON m.branch_id = b.id GROUP BY b.name"),
    expiring: all("SELECT m.*, u.full_name, mp.name as plan_name FROM memberships m JOIN users u ON m.user_id = u.id JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.status = 'active' AND m.end_date BETWEEN date('now') AND date('now', '+30 days') ORDER BY m.end_date")
  });
});

router.get('/reports/attendance', (req, res) => {
  const { start_date, end_date } = req.query;
  const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = end_date || new Date().toISOString().split('T')[0];
  const checkins = get("SELECT COUNT(*) as t FROM attendance WHERE date BETWEEN ? AND ?", [start, end]).t;
  const uniqueMembers = get("SELECT COUNT(DISTINCT user_id) as t FROM attendance WHERE date BETWEEN ? AND ?", [start, end]).t;
  const days = get("SELECT COUNT(DISTINCT date) as d FROM attendance WHERE date BETWEEN ? AND ?", [start, end]).d;
  res.json({
    summary: { checkins, unique_members: uniqueMembers, avg_per_day: days > 0 ? Math.round(checkins / days * 10) / 10 : 0 },
    trend: all("SELECT date, COUNT(*) as count FROM attendance WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date", [start, end]),
    by_branch: all("SELECT b.name, COUNT(*) as count FROM attendance a LEFT JOIN branches b ON a.branch_id = b.id WHERE a.date BETWEEN ? AND ? GROUP BY a.branch_id", [start, end])
  });
});

// ========== FILE UPLOAD ==========
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: '/uploads/' + req.file.filename, filename: req.file.filename, size: req.file.size });
});

module.exports = router;
