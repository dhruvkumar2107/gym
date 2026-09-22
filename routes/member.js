const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function calcStreak(userId) {
  const dates = all("SELECT DISTINCT date FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT 30", [userId]);
  if (!dates.length) return 0;
  let streak = 0;
  let checkDate = new Date();
  for (const d of dates) {
    const attDate = new Date(d.date + 'T00:00:00');
    const diff = Math.round((checkDate - attDate) / 86400000);
    if (diff <= 1) { streak++; checkDate = attDate; }
    else break;
  }
  return streak;
}

function profileShape(user) {
  return {
    id: user.id,
    name: user.full_name,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    gender: user.gender,
    date_of_birth: user.date_of_birth,
    dateOfBirth: user.date_of_birth,
    address: user.address,
    city: user.city,
    state: user.state,
    pincode: user.pincode,
    height: user.height,
    weight: user.weight,
    fitness_goals: user.fitness_goals,
    fitnessGoal: user.fitness_goals,
    fitness_level: user.fitness_level,
    emergency_contact_name: user.emergency_contact_name,
    emergencyContactName: user.emergency_contact_name,
    emergency_contact_phone: user.emergency_contact_phone,
    emergencyContactPhone: user.emergency_contact_phone,
    medical_conditions: user.medical_info,
    medicalConditions: user.medical_info,
    preferred_workout_time: user.preferred_workout_time,
    preferredWorkoutTime: user.preferred_workout_time,
    created_at: user.created_at
  };
}

// Member Dashboard
router.get('/dashboard', (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const membership = get('SELECT m.*, mp.name as plan_name, mp.features, mp.duration_months, e.full_name as trainer_name FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id LEFT JOIN employees e ON m.assigned_trainer = e.id WHERE m.user_id = ? AND m.status = "active" ORDER BY m.created_at DESC LIMIT 1', [req.user.id]);
  if (membership) {
    try { membership.features = JSON.parse(membership.features); } catch(e) { membership.features = []; }
  }
  const today = todayStr();
  const dayOfMonth = new Date().getDate();
  const attendanceThisMonth = get("SELECT COUNT(*) as c FROM attendance WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [req.user.id]).c;
  const streak = calcStreak(req.user.id);
  const lastCheckIn = get("SELECT date, check_in FROM attendance WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1", [req.user.id]);
  const checkedInToday = get("SELECT id FROM attendance WHERE user_id = ? AND date = ?", [req.user.id, today]);
  const upcomingClasses = all("SELECT cb.*, c.name as class_name, c.duration_minutes, c.room, e.full_name as trainer_name FROM class_bookings cb JOIN classes c ON cb.class_id = c.id LEFT JOIN employees e ON c.trainer_id = e.id WHERE cb.user_id = ? AND cb.booking_date >= ? AND cb.status = 'booked' ORDER BY cb.booking_date LIMIT 5", [req.user.id, today]);
  const upcomingPT = all("SELECT pts.*, e.full_name as trainer_name FROM pt_sessions pts JOIN employees e ON pts.trainer_id = e.id WHERE pts.user_id = ? AND pts.scheduled_date >= ? AND pts.status = 'scheduled' ORDER BY pts.scheduled_date, pts.scheduled_time LIMIT 5", [req.user.id, today]);
  const ptAssignment = get("SELECT pta.*, e.full_name as trainer_name, pp.name as package_name FROM pt_assignments pta JOIN employees e ON pta.trainer_id = e.id LEFT JOIN pt_packages pp ON pta.package_id = pp.id WHERE pta.user_id = ? AND pta.status = 'active'", [req.user.id]);
  const trainer = (membership && membership.trainer_name)
    ? { full_name: membership.trainer_name, plan: membership.plan_name }
    : (ptAssignment ? { full_name: ptAssignment.trainer_name, package: ptAssignment.package_name, sessions_remaining: ptAssignment.sessions_remaining } : null);
  const workoutPlan = get("SELECT * FROM workout_plans WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1", [req.user.id]);
  const dietPlan = get("SELECT * FROM diet_plans WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1", [req.user.id]);
  const outstanding = get("SELECT COALESCE(SUM(balance), 0) as t FROM invoices WHERE user_id = ? AND status = 'pending'", [req.user.id]).t;
  const recentPayments = all("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 5", [req.user.id]);
  const offers = all("SELECT * FROM offers WHERE is_active = 1 AND (end_date IS NULL OR end_date >= ?) LIMIT 5", [today]);
  const notifications = all("SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 5", [req.user.id]);
  const measurements = all("SELECT * FROM body_measurements WHERE user_id = ? ORDER BY measured_date DESC LIMIT 2", [req.user.id]);
  const latest = measurements[0] || null;
  const previous = measurements[1] || null;
  const progress = latest ? {
    latest_weight: latest.weight,
    latest_body_fat: latest.body_fat,
    weight_change: (previous && latest.weight != null && previous.weight != null)
      ? Math.round((latest.weight - previous.weight) * 100) / 100
      : null
  } : null;
  const checkedInTodayBool = !!checkedInToday;
  const daysRemaining = membership ? Math.max(0, Math.ceil((new Date(membership.end_date + 'T00:00:00') - new Date()) / 86400000)) : 0;
  const percentage = dayOfMonth > 0 ? Math.round((attendanceThisMonth / dayOfMonth) * 100) : 0;
  res.json({
    user: profileShape(user),
    membership: membership ? { ...membership, days_remaining: daysRemaining } : null,
    attendance: {
      streak,
      percentage: Math.min(percentage, 100),
      last_check_in: lastCheckIn ? (lastCheckIn.date + ' ' + lastCheckIn.check_in) : null,
      checked_in_today: checkedInTodayBool
    },
    upcoming_classes: upcomingClasses,
    upcoming_pt: upcomingPT,
    trainer,
    workout_plan: workoutPlan,
    diet_plan: dietPlan,
    outstanding,
    recent_payments: recentPayments,
    offers,
    notifications,
    progress
  });
});

// Member Profile
router.get('/profile', (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const documents = all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json({ user: profileShape(user), documents });
});

router.put('/profile', (req, res) => {
  const b = req.body;
  const full_name = b.name || b.full_name || '';
  const date_of_birth = b.dateOfBirth || b.date_of_birth || '';
  const emergency_contact_name = b.emergencyContactName || b.emergency_contact_name || '';
  const emergency_contact_phone = b.emergencyContactPhone || b.emergency_contact_phone || '';
  const medical_info = b.medicalConditions || b.medical_info || '';
  const fitness_goals = b.fitnessGoal || b.fitness_goals || '';
  const preferred_workout_time = b.preferredWorkoutTime || b.preferred_workout_time || '';
  run(`UPDATE users SET full_name=?, phone=?, date_of_birth=?, gender=?, address=?, city=?, state=?, pincode=?, height=?, weight=?, fitness_goals=?, emergency_contact_name=?, emergency_contact_phone=?, medical_info=?, preferred_workout_time=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [full_name, b.phone || '', date_of_birth, b.gender || '', b.address || '', b.city || '', b.state || '', b.pincode || '', b.height || null, b.weight || null, fitness_goals, emergency_contact_name, emergency_contact_phone, medical_info, preferred_workout_time, req.user.id]);
  res.json({ message: 'Profile updated' });
});

router.put('/profile/password', (req, res) => {
  const bcrypt = require('bcryptjs');
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const user = get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, req.user.id]);
  res.json({ message: 'Password changed successfully' });
});

// Membership
router.get('/membership', (req, res) => {
  const membership = get('SELECT m.*, mp.name as plan_name, mp.features, mp.duration_months FROM memberships m JOIN membership_plans mp ON m.plan_id = mp.id WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 1', [req.user.id]);
  if (membership) {
    try { membership.features = JSON.parse(membership.features); } catch(e) { membership.features = []; }
  }
  res.json(membership || null);
});

// Attendance
router.get('/attendance', (req, res) => {
  const records = all('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC, check_in DESC LIMIT 50', [req.user.id]);
  const summary = {
    thisMonth: get("SELECT COUNT(*) as c FROM attendance WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [req.user.id]).c,
    total: get("SELECT COUNT(*) as c FROM attendance WHERE user_id = ?", [req.user.id]).c,
    avgDuration: get("SELECT COALESCE(AVG(duration_minutes), 0) as avg FROM attendance WHERE user_id = ?", [req.user.id]).avg
  };
  res.json({ records, summary });
});

router.post('/attendance/checkin', (req, res) => {
  const today = todayStr();
  const existing = get("SELECT id FROM attendance WHERE user_id = ? AND date = ? AND check_out IS NULL", [req.user.id, today]);
  if (existing) return res.status(400).json({ error: 'Already checked in today' });
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  run('INSERT INTO attendance (user_id, branch_id, check_in, entry_method, date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, 1, time, req.body.entry_method || 'qr', today]);
  res.json({ message: 'Checked in successfully', time });
});

router.post('/attendance/checkout', (req, res) => {
  const today = todayStr();
  const record = get("SELECT * FROM attendance WHERE user_id = ? AND date = ? AND check_out IS NULL", [req.user.id, today]);
  if (!record) return res.status(400).json({ error: 'No active check-in' });
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const parts = (record.check_in || '00:00').split(':');
  const duration = (now.getHours() - parseInt(parts[0])) * 60 + (now.getMinutes() - parseInt(parts[1]));
  run('UPDATE attendance SET check_out = ?, duration_minutes = ? WHERE id = ?', [time, Math.max(duration, 0), record.id]);
  res.json({ message: 'Checked out', duration: Math.max(duration, 0) });
});

// Classes
router.get('/classes', (req, res) => {
  const classes = all('SELECT c.*, e.full_name as trainer_name FROM classes c LEFT JOIN employees e ON c.trainer_id = e.id WHERE c.is_active = 1 ORDER BY c.name');
  const schedules = all('SELECT cs.*, c.name as class_name, c.category, c.duration_minutes, e.full_name as trainer_name FROM class_schedules cs JOIN classes c ON cs.class_id = c.id LEFT JOIN employees e ON c.trainer_id = e.id ORDER BY CASE cs.day_of_week WHEN "Monday" THEN 1 WHEN "Tuesday" THEN 2 WHEN "Wednesday" THEN 3 WHEN "Thursday" THEN 4 WHEN "Friday" THEN 5 WHEN "Saturday" THEN 6 WHEN "Sunday" THEN 7 END, cs.start_time');
  res.json({ classes, schedules });
});

router.get('/class-bookings', (req, res) => {
  const bookings = all("SELECT cb.*, c.name as class_name, c.duration_minutes, c.room, e.full_name as trainer_name FROM class_bookings cb JOIN classes c ON cb.class_id = c.id LEFT JOIN employees e ON c.trainer_id = e.id WHERE cb.user_id = ? ORDER BY cb.booking_date DESC LIMIT 20", [req.user.id]);
  res.json({ items: bookings, total: bookings.length });
});

router.post('/class-bookings', (req, res) => {
  const { class_id, schedule_id, booking_date } = req.body;
  const cls = get('SELECT * FROM classes WHERE id = ?', [class_id]);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const date = booking_date || todayStr();
  const bookedCount = get("SELECT COUNT(*) as c FROM class_bookings WHERE class_id = ? AND booking_date = ? AND status = 'booked'", [class_id, date]).c;
  const existing = get("SELECT id FROM class_bookings WHERE class_id = ? AND user_id = ? AND booking_date = ? AND status = 'booked'", [class_id, req.user.id, date]);
  if (existing) return res.status(400).json({ error: 'Already booked' });
  if (bookedCount >= cls.max_participants) {
    run('INSERT INTO class_waitlist (class_id, schedule_id, user_id, position) VALUES (?, ?, ?, ?)', [class_id, schedule_id || null, req.user.id, bookedCount - cls.max_participants + 1]);
    return res.status(202).json({ message: 'Class is full. You have been added to the waitlist.', waitlisted: true });
  }
  run('INSERT INTO class_bookings (class_id, schedule_id, user_id, booking_date, status) VALUES (?, ?, ?, ?, ?)',
    [class_id, schedule_id || null, req.user.id, date, 'booked']);
  const booking = get("SELECT id FROM class_bookings WHERE class_id = ? AND user_id = ? AND booking_date = ? ORDER BY id DESC LIMIT 1", [class_id, req.user.id, date]);
  res.status(201).json({ message: 'Class booked successfully', id: booking ? booking.id : null, waitlisted: false });
});

router.post('/class-bookings/:id/cancel', (req, res) => {
  const booking = get('SELECT * FROM class_bookings WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  run('UPDATE class_bookings SET status = "cancelled", cancelled_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  res.json({ message: 'Booking cancelled' });
});

// Personal Training
router.get('/pt', (req, res) => {
  const assignment = get("SELECT pta.*, e.full_name as trainer_name, pp.name as package_name, pp.sessions as package_sessions FROM pt_assignments pta JOIN employees e ON pta.trainer_id = e.id LEFT JOIN pt_packages pp ON pta.package_id = pp.id WHERE pta.user_id = ? ORDER BY pta.created_at DESC LIMIT 1", [req.user.id]);
  const sessions = all("SELECT pts.*, e.full_name as trainer_name FROM pt_sessions pts JOIN employees e ON pts.trainer_id = e.id WHERE pts.user_id = ? ORDER BY pts.scheduled_date DESC LIMIT 20", [req.user.id]);
  const packages = all('SELECT * FROM pt_packages WHERE is_active = 1 ORDER BY sessions');
  res.json({ assignment, sessions, packages });
});

// Workout
router.get('/workout', (req, res) => {
  const plan = get('SELECT * FROM workout_plans WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
  let days = [];
  if (plan) {
    days = all('SELECT * FROM workout_days WHERE plan_id = ? ORDER BY day_number', [plan.id]);
    days.forEach(d => {
      d.exercises = all('SELECT * FROM workout_exercises WHERE day_id = ? ORDER BY sort_order', [d.id]);
    });
  }
  const logs = all('SELECT * FROM workout_logs WHERE user_id = ? ORDER BY logged_date DESC LIMIT 20', [req.user.id]);
  res.json({ plan, days, logs });
});

router.post('/workout/logs', (req, res) => {
  const { plan_id, exercise_name, sets_completed, reps_completed, weight_used, notes } = req.body;
  run('INSERT INTO workout_logs (user_id, plan_id, exercise_name, sets_completed, reps_completed, weight_used, notes, logged_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, plan_id || null, exercise_name, sets_completed || 0, reps_completed || '', weight_used || '', notes || '', todayStr()]);
  res.json({ message: 'Workout logged' });
});

// Diet
router.get('/diet', (req, res) => {
  const plan = get('SELECT * FROM diet_plans WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
  const today = todayStr();
  const logs = all('SELECT * FROM diet_logs WHERE user_id = ? AND logged_date = ?', [req.user.id, today]);
  const waterLogs = all('SELECT * FROM water_logs WHERE user_id = ? AND logged_date = ?', [req.user.id, today]);
  const totalCalories = logs.reduce((sum, l) => sum + (l.calories || 0), 0);
  const totalWater = waterLogs.reduce((sum, l) => sum + (l.amount_ml || 0), 0);
  res.json({ plan, logs, waterLogs, totalCalories, totalWater });
});

router.post('/diet/logs', (req, res) => {
  const { diet_plan_id, meal_type, food_item, calories, protein, carbs, fats, notes } = req.body;
  run('INSERT INTO diet_logs (user_id, diet_plan_id, meal_type, food_item, calories, protein, carbs, fats, logged_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, diet_plan_id || null, meal_type, food_item, calories || 0, protein || 0, carbs || 0, fats || 0, todayStr(), notes || '']);
  res.json({ message: 'Meal logged' });
});

router.post('/water', (req, res) => {
  const glasses = parseFloat(req.body.glasses) || 0;
  const amountMl = (req.body.amount_ml != null ? parseFloat(req.body.amount_ml) : 0) || glasses * 250;
  const today = todayStr();
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  run('INSERT INTO water_logs (user_id, amount_ml, logged_date, logged_time) VALUES (?, ?, ?, ?)',
    [req.user.id, amountMl || 250, today, time]);
  const total = get("SELECT COALESCE(SUM(amount_ml), 0) as total FROM water_logs WHERE user_id = ? AND logged_date = ?", [req.user.id, today]).total;
  res.json({ message: 'Water logged', total_today: total });
});

// Progress
router.get('/progress', (req, res) => {
  const measurements = all('SELECT * FROM body_measurements WHERE user_id = ? ORDER BY measured_date DESC LIMIT 20', [req.user.id]);
  const photos = all('SELECT * FROM progress_photos WHERE user_id = ? ORDER BY photo_date DESC LIMIT 20', [req.user.id]);
  res.json({ measurements, photos });
});

router.post('/measurements', (req, res) => {
  const { weight, height, body_fat, chest, waist, arms, thighs, hips, shoulders, neck, calves, notes } = req.body;
  const bmi = height ? (weight / ((height / 100) ** 2)).toFixed(1) : null;
  run('INSERT INTO body_measurements (user_id, weight, height, bmi, body_fat, chest, waist, arms, thighs, hips, shoulders, neck, calves, notes, measured_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, weight || null, height || null, bmi, body_fat || null, chest || null, waist || null, arms || null, thighs || null, hips || null, shoulders || null, neck || null, calves || null, notes || '', todayStr()]);
  if (weight) run('UPDATE users SET weight = ? WHERE id = ?', [weight, req.user.id]);
  if (height) run('UPDATE users SET height = ? WHERE id = ?', [height, req.user.id]);
  res.json({ message: 'Measurements recorded', bmi });
});

// Payments
router.get('/payments', (req, res) => {
  const payments = all('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  const invoices = all('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  res.json({ items: payments, total: payments.length, invoices: { items: invoices, total: invoices.length } });
});

// Support
router.get('/tickets', (req, res) => {
  const tickets = all('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(tickets);
});

router.post('/tickets', (req, res) => {
  const { category, priority, subject, description } = req.body;
  if (!subject) return res.status(400).json({ error: 'Subject is required' });
  const ticketId = 'TKT-' + Date.now().toString(36).toUpperCase();
  run('INSERT INTO tickets (ticket_id, user_id, category, priority, subject, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [ticketId, req.user.id, category, priority || 'medium', subject, description || '', 'open']);
  run("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Ticket opened', ?, 'info')",
    [req.user.id, 'Support ticket ' + ticketId + ' has been created. We will respond soon.']);
  res.status(201).json({ message: 'Ticket created', ticket_id: ticketId });
});

router.get('/tickets/:id', (req, res) => {
  const ticket = get('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const messages = all('SELECT tm.*, u.full_name as sender_name, tm.message as text FROM ticket_messages tm JOIN users u ON tm.sender_id = u.id WHERE tm.ticket_id = ? ORDER BY tm.created_at', [req.params.id]);
  res.json({ ticket, messages });
});

router.post('/tickets/:id/messages', (req, res) => {
  const ticket = get('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const message = req.body.message || req.body.text;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  run('INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)',
    [req.params.id, req.user.id, message]);
  run('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  res.json({ message: 'Message sent' });
});

// Referrals
router.get('/referrals', (req, res) => {
  const referrals = all('SELECT * FROM referrals WHERE referrer_id = ?', [req.user.id]);
  const code = get('SELECT referral_code FROM referrals WHERE referrer_id = ? LIMIT 1', [req.user.id]);
  res.json({ referrals, code: code ? code.referral_code : null });
});

// Notifications
router.get('/notifications', (req, res) => {
  const notifications = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [req.user.id]);
  const unreadCount = get('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]).c;
  res.json({ items: notifications, total: notifications.length, unreadCount });
});

router.put('/notifications/:id/read', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read' });
});

// Plans (public)
router.get('/plans', (req, res) => {
  const plans = all('SELECT * FROM membership_plans WHERE is_active = 1 ORDER BY sort_order');
  res.json(plans);
});

module.exports = router;