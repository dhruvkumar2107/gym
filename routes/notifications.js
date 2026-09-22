const express = require('express');
const router = express.Router();
const { all, run, get } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  const notifications = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json({ items: notifications, total: notifications.length });
});

router.get('/unread-count', authMiddleware, (req, res) => {
  const count = get('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]).c;
  res.json({ count });
});

router.put('/:id/read', authMiddleware, (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read' });
});

router.put('/read-all', authMiddleware, (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'All marked as read' });
});

module.exports = router;