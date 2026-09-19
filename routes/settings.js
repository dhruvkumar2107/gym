const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

router.get('/', (req, res) => {
  const settings = all('SELECT * FROM site_settings');
  const obj = {};
  settings.forEach(s => obj[s.key] = s.value);
  res.json(obj);
});

module.exports = router;
