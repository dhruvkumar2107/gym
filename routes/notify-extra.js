const express = require('express');
const router = express.Router();
const { get, all } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/unread-count', authMiddleware, (req, res) => {
  const count = get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]).count;
  res.json({ count });
});

router.get('/grouped', authMiddleware, (req, res) => {
  const notifications = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', [req.user.id]);
  const grouped = {};
  notifications.forEach(n => {
    const date = String(n.created_at || '').slice(0, 10);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(n);
  });
  const items = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1)).map(date => ({ date, notifications: grouped[date] }));
  res.json({ items, total: notifications.length });
});

router.get('/type-counts', authMiddleware, (req, res) => {
  const items = all('SELECT type, COUNT(*) as count, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread FROM notifications WHERE user_id = ? GROUP BY type ORDER BY count DESC', [req.user.id]);
  res.json({ items });
});

module.exports = router;