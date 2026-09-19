const express = require('express');
const router = express.Router();

router.post('/bmi', (req, res) => {
  const { height, weight } = req.body;
  if (!height || !weight) return res.status(400).json({ error: 'Height and weight are required' });
  const heightM = height / 100;
  const bmi = (weight / (heightM * heightM)).toFixed(1);
  let category = '';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal weight';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';
  res.json({ bmi: parseFloat(bmi), category, height, weight, note: 'This is an estimate only. Consult a healthcare professional for medical advice.' });
});

router.post('/calories', (req, res) => {
  const { age, sex, height, weight, activity, goal } = req.body;
  if (!age || !sex || !height || !weight) return res.status(400).json({ error: 'All fields are required' });
  let bmr;
  if (sex === 'male') bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  else bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  const activityMultipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const multiplier = activityMultipliers[activity] || 1.55;
  const maintenance = Math.round(bmr * multiplier);
  const weightLoss = Math.round(maintenance - 500);
  const weightGain = Math.round(maintenance + 300);
  res.json({ bmr: Math.round(bmr), maintenance, weightLoss, weightGain, note: 'Results are estimates only. Consult a nutritionist for personalized advice.' });
});

module.exports = router;
