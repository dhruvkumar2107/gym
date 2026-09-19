const express = require('express');
const router = express.Router();

const workoutLibrary = [
  { id: 1, name: 'Barbell Bench Press', category: 'chest', target: 'Pectorals, Triceps, Front Delts', equipment: 'Barbell, Bench', difficulty: 'intermediate', sets: '4', reps: '8-12', rest: '90 sec', description: 'Lie on a flat bench, grip the barbell slightly wider than shoulder-width. Lower to chest, press up explosively.', instructions: ['Lie flat on bench with feet on floor','Grip bar slightly wider than shoulders','Unrack and lower to mid-chest','Press up to full lockout','Keep shoulder blades retracted'] },
  { id: 2, name: 'Incline Dumbbell Press', category: 'chest', target: 'Upper Pectorals, Triceps', equipment: 'Dumbbells, Incline Bench', difficulty: 'intermediate', sets: '3', reps: '10-12', rest: '75 sec', description: 'Set bench to 30-45 degrees. Press dumbbells from shoulder level to full extension.', instructions: ['Set bench to 30-45 degrees','Hold dumbbells at shoulder height','Press up and slightly inward','Lower with control','Avoid locking elbows'] },
  { id: 3, name: 'Pull-Ups', category: 'back', target: 'Lats, Biceps, Rear Delts', equipment: 'Pull-up Bar', difficulty: 'intermediate', sets: '4', reps: '8-12', rest: '90 sec', description: 'Hang from bar with overhand grip. Pull chin above bar, lower with control.', instructions: ['Grip bar shoulder-width apart','Hang with arms fully extended','Pull up until chin clears bar','Lower slowly to starting position','Avoid swinging'] },
  { id: 4, name: 'Barbell Row', category: 'back', target: 'Rhomboids, Lats, Biceps', equipment: 'Barbell', difficulty: 'intermediate', sets: '4', reps: '8-12', rest: '90 sec', description: 'Hinge at hips, grip barbell, row to lower chest keeping back flat.', instructions: ['Hinge at hips with slight knee bend','Grip bar shoulder-width apart','Row to lower chest/upper abs','Squeeze shoulder blades together','Keep core braced throughout'] },
  { id: 5, name: 'Barbell Back Squat', category: 'legs', target: 'Quads, Glutes, Hamstrings', equipment: 'Barbell, Squat Rack', difficulty: 'intermediate', sets: '4', reps: '6-10', rest: '120 sec', description: 'Place bar on upper back. Squat down until thighs parallel, drive back up.', instructions: ['Set bar on upper traps','Feet shoulder-width apart','Descend until thighs parallel','Drive through heels to stand','Keep chest up and core tight'] },
  { id: 6, name: 'Romanian Deadlift', category: 'legs', target: 'Hamstrings, Glutes, Lower Back', equipment: 'Barbell', difficulty: 'intermediate', sets: '3', reps: '10-12', rest: '90 sec', description: 'Hold barbell at hip level. Hinge at hips, lower bar along legs, return to standing.', instructions: ['Hold bar at hip level','Hinge at hips pushing them back','Lower bar along thighs','Feel hamstring stretch','Drive hips forward to return'] },
  { id: 7, name: 'Overhead Press', category: 'shoulders', target: 'Front Delts, Side Delts, Triceps', equipment: 'Barbell', difficulty: 'intermediate', sets: '4', reps: '8-10', rest: '90 sec', description: 'Press barbell from front of shoulders to overhead lockout.', instructions: ['Start with bar at collar bone','Grip just outside shoulders','Press straight up','Lock out overhead','Lower with control'] },
  { id: 8, name: 'Lateral Raises', category: 'shoulders', target: 'Side Delts', equipment: 'Dumbbells', difficulty: 'beginner', sets: '3', reps: '12-15', rest: '60 sec', description: 'Raise dumbbells to sides until arms parallel to floor.', instructions: ['Stand with dumbbells at sides','Raise arms out to shoulder height','Slight bend in elbows','Lower slowly','Avoid momentum'] },
  { id: 9, name: 'Barbell Curl', category: 'arms', target: 'Biceps', equipment: 'Barbell', difficulty: 'beginner', sets: '3', reps: '10-12', rest: '60 sec', description: 'Curl barbell from thigh level to shoulder height.', instructions: ['Stand with bar at thigh level','Curl up keeping elbows fixed','Squeeze biceps at top','Lower with control','Avoid swinging body'] },
  { id: 10, name: 'Tricep Dips', category: 'arms', target: 'Triceps, Chest', equipment: 'Dip Station', difficulty: 'intermediate', sets: '3', reps: '10-15', rest: '75 sec', description: 'Lower body between parallel bars, push back up.', instructions: ['Grip bars and lift body','Lower until elbows at 90 degrees','Push back to start','Keep torso upright for triceps','Lean forward to target chest more'] },
  { id: 11, name: 'Plank', category: 'core', target: 'Transverse Abdominis, Obliques', equipment: 'None', difficulty: 'beginner', sets: '3', reps: '30-60 sec', rest: '45 sec', description: 'Hold a straight body position on forearms and toes.', instructions: ['Position on forearms and toes','Keep body in straight line','Engage core and glutes','Do not let hips sag','Breathe steadily'] },
  { id: 12, name: 'Dead Bug', category: 'core', target: 'Deep Core, Hip Flexors', equipment: 'None', difficulty: 'beginner', sets: '3', reps: '10 each side', rest: '45 sec', description: 'Alternate extending opposite arm and leg while maintaining core engagement.', instructions: ['Lie on back, arms up, knees bent 90 deg','Extend right arm overhead, left leg straight','Return and switch sides','Keep lower back pressed to floor','Move slowly with control'] },
  { id: 13, name: 'Burpees', category: 'full_body', target: 'Full Body', equipment: 'None', difficulty: 'intermediate', sets: '3', reps: '10-15', rest: '60 sec', description: 'Drop to floor, push-up, jump feet to hands, jump up with arms overhead.', instructions: ['Stand, then drop to squat','Kick feet back to plank','Perform push-up','Jump feet to hands','Explosively jump up'] },
  { id: 14, name: 'Kettlebell Swing', category: 'full_body', target: 'Glutes, Hamstrings, Core', equipment: 'Kettlebell', difficulty: 'intermediate', sets: '3', reps: '15-20', rest: '60 sec', description: 'Swing kettlebell from between legs to eye level using hip drive.', instructions: ['Stand with feet wider than shoulders','Hinge at hips, grip kettlebell','Swing between legs','Drive hips forward to swing up','Arms stay straight throughout'] },
  { id: 15, name: 'Goblet Squat', category: 'legs', target: 'Quads, Glutes', equipment: 'Kettlebell or Dumbbell', difficulty: 'beginner', sets: '3', reps: '12-15', rest: '60 sec', description: 'Hold weight at chest level, squat down to full depth.', instructions: ['Hold weight at chest','Feet shoulder-width apart','Squat down between heels','Drive back up through heels','Keep elbows inside knees'] },
  { id: 16, name: 'Push-Ups', category: 'chest', target: 'Pectorals, Triceps, Delts', equipment: 'None', difficulty: 'beginner', sets: '3', reps: '15-20', rest: '60 sec', description: 'Standard push-up from toes, lowering chest to floor.', instructions: ['Hands shoulder-width apart','Body in straight line','Lower chest to floor','Push back up','Keep core engaged'] }
];

router.get('/', (req, res) => {
  const { category } = req.query;
  if (category) {
    return res.json(workoutLibrary.filter(w => w.category === category));
  }
  res.json(workoutLibrary);
});

router.get('/categories', (req, res) => {
  const cats = [...new Set(workoutLibrary.map(w => w.category))];
  res.json(cats);
});

router.get('/:id', (req, res) => {
  const workout = workoutLibrary.find(w => w.id === parseInt(req.params.id));
  if (!workout) return res.status(404).json({ error: 'Exercise not found' });
  res.json(workout);
});

module.exports = router;
