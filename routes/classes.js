const express = require('express');
const router = express.Router();
const { all, get } = require('../database/db');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function nextOccurrence(dayName, fromDate) {
  const from = new Date(fromDate + 'T00:00:00');
  const target = WEEKDAYS.indexOf(dayName);
  for (let i = 0; i < 8; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    if (d.getDay() === target) return d.toISOString().slice(0, 10);
  }
  return fromDate;
}

router.get('/', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const classes = all('SELECT c.*, e.full_name as trainer_name, e.id as trainer_employee_id FROM classes c LEFT JOIN employees e ON c.trainer_id = e.id WHERE c.is_active = 1 ORDER BY c.id');
  classes.forEach(c => {
    const booked = get("SELECT COUNT(*) as c FROM class_bookings WHERE class_id = ? AND status = 'booked' AND booking_date = ?", [c.id, today]).c;
    c.booked_count = booked;
    c.seats_left = Math.max(0, (c.max_participants || 0) - booked);
  });
  res.json(classes);
});

router.get('/schedule', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const schedules = all(`SELECT cs.*, c.name as class_name, c.difficulty, c.duration_minutes, c.id as class_id, c.max_participants,
    e.full_name as trainer_name
    FROM class_schedules cs
    JOIN classes c ON cs.class_id = c.id
    LEFT JOIN employees e ON c.trainer_id = e.id
    ORDER BY CASE cs.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 WHEN 'Sunday' THEN 7 END, cs.start_time`);
  schedules.forEach(s => {
    const targetDate = (s.specific_date && s.specific_date >= today && s.specific_date) || nextOccurrence(s.day_of_week, today);
    s.next_date = targetDate;
    const booked = get("SELECT COUNT(*) as c FROM class_bookings WHERE class_id = ? AND status = 'booked' AND booking_date = ?", [s.class_id, targetDate]).c;
    s.booked_count = booked;
    s.seats_left = Math.max(0, (s.max_participants || 0) - booked);
  });
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
