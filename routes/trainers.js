const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');

router.get('/', (req, res) => {
  const trainers = all('SELECT * FROM trainers WHERE is_active = 1 ORDER BY sort_order');
  trainers.forEach(t => {
    try { t.certifications = JSON.parse(t.certifications); } catch(e) { t.certifications = []; }
    try { t.specializations = JSON.parse(t.specializations); } catch(e) { t.specializations = []; }
    try { t.social_links = JSON.parse(t.social_links); } catch(e) { t.social_links = {}; }
  });
  res.json(trainers);
});

router.get('/:slug', (req, res) => {
  const trainer = get('SELECT * FROM trainers WHERE slug = ? AND is_active = 1', [req.params.slug]);
  if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
  try { trainer.certifications = JSON.parse(trainer.certifications); } catch(e) { trainer.certifications = []; }
  try { trainer.specializations = JSON.parse(trainer.specializations); } catch(e) { trainer.specializations = []; }
  try { trainer.social_links = JSON.parse(trainer.social_links); } catch(e) { trainer.social_links = {}; }
  const classes = all('SELECT * FROM classes WHERE trainer_id = ? AND is_active = 1', [trainer.id]);
  res.json({ trainer, classes });
});

module.exports = router;
