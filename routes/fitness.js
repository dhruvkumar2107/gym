const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authMiddleware, adminMiddleware);

let notifyMod = {};
try { notifyMod = require('../services/notify'); } catch (e) {}
const createNotification = notifyMod.createNotification || function (n) {
  try {
    run('INSERT INTO notifications (user_id, title, message, type, module) VALUES (?, ?, ?, ?, ?)',
      [n && n.user_id !== undefined ? n.user_id : null, (n && n.title) || '', (n && (n.body || n.message)) || '', (n && n.type) || 'info', (n && (n.link || n.module)) || null]);
  } catch (e) {}
  return null;
};
const logAudit = notifyMod.logAudit || function (a) {
  try {
    const u = (a && a.req && a.req.user) || null;
    run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [(a && a.user_id) || (u && u.id) || null, (u && u.full_name) || null, (a && a.action) || '', (a && a.entity_type) || null, (a && a.entity_id) || null, (a && a.entity_name) || null, a && a.previous_value != null ? String(a.previous_value) : null, a && a.new_value != null ? String(a.new_value) : null]);
  } catch (e) {}
  return null;
};

router.put('/workout-plans/:id', (req, res) => {
  const plan = get('SELECT * FROM workout_plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ error: 'Workout plan not found' });
  const { title, user_id, trainer_id, duration_weeks, notes, description, days } = req.body;
  run('UPDATE workout_plans SET name = ?, user_id = ?, trainer_id = ?, duration_weeks = ?, description = ? WHERE id = ?',
    [title || plan.name, user_id !== undefined ? user_id : plan.user_id, trainer_id !== undefined ? trainer_id : plan.trainer_id, duration_weeks !== undefined ? duration_weeks : plan.duration_weeks, notes || description !== undefined ? (description !== undefined ? description : plan.description) : plan.description, req.params.id]);
  if (days && days.length) {
    const oldDays = all('SELECT id FROM workout_days WHERE plan_id = ?', [req.params.id]);
    oldDays.forEach(d => { run('DELETE FROM workout_exercises WHERE day_id = ?', [d.id]); });
    run('DELETE FROM workout_days WHERE plan_id = ?', [req.params.id]);
    days.forEach((day, idx) => {
      const dayRec = run('INSERT INTO workout_days (plan_id, day_number, day_name, focus, notes) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, idx + 1, day.day_name || ('Day ' + (idx + 1)), day.focus || '', day.notes || '']);
      const dayId = dayRec.lastID;
      if (day.exercises && day.exercises.length) {
        day.exercises.forEach((ex, ei) => {
          run('INSERT INTO workout_exercises (day_id, exercise_name, sets, reps, weight, rest_seconds, tempo, notes, video_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [dayId, ex.name || ex.exercise_name || '', ex.sets || 3, ex.reps || '10', ex.weight !== undefined ? ex.weight : '', ex.rest !== undefined ? ex.rest : 60, ex.tempo || '', ex.notes || '', ex.video_url || '', ei + 1]);
        });
      }
    });
  }
  logAudit({ req, action: 'UPDATE', entity_type: 'workout_plan', entity_id: plan.id, entity_name: title || plan.name, previous_value: JSON.stringify({ name: plan.name }), new_value: JSON.stringify({ name: title || plan.name }) });
  res.json({ message: 'Workout plan updated', id: plan.id });
});

router.delete('/workout-plans/:id', (req, res) => {
  const plan = get('SELECT * FROM workout_plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ error: 'Workout plan not found' });
  const days = all('SELECT id FROM workout_days WHERE plan_id = ?', [plan.id]);
  days.forEach(d => { run('DELETE FROM workout_exercises WHERE day_id = ?', [d.id]); });
  run('DELETE FROM workout_days WHERE plan_id = ?', [plan.id]);
  run('DELETE FROM workout_plans WHERE id = ?', [plan.id]);
  logAudit({ req, action: 'DELETE', entity_type: 'workout_plan', entity_id: plan.id, entity_name: plan.name });
  res.json({ message: 'Workout plan deleted' });
});

router.get('/workout-plans', (req, res) => {
  const { user_id, trainer_id, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT wp.*, u.full_name as member_name, e.full_name as trainer_name FROM workout_plans wp LEFT JOIN users u ON wp.user_id = u.id LEFT JOIN employees e ON wp.trainer_id = e.id';
  const conditions = [];
  const params = [];
  if (user_id) { conditions.push('wp.user_id = ?'); params.push(user_id); }
  if (trainer_id) { conditions.push('wp.trainer_id = ?'); params.push(trainer_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const total = get('SELECT COUNT(*) as total FROM workout_plans wp' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params).total;
  const items = all(sql + ' ORDER BY wp.created_at DESC LIMIT ? OFFSET ?', params.concat([parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]));
  items.forEach(p => {
    p.days = all('SELECT * FROM workout_days WHERE plan_id = ? ORDER BY day_number', [p.id]);
    p.days.forEach(d => { d.exercises = all('SELECT * FROM workout_exercises WHERE day_id = ? ORDER BY sort_order', [d.id]); });
  });
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/workout-plans/:id/detail', (req, res) => {
  const plan = get('SELECT wp.*, u.full_name as member_name, e.full_name as trainer_name FROM workout_plans wp LEFT JOIN users u ON wp.user_id = u.id LEFT JOIN employees e ON wp.trainer_id = e.id WHERE wp.id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ error: 'Workout plan not found' });
  const days = all('SELECT * FROM workout_days WHERE plan_id = ? ORDER BY day_number', [plan.id]);
  days.forEach(d => { d.exercises = all('SELECT * FROM workout_exercises WHERE day_id = ? ORDER BY sort_order', [d.id]); });
  res.json({ plan, days });
});

router.get('/diet-plans/:id/detail', (req, res) => {
  const plan = get('SELECT * FROM diet_plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ error: 'Diet plan not found' });
  let meals = [];
  if (plan.meals) {
    try { meals = JSON.parse(plan.meals); } catch (e) { meals = []; }
  }
  let supplements = [];
  if (plan.supplements) {
    try { supplements = JSON.parse(plan.supplements); } catch (e) { supplements = []; }
  }
  res.json(Object.assign({}, plan, { meals, supplements }));
});

router.post('/diet-plans/:id/assign', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  const plan = get('SELECT * FROM diet_plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ error: 'Diet plan not found' });
  run('UPDATE diet_plans SET user_id = ?, is_active = 1 WHERE id = ?', [user_id, req.params.id]);
  try { createNotification({ user_id, type: 'diet', title: 'New diet plan assigned', body: `You have been assigned the diet plan '${plan.name}'.`, link: '/portal' }); } catch (e) {}
  logAudit({ req, action: 'ASSIGN', entity_type: 'diet_plan', entity_id: plan.id, entity_name: plan.name, previous_value: JSON.stringify({ user_id: plan.user_id }), new_value: JSON.stringify({ user_id }) });
  res.json({ message: 'Diet plan assigned', id: plan.id });
});

router.post('/progress-photos', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { user_id, notes, weight } = req.body;
  const targetUser = user_id || req.user.id;
  const ins = run('INSERT INTO progress_photos (user_id, photo_url, photo_type, weight, notes, photo_date) VALUES (?, ?, ?, ?, ?, ?)',
    [targetUser, '/uploads/' + req.file.filename, req.body.photo_type || 'front', weight || null, notes || '', new Date().toISOString().split('T')[0]]);
  const id = ins.lastID;
  logAudit({ req, action: 'UPLOAD', entity_type: 'progress_photo', entity_id: id, entity_name: 'User #' + targetUser });
  res.json({ message: 'Photo uploaded', id });
});

router.get('/progress-photos', (req, res) => {
  const { user_id, page = 1, limit = 50 } = req.query;
  const where = user_id ? ' WHERE user_id = ?' : ' WHERE user_id = ' + req.user.id;
  const params = user_id ? [user_id] : [];
  const total = get('SELECT COUNT(*) as total FROM progress_photos' + where, params).total;
  const items = all('SELECT * FROM progress_photos' + where + ' ORDER BY photo_date DESC LIMIT ? OFFSET ?', params.concat([parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]));
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/exercises', (req, res) => {
  const { search, category, page = 1, limit = 50 } = req.query;
  const conditions = [];
  const params = [];
  if (search) { conditions.push('name LIKE ?'); params.push('%' + search + '%'); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const total = get('SELECT COUNT(*) as total FROM exercise_library' + where, params).total;
  const items = all('SELECT * FROM exercise_library' + where + ' ORDER BY name LIMIT ? OFFSET ?', params.concat([parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]));
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/exercises', (req, res) => {
  const { name, category, muscle_group, equipment, difficulty, description, video_url, image, instructions } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const ins = run('INSERT INTO exercise_library (name, category, muscle_group, equipment, difficulty, description, video_url, image, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, category || '', muscle_group || '', equipment || '', difficulty || 'intermediate', description || '', video_url || '', image || '', instructions || '']);
  const id = ins.lastID;
  logAudit({ req, action: 'CREATE', entity_type: 'exercise', entity_id: id, entity_name: name });
  res.json({ message: 'Exercise created', id });
});

router.put('/exercises/:id', (req, res) => {
  const prev = get('SELECT * FROM exercise_library WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Exercise not found' });
  const { name, category, muscle_group, equipment, difficulty, description, video_url, image, instructions } = req.body;
  run('UPDATE exercise_library SET name = ?, category = ?, muscle_group = ?, equipment = ?, difficulty = ?, description = ?, video_url = ?, image = ?, instructions = ? WHERE id = ?',
    [name || prev.name, category !== undefined ? category : prev.category, muscle_group !== undefined ? muscle_group : prev.muscle_group, equipment !== undefined ? equipment : prev.equipment, difficulty !== undefined ? difficulty : prev.difficulty, description !== undefined ? description : prev.description, video_url !== undefined ? video_url : prev.video_url, image !== undefined ? image : prev.image, instructions !== undefined ? instructions : prev.instructions, req.params.id]);
  logAudit({ req, action: 'UPDATE', entity_type: 'exercise', entity_id: req.params.id, entity_name: prev.name });
  res.json({ message: 'Exercise updated' });
});

module.exports = router;