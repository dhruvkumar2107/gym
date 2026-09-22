const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');
const upload = require('../middleware/upload');
const bcrypt = require('bcryptjs');

router.use(authMiddleware, adminMiddleware);

// ========== DASHBOARD ==========
router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const stats = {
    totalMembers: get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active'").c,
    activeMembers: get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active' AND end_date >= date('now')").c,
    newMembersThisMonth: get("SELECT COUNT(*) as c FROM memberships WHERE created_at >= ?", [thirtyDaysAgo]).c,
    expiringThisWeek: get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active' AND end_date <= ? AND end_date >= ?", [sevenDaysFromNow, today]).c,
    totalLeads: get("SELECT COUNT(*) as c FROM leads").c,
    newLeads: get("SELECT COUNT(*) as c FROM leads WHERE status = 'NEW_LEAD'").c,
    leadsThisMonth: get("SELECT COUNT(*) as c FROM leads WHERE created_at >= ?", [thirtyDaysAgo]).c,
    convertedLeads: get("SELECT COUNT(*) as c FROM leads WHERE status = 'CONVERTED'").c,
    todayRevenue: get("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'completed' AND date(created_at) = ?", [today]).t,
    monthlyRevenue: get("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'completed' AND created_at >= ?", [thirtyDaysAgo]).t,
    totalRevenue: get("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'completed'").t,
    outstandingPayments: get("SELECT COALESCE(SUM(balance), 0) as t FROM invoices WHERE status = 'pending'").t,
    todayAttendance: get("SELECT COUNT(*) as c FROM attendance WHERE date = ?", [today]).c,
    membersInsideGym: get("SELECT COUNT(*) as c FROM attendance WHERE date = ? AND check_out IS NULL", [today]).c,
    activePTSessions: get("SELECT COUNT(*) as c FROM pt_sessions WHERE status = 'scheduled' AND scheduled_date = ?", [today]).c,
    classesToday: get("SELECT COUNT(*) as c FROM class_schedules cs JOIN classes c ON cs.class_id = c.id WHERE cs.day_of_week = ? AND c.is_active = 1", [new Date().toLocaleDateString('en-US', { weekday: 'long' })]).c,
    staffPresent: get("SELECT COUNT(*) as c FROM employee_attendance WHERE date = ? AND status = 'present'", [today]).c,
    openTickets: get("SELECT COUNT(*) as c FROM tickets WHERE status IN ('open', 'in_progress')").c,
    lowStockProducts: get("SELECT COUNT(*) as c FROM products WHERE stock <= minimum_stock AND is_active = 1").c,
    pendingTasks: get("SELECT COUNT(*) as c FROM tasks WHERE status IN ('todo', 'in_progress')").c,
    totalEmployees: get("SELECT COUNT(*) as c FROM employees WHERE is_active = 1").c,
    totalProducts: get("SELECT COUNT(*) as c FROM products WHERE is_active = 1").c,
    monthlyExpenses: get("SELECT COALESCE(SUM(amount), 0) as t FROM expenses WHERE date >= ?", [thirtyDaysAgo]).t,
    recentLeads: all("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5"),
    recentPayments: all("SELECT p.*, u.full_name FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 5"),
    recentAttendance: all("SELECT a.*, u.full_name FROM attendance a LEFT JOIN users u ON a.user_id = u.id WHERE a.date = ? ORDER BY a.check_in DESC LIMIT 10", [today]),
    needsAttention: {
      expiringMemberships: get("SELECT COUNT(*) as c FROM memberships WHERE status = 'active' AND end_date <= ? AND end_date >= ?", [sevenDaysFromNow, today]).c,
      uncontactedLeads: get("SELECT COUNT(*) as c FROM leads WHERE status = 'NEW_LEAD' AND created_at <= datetime('now', '-24 hours')").c,
      unpaidInvoices: get("SELECT COUNT(*) as c FROM invoices WHERE status = 'pending'").c,
      inactiveMembers: get("SELECT COUNT(*) as c FROM users u WHERE u.role = 'member' AND u.id NOT IN (SELECT user_id FROM attendance WHERE date >= ?)", [thirtyDaysAgo]).c,
      nearSLABreach: get("SELECT COUNT(*) as c FROM tickets WHERE status IN ('open', 'in_progress') AND sla_deadline <= datetime('now', '+24 hours')").c,
      lowStock: get("SELECT COUNT(*) as c FROM products WHERE stock <= minimum_stock AND is_active = 1").c,
      staffAbsent: get("SELECT COUNT(*) as c FROM employees WHERE is_active = 1 AND id NOT IN (SELECT employee_id FROM employee_attendance WHERE date = ?)", [today]).c
    },
    revenueTrend: all("SELECT date(created_at) as date, SUM(amount) as revenue FROM payments WHERE status = 'completed' AND created_at >= date('now', '-30 days') GROUP BY date(created_at) ORDER BY date"),
    membershipGrowth: all("SELECT date(created_at) as date, COUNT(*) as count FROM memberships WHERE created_at >= date('now', '-30 days') GROUP BY date(created_at) ORDER BY date"),
    leadFunnel: all("SELECT status, COUNT(*) as count FROM leads GROUP BY status"),
    revenueByPlan: all("SELECT mp.name, SUM(p.amount) as revenue FROM payments p JOIN memberships m ON p.membership_id = m.id JOIN membership_plans mp ON m.plan_id = mp.id WHERE p.status = 'completed' GROUP BY mp.name"),
    attendanceTrend: all("SELECT date, COUNT(*) as count FROM attendance WHERE date >= date('now', '-30 days') GROUP BY date ORDER BY date")
  };
  res.json(stats);
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
router.get('/users', (req, res) => {
  const { role, search, branch_id, status, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT id, username, email, role, full_name, phone, avatar, gender, date_of_birth, address, city, fitness_level, is_active, created_at, last_login FROM users';
  const params = [];
  const conditions = [];
  if (role) { conditions.push('role = ?'); params.push(role); }
  if (search) { conditions.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (status === 'active') { conditions.push('is_active = 1'); }
  if (status === 'inactive') { conditions.push('is_active = 0'); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const countSql = sql.replace('SELECT id, username, email, role, full_name, phone, avatar, gender, date_of_birth, address, city, fitness_level, is_active, created_at, last_login', 'SELECT COUNT(*) as total');
  const total = get(countSql, params).total;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const users = all(sql, params);
  res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/users/:id', (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
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

router.post('/users', [
  body('email').isEmail().normalizeEmail(),
  body('full_name').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, full_name, phone, role, gender, date_of_birth, address, city, fitness_goals } = req.body;
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

router.put('/users/:id', (req, res) => {
  const { full_name, phone, role, gender, date_of_birth, address, city, state, pincode, fitness_goals, height, weight, fitness_level, is_active } = req.body;
  const prev = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  run('UPDATE users SET full_name=?, phone=?, role=?, gender=?, date_of_birth=?, address=?, city=?, state=?, pincode=?, fitness_goals=?, height=?, weight=?, fitness_level=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [full_name || prev.full_name, phone || prev.phone, role || prev.role, gender || prev.gender, date_of_birth || prev.date_of_birth, address || prev.address, city || prev.city, state || prev.state, pincode || prev.pincode, fitness_goals || prev.fitness_goals, height || prev.height, weight || prev.weight, fitness_level || prev.fitness_level, is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active, req.params.id]);
  run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.full_name, 'UPDATE', 'user', req.params.id, full_name || prev.full_name, JSON.stringify({ role: prev.role, is_active: prev.is_active }), JSON.stringify({ role, is_active })]);
  res.json({ message: 'User updated' });
});

router.delete('/users/:id', (req, res) => {
  run('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'User deactivated' });
});

// ========== MEMBERSHIP PLANS ==========
router.get('/plans', (req, res) => {
  res.json(all('SELECT * FROM membership_plans ORDER BY sort_order'));
});

router.get('/plans/:id', (req, res) => {
  const plan = get('SELECT * FROM membership_plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const memberCount = get("SELECT COUNT(*) as c FROM memberships WHERE plan_id = ? AND status = 'active'", [req.params.id]).c;
  const revenue = get("SELECT COALESCE(SUM(amount), 0) as t FROM payments p JOIN memberships m ON p.membership_id = m.id WHERE m.plan_id = ? AND p.status = 'completed'", [req.params.id]).t;
  res.json({ ...plan, memberCount, revenue });
});

router.post('/plans', (req, res) => {
  const p = req.body;
  run('INSERT INTO membership_plans (name, slug, description, price, original_price, duration_months, features, gym_access, class_access, pt_sessions, sauna_access, locker_included, guest_passes, nutrition_consultation, freeze_days, branch_access, terms_conditions, is_popular, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [p.name, p.slug, p.description, p.price, p.original_price, p.duration_months, JSON.stringify(p.features || []), p.gym_access ? 1 : 0, p.class_access ? 1 : 0, p.pt_sessions || 0, p.sauna_access ? 1 : 0, p.locker_included ? 1 : 0, p.guest_passes || 0, p.nutrition_consultation ? 1 : 0, p.freeze_days || 0, p.branch_access || 'all', p.terms_conditions || '', p.is_popular ? 1 : 0, p.is_active !== false ? 1 : 0, p.sort_order || 0]);
  res.json({ message: 'Plan created' });
});

router.put('/plans/:id', (req, res) => {
  const p = req.body;
  run('UPDATE membership_plans SET name=?, slug=?, description=?, price=?, original_price=?, duration_months=?, features=?, gym_access=?, class_access=?, pt_sessions=?, sauna_access=?, locker_included=?, guest_passes=?, nutrition_consultation=?, freeze_days=?, branch_access=?, terms_conditions=?, is_popular=?, is_active=?, sort_order=? WHERE id=?',
    [p.name, p.slug, p.description, p.price, p.original_price, p.duration_months, JSON.stringify(p.features || []), p.gym_access ? 1 : 0, p.class_access ? 1 : 0, p.pt_sessions || 0, p.sauna_access ? 1 : 0, p.locker_included ? 1 : 0, p.guest_passes || 0, p.nutrition_consultation ? 1 : 0, p.freeze_days || 0, p.branch_access || 'all', p.terms_conditions || '', p.is_popular ? 1 : 0, p.is_active !== false ? 1 : 0, p.sort_order || 0, req.params.id]);
  res.json({ message: 'Plan updated' });
});

router.delete('/plans/:id', (req, res) => {
  run('UPDATE membership_plans SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Plan deactivated' });
});

// ========== MEMBERSHIPS ==========
router.get('/memberships', (req, res) => {
  const { status, plan_id, branch_id, search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT m.*, mp.name as plan_name, u.full_name, u.email, u.phone, b.name as branch_name FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id JOIN users u ON m.user_id = u.id LEFT JOIN branches b ON m.branch_id = b.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('m.status = ?'); params.push(status); }
  if (plan_id) { conditions.push('m.plan_id = ?'); params.push(plan_id); }
  if (branch_id) { conditions.push('m.branch_id = ?'); params.push(branch_id); }
  if (search) { conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR m.membership_id LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const memberships = all(sql, params);
  res.json(memberships);
});

router.post('/memberships', (req, res) => {
  const { user_id, plan_id, branch_id, start_date, end_date, discount, tax, payment_method, payment_reference, assigned_salesperson, assigned_trainer, notes } = req.body;
  const plan = get('SELECT * FROM membership_plans WHERE id = ?', [plan_id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const finalAmount = plan.price - (discount || 0) + (tax || 0);
  const memId = 'MEM-' + Date.now().toString(36).toUpperCase();
  const noteText = notes || (payment_reference ? 'Payment ref: ' + payment_reference : '');
  run('INSERT INTO memberships (membership_id, user_id, plan_id, branch_id, status, start_date, end_date, assigned_salesperson, assigned_trainer, discount, tax, final_amount, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [memId, user_id, plan_id, branch_id || 1, 'active', start_date || new Date().toISOString().split('T')[0], end_date, assigned_salesperson || null, assigned_trainer || null, discount || 0, tax || 0, finalAmount, payment_method || 'razorpay', noteText]);
  run('UPDATE users SET role = "member" WHERE id = ?', [user_id]);
  if (payment_reference) {
    run('INSERT INTO payments (user_id, membership_id, amount, payment_method, payment_reference, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user_id, memId, finalAmount, payment_method || 'razorpay', payment_reference, 'completed', 'Online payment via checkout']);
  }
  res.json({ message: 'Membership created', membership_id: memId });
});

router.put('/memberships/:id', (req, res) => {
  const { status, end_date, notes, freeze_reason } = req.body;
  const prev = get('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
  run('UPDATE memberships SET status=?, end_date=?, notes=?, freeze_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [status || prev.status, end_date || prev.end_date, notes || prev.notes, freeze_reason || prev.freeze_reason, req.params.id]);
  if (status === 'frozen') run('UPDATE memberships SET freeze_date = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.full_name, 'UPDATE', 'membership', req.params.id, prev.membership_id, JSON.stringify({ status: prev.status }), JSON.stringify({ status })]);
  res.json({ message: 'Membership updated' });
});

router.post('/memberships/:id/renew', (req, res) => {
  const mem = get('SELECT m.*, mp.duration_months FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.id = ?', [req.params.id]);
  if (!mem) return res.status(404).json({ error: 'Membership not found' });
  const newStart = mem.end_date;
  const newEnd = new Date(newStart);
  newEnd.setMonth(newEnd.getMonth() + mem.duration_months);
  run('UPDATE memberships SET status = "active", start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStart, newEnd.toISOString().split('T')[0], req.params.id]);
  res.json({ message: 'Membership renewed', new_end_date: newEnd.toISOString().split('T')[0] });
});

router.post('/memberships/:id/transfer', (req, res) => {
  const { new_user_id } = req.body;
  const prev = get('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
  run('UPDATE memberships SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [new_user_id, req.params.id]);
  run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.full_name, 'TRANSFER', 'membership', req.params.id, JSON.stringify({ user_id: prev.user_id }), JSON.stringify({ user_id: new_user_id })]);
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
  const summary = {
    total: get("SELECT COUNT(*) as c FROM attendance WHERE date = ?", [targetDate]).c,
    checkedIn: get("SELECT COUNT(*) as c FROM attendance WHERE date = ? AND check_out IS NULL", [targetDate]).c,
    checkedOut: get("SELECT COUNT(*) as c FROM attendance WHERE date = ? AND check_out IS NOT NULL", [targetDate]).c,
    peakHour: get("SELECT substr(check_in, 1, 2) as hour, COUNT(*) as count FROM attendance WHERE date = ? GROUP BY hour ORDER BY count DESC LIMIT 1", [targetDate])
  };
  res.json({ records, summary });
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
  let sql = 'SELECT l.*, e.full_name as salesperson_name FROM leads l LEFT JOIN employees e ON l.assigned_salesperson = e.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('l.status = ?'); params.push(status); }
  if (source) { conditions.push('l.source = ?'); params.push(source); }
  if (assigned_salesperson) { conditions.push('l.assigned_salesperson = ?'); params.push(assigned_salesperson); }
  if (search) { conditions.push('(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const leads = all(sql, params);
  const total = get("SELECT COUNT(*) as c FROM leads" + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params.slice(0, conditions.length)).c;
  res.json({ leads, total });
});

router.get('/leads/pipeline', (req, res) => {
  const pipeline = ['NEW_LEAD', 'CONTACTED', 'INTERESTED', 'TRIAL_BOOKED', 'TRIAL_ATTENDED', 'NEGOTIATION', 'PAYMENT_PENDING', 'CONVERTED', 'LOST'];
  const result = {};
  pipeline.forEach(stage => {
    result[stage] = all('SELECT l.*, e.full_name as salesperson_name FROM leads l LEFT JOIN employees e ON l.assigned_salesperson = e.id WHERE l.status = ? ORDER BY l.created_at DESC', [stage]);
  });
  res.json(result);
});

router.post('/leads', (req, res) => {
  const { source, name, phone, email, gender, age, fitness_goal, interested_plan, preferred_branch, preferred_date, preferred_time, message, assigned_salesperson, notes, tags } = req.body;
  const leadId = 'LD-' + Date.now().toString(36).toUpperCase();
  run('INSERT INTO leads (lead_id, source, name, phone, email, gender, age, fitness_goal, interested_plan, preferred_branch, preferred_date, preferred_time, message, assigned_salesperson, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [leadId, source || 'website', name, phone || '', email || '', gender || '', age || null, fitness_goal || '', interested_plan || '', preferred_branch || null, preferred_date || '', preferred_time || '', message || '', assigned_salesperson || null, notes || '', JSON.stringify(tags || [])]);
  run('INSERT INTO notifications (user_id, title, message, type, module) VALUES (?, ?, ?, ?, ?)',
    [assigned_salesperson, 'New Lead Assigned', `New lead ${name} has been assigned to you.`, 'info', 'crm']);
  res.json({ message: 'Lead created', lead_id: leadId });
});

router.put('/leads/:id', (req, res) => {
  const { status, notes, assigned_salesperson, lead_score, next_followup_date } = req.body;
  const prev = get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
  run('UPDATE leads SET status=?, notes=?, assigned_salesperson=?, lead_score=?, next_followup_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [status || prev.status, notes || prev.notes, assigned_salesperson || prev.assigned_salesperson, lead_score || prev.lead_score, next_followup_date || prev.next_followup_date, req.params.id]);
  if (status === 'CONVERTED') {
    run("UPDATE leads SET conversion_date = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
  }
  run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.full_name, 'UPDATE', 'lead', req.params.id, prev.name, JSON.stringify({ status: prev.status }), JSON.stringify({ status })]);
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
  sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const invoices = all(sql, params);
  invoices.forEach(inv => {
    inv.items = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
  });
  res.json(invoices);
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

router.get('/payments', (req, res) => {
  const { status, method, user_id, date, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT p.*, u.full_name FROM payments p JOIN users u ON p.user_id = u.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('p.status = ?'); params.push(status); }
  if (method) { conditions.push('p.method = ?'); params.push(method); }
  if (user_id) { conditions.push('p.user_id = ?'); params.push(user_id); }
  if (date) { conditions.push("date(p.created_at) = ?"); params.push(date); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  res.json(all(sql, params));
});

router.post('/payments', (req, res) => {
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
router.post('/pos/orders', (req, res) => {
  const { user_id, items, discount, payment_method } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'No items' });
  const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
  let subtotal = 0;
  items.forEach(item => { subtotal += (item.quantity || 1) * (item.unit_price || 0); });
  const discountAmount = discount || 0;
  const tax = Math.round((subtotal - discountAmount) * 0.18);
  const total = subtotal - discountAmount + tax;

  run('INSERT INTO pos_orders (order_number, user_id, branch_id, subtotal, discount, tax, total, payment_method, payment_status, cashier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [orderNumber, user_id || null, req.body.branch_id || 1, subtotal, discountAmount, tax, total, payment_method || 'cash', 'paid', req.user.id]);
  const orderId = get("SELECT last_insert_rowid() as id").id;

  items.forEach(item => {
    const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
    run('INSERT INTO pos_order_items (order_id, product_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
      [orderId, item.product_id, item.quantity || 1, item.unit_price || 0, itemTotal]);
    run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity || 1, item.product_id]);
    run('INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id, reference_type, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [item.product_id, 'sale', item.quantity || 1, orderId, 'pos_order', req.user.id]);
  });

  if (user_id) {
    run('INSERT INTO payments (payment_number, user_id, amount, method, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
      ['PAY-' + Date.now().toString(36).toUpperCase(), user_id, total, payment_method || 'cash', 'completed', `POS Order ${orderNumber}`]);
  }

  res.json({ message: 'Order created', order_number: orderNumber, total });
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
  res.json(notifs);
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
router.get('/audit-logs', (req, res) => {
  const { entity_type, user_id, page = 1, limit = 100 } = req.query;
  let sql = 'SELECT * FROM audit_logs';
  const params = [];
  const conditions = [];
  if (entity_type) { conditions.push('entity_type = ?'); params.push(entity_type); }
  if (user_id) { conditions.push('user_id = ?'); params.push(user_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  res.json(all(sql, params));
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
  const bySource = all("SELECT source, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY source", [start, end]);
  const byStatus = all("SELECT status, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY status", [start, end]);
  const conversionRate = get("SELECT COUNT(*) as converted, (SELECT COUNT(*) FROM leads WHERE created_at BETWEEN ? AND ?) as total FROM leads WHERE status = 'CONVERTED' AND created_at BETWEEN ? AND ?", [start, end, start, end]);
  const bySalesperson = all("SELECT e.full_name, COUNT(l.id) as leads, SUM(CASE WHEN l.status = 'CONVERTED' THEN 1 ELSE 0 END) as conversions FROM leads l JOIN employees e ON l.assigned_salesperson = e.id WHERE l.created_at BETWEEN ? AND ? GROUP BY l.assigned_salesperson", [start, end]);
  res.json({ bySource, byStatus, conversionRate, bySalesperson });
});

router.get('/reports/finance', (req, res) => {
  const { start_date, end_date } = req.query;
  const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = end_date || new Date().toISOString().split('T')[0];
  const revenue = get("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ?", [start, end]).total;
  const expenses = get("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?", [start, end]).total;
  const byMethod = all("SELECT method, COUNT(*) as count, SUM(amount) as total FROM payments WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ? GROUP BY method", [start, end]);
  const byCategory = all("SELECT category, SUM(amount) as total FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category", [start, end]);
  const outstanding = get("SELECT COALESCE(SUM(balance), 0) as total FROM invoices WHERE status = 'pending'").total;
  const refunds = get("SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE status = 'processed' AND date(created_at) BETWEEN ? AND ?", [start, end]).total;
  res.json({ revenue, expenses, profit: revenue - expenses, byMethod, byCategory, outstanding, refunds });
});

router.get('/reports/members', (req, res) => {
  const byPlan = all("SELECT mp.name, COUNT(*) as count FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.status = 'active' GROUP BY mp.name");
  const byBranch = all("SELECT b.name, COUNT(*) as count FROM memberships m JOIN branches b ON m.branch_id = b.id WHERE m.status = 'active' GROUP BY b.name");
  const expiring = all("SELECT m.*, u.full_name, mp.name as plan_name FROM memberships m JOIN users u ON m.user_id = u.id JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.status = 'active' AND m.end_date BETWEEN date('now') AND date('now', '+30 days') ORDER BY m.end_date");
  const recentlyJoined = all("SELECT m.*, u.full_name, mp.name as plan_name FROM memberships m JOIN users u ON m.user_id = u.id JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.created_at >= date('now', '-30 days') ORDER BY m.created_at DESC LIMIT 20");
  res.json({ byPlan, byBranch, expiring, recentlyJoined });
});

router.get('/reports/attendance', (req, res) => {
  const { start_date, end_date } = req.query;
  const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = end_date || new Date().toISOString().split('T')[0];
  const daily = all("SELECT date, COUNT(*) as count FROM attendance WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date", [start, end]);
  const byHour = all("SELECT substr(check_in, 1, 2) as hour, COUNT(*) as count FROM attendance WHERE date BETWEEN ? AND ? GROUP BY hour ORDER BY hour", [start, end]);
  const topMembers = all("SELECT u.full_name, COUNT(*) as visits FROM attendance a JOIN users u ON a.user_id = u.id WHERE a.date BETWEEN ? AND ? GROUP BY a.user_id ORDER BY visits DESC LIMIT 10", [start, end]);
  res.json({ daily, byHour, topMembers });
});

// ========== FILE UPLOAD ==========
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: '/uploads/' + req.file.filename, filename: req.file.filename, size: req.file.size });
});

module.exports = router;
