const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

router.get('/', (req, res) => {
  res.json(all('SELECT c.*, e.full_name as trainer_name, e.id as trainer_employee_id FROM classes c LEFT JOIN employees e ON c.trainer_id = e.id WHERE c.is_active = 1 ORDER BY c.id'));
});

router.get('/schedule', (req, res) => {
  const schedules = all(`SELECT cs.*, c.name as class_name, c.difficulty, c.duration_minutes, c.id as class_id,
    e.full_name as trainer_name
    FROM class_schedules cs
    JOIN classes c ON cs.class_id = c.id
    LEFT JOIN employees e ON c.trainer_id = e.id
    ORDER BY CASE cs.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 WHEN 'Sunday' THEN 7 END, cs.start_time`);
  res.json(schedules);
});

router.get('/categories', (req, res) => {
  const cats = all('SELECT DISTINCT category FROM classes WHERE is_active = 1');
  res.json(cats.map(c => c.category));
});

router.get('/:slug', (req, res) => {
  const cls = all('SELECT c.*, e.full_name as trainer_name, e.id as trainer_employee_id FROM classes c LEFT JOIN employees e ON c.trainer_id = e.id WHERE c.slug = ?', [req.params.slug]);
  if (!cls.length) return res.status(404).json({ error: 'Class not found' });
  const schedules = all('SELECT * FROM class_schedules WHERE class_id = ?', [cls[0].id]);
  res.json({ class: cls[0], schedules });
});

module.exports = router;
