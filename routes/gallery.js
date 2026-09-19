const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

router.get('/', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM gallery WHERE is_active = 1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY sort_order';
  res.json(all(sql, params));
});

router.get('/categories', (req, res) => {
  const cats = all('SELECT DISTINCT category FROM gallery WHERE is_active = 1');
  res.json(cats.map(c => c.category));
});

module.exports = router;
