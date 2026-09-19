const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

router.get('/', (req, res) => {
  const testimonials = all('SELECT * FROM testimonials WHERE is_approved = 1 AND is_active = 1 ORDER BY date DESC');
  res.json(testimonials);
});

module.exports = router;
