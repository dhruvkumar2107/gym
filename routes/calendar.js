const express = require('express');
const router = express.Router();
const { get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware, adminMiddleware);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function datesInRange(startStr, endStr) {
  const out = [];
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  const max = 120;
  for (let d = new Date(start); d <= end && out.length < max; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
}

function isoDateTime(dateObj, timeStr) {
  const t = String(timeStr || '').trim();
  if (!t) return dateObj.toISOString().slice(0, 10);
  const parts = t.split(':');
  dateObj.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, parseInt(parts[2]) || 0);
  return dateObj.toISOString();
}

router.get('/calendar', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { start, end } = req.query;
  const startStr = start || today;
  const endStr = end || new Date(Date.now() + 29 * 86400000).toISOString().slice(0, 10);
  const items = [];
  const dateObjs = datesInRange(startStr, endStr);

  dateObjs.forEach(dObj => {
    const dateStr = dObj.toISOString().slice(0, 10);
    const weekday = WEEKDAYS[dObj.getDay()];

    const schedules = all('SELECT cs.*, c.id as class_id, c.name as class_name, c.duration_minutes, e.full_name as trainer_name FROM class_schedules cs JOIN classes c ON cs.class_id = c.id LEFT JOIN employees e ON c.trainer_id = e.id WHERE cs.status = "scheduled" AND (cs.day_of_week = ? OR cs.specific_date = ?)', [weekday, dateStr]);
    schedules.forEach(s => {
      if (s.specific_date && s.specific_date !== dateStr) return;
      const d = new Date(dObj);
      items.push({
        id: 'class-' + s.id,
        type: 'class',
        title: s.class_name,
        start: isoDateTime(d, s.start_time),
        end: isoDateTime(d, s.end_time || s.start_time),
        meta: { class_id: s.class_id, trainer: s.trainer_name || '', location: s.location || '', max_participants: s.max_participants }
      });
    });

    const ptSessions = all("SELECT pts.*, u.full_name as member_name, e.full_name as trainer_name FROM pt_sessions pts JOIN users u ON pts.user_id = u.id LEFT JOIN employees e ON pts.trainer_id = e.id WHERE pts.scheduled_date = ? AND pts.status = 'scheduled'", [dateStr]);
    ptSessions.forEach(p => {
      const d = new Date(dObj);
      items.push({
        id: 'pt-' + p.id,
        type: 'pt',
        title: 'PT: ' + (p.member_name || 'Member'),
        start: isoDateTime(d, p.scheduled_time || '09:00'),
        end: isoDateTime(d, p.scheduled_time || '09:00'),
        meta: { trainer: p.trainer_name || '', duration_minutes: p.duration_minutes, status: p.status }
      });
    });

    const appointments = all('SELECT a.*, u.full_name as member_name FROM appointments a LEFT JOIN users u ON a.user_id = u.id WHERE a.date = ?', [dateStr]);
    appointments.forEach(a => {
      const d = new Date(dObj);
      items.push({
        id: 'appointment-' + a.id,
        type: 'appointment',
        title: (a.type ? a.type[0].toUpperCase() + a.type.slice(1) + ': ' : 'Appointment: ') + (a.member_name || 'Guest'),
        start: isoDateTime(d, a.time || '09:00'),
        end: isoDateTime(d, a.time || '09:00'),
        meta: { status: a.status, notes: a.notes || '', appointment_id: a.id }
      });
    });
  });

  const followups = all("SELECT lf.id, lf.lead_id, lf.next_followup_date, l.name as lead_name, l.phone FROM lead_followups lf JOIN leads l ON lf.lead_id = l.id WHERE lf.next_followup_date >= ? AND lf.next_followup_date <= ?", [startStr, endStr]);
  followups.forEach(f => {
    items.push({
      id: 'followup-' + f.id,
      type: 'followup',
      title: 'Follow up: ' + f.lead_name,
      start: f.next_followup_date + 'T09:00:00',
      end: f.next_followup_date + 'T10:00:00',
      meta: { lead_id: f.lead_id, phone: f.phone || '', lead_name: f.lead_name }
    });
  });

  const tasks = all("SELECT * FROM tasks WHERE due_date >= ? AND due_date <= ?", [startStr, endStr]);
  tasks.forEach(t => {
    items.push({
      id: 'task-' + t.id,
      type: 'task',
      title: t.title,
      start: t.due_date + 'T09:00:00',
      end: t.due_date + 'T09:00:00',
      meta: { status: t.status, priority: t.priority, assigned_to: t.assigned_to }
    });
  });

  const announcements = all('SELECT * FROM announcements WHERE start_date >= ? AND start_date <= ? AND is_active = 1', [startStr, endStr]);
  announcements.forEach(a => {
    items.push({
      id: 'announcement-' + a.id,
      type: 'announcement',
      title: 'Announcement: ' + a.title,
      start: a.start_date + 'T09:00:00',
      end: (a.end_date || a.start_date) + 'T18:00:00',
      meta: { priority: a.priority, content: a.content || '' }
    });
  });

  items.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  res.json({ items, total: items.length, start: startStr, end: endStr });
});

module.exports = router;