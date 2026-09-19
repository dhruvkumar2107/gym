const express = require('express');
const router = express.Router();
const { all } = require('../database/db');

router.get('/', (req, res) => {
  const locations = all('SELECT * FROM locations WHERE is_active = 1');
  locations.forEach(l => {
    try { l.opening_hours = JSON.parse(l.opening_hours); } catch(e) { l.opening_hours = {}; }
    try { l.facilities = JSON.parse(l.facilities); } catch(e) { l.facilities = []; }
  });
  res.json(locations);
});

router.get('/:slug', (req, res) => {
  const loc = all('SELECT * FROM locations WHERE slug = ? AND is_active = 1', [req.params.slug]);
  if (!loc.length) return res.status(404).json({ error: 'Location not found' });
  try { loc[0].opening_hours = JSON.parse(loc[0].opening_hours); } catch(e) { loc[0].opening_hours = {}; }
  try { loc[0].facilities = JSON.parse(loc[0].facilities); } catch(e) { loc[0].facilities = []; }
  res.json(loc[0]);
});

module.exports = router;
