const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

router.get('/', (req, res) => {
  res.json(all('SELECT * FROM facilities WHERE is_active = 1 ORDER BY sort_order'));
});

module.exports = router;
