const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

router.get('/', (req, res) => {
  res.json(all('SELECT * FROM transformations WHERE is_active = 1'));
});

module.exports = router;
