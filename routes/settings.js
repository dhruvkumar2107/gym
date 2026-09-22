const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

const SENSITIVE_PATTERNS = ['password', 'pass', 'secret', 'key', 'token'];

function isSensitive(key) {
  const lower = key.toLowerCase();
  return SENSITIVE_PATTERNS.some(p => lower.indexOf(p) !== -1);
}

router.get('/', (req, res) => {
  const settings = all('SELECT * FROM site_settings');
  const obj = {};
  settings.forEach(s => {
    obj[s.key] = isSensitive(s.key) ? (s.value ? '••••••••' : '') : s.value;
  });
  res.json(obj);
});

module.exports = router;