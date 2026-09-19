const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

router.get('/', (req, res) => {
  const now = new Date().toISOString().split('T')[0];
  const offers = all("SELECT * FROM offers WHERE is_active = 1 AND start_date <= ? AND end_date >= ? AND (usage_limit = 0 OR used_count < usage_limit) ORDER BY id DESC", [now, now]);
  res.json(offers);
});

module.exports = router;
