const { run, get, all, exec } = require('./db');
const bcrypt = require('bcryptjs');

function seedData() {
  const existingAdmin = get("SELECT id FROM users WHERE email = 'admin@zacsonfitness.com'");
  if (existingAdmin) return console.log('Database already seeded.');

  const adminHash = bcrypt.hashSync('admin123', 10);
  const memberHash = bcrypt.hashSync('member123', 10);
  const trainerHash = bcrypt.hashSync('trainer123', 10);

  // ========== ROLES ==========
  const roles = [
    ['super_admin', 'Super Admin', 'Full system access', 1],
    ['admin', 'Admin', 'Administrative access', 1],
    ['branch_manager', 'Branch Manager', 'Branch-level management', 0],
    ['receptionist', 'Receptionist', 'Front desk operations', 0],
    ['sales_manager', 'Sales Manager', 'Sales team management', 0],
    ['sales_executive', 'Sales Executive', 'Lead management & sales', 0],
    ['trainer', 'Trainer', 'Training & fitness management', 0],
    ['nutritionist', 'Nutritionist', 'Diet & nutrition management', 0],
    ['accountant', 'Accountant', 'Financial management', 0],
    ['hr_manager', 'HR Manager', 'Human resources management', 0],
    ['staff', 'Staff', 'General staff access', 0],
    ['member', 'Member', 'Customer portal access', 1]
  ];
  roles.forEach(r => {
    run("INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?)", r);
  });

  // ========== PERMISSIONS ==========
  const modules = ['dashboard','members','memberships','plans','attendance','classes','pt','workouts','diet','leads','crm','sales','invoices','payments','expenses','inventory','pos','employees','leave','payroll','tasks','tickets','marketing','reports','settings','announcements','documents','audit_logs','blog','offers','coupons','referrals','calculators'];
  const actions = ['view','create','edit','delete','approve','export'];
  modules.forEach(mod => {
    actions.forEach(action => {
      run("INSERT INTO permissions (name, module, description) VALUES (?, ?, ?)",
        [`${mod}_${action}`, mod, `${action} ${mod}`]);
    });
  });

  // ========== BRANCHES ==========
  run("INSERT INTO branches (name, slug, address, city, state, pincode, phone, email, opening_hours, facilities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['Zacson Fitness - Andheri West', 'andheri-west', '14th Floor, Sagar Tech Plaza, Andheri Kurla Road, Andheri West', 'Mumbai', 'Maharashtra', '400053', '+91 98765 43210', 'hello@zacsonfitness.com', JSON.stringify({'mon-sat': '5:30 AM - 10:00 PM', 'sunday': '7:00 AM - 8:00 PM'}), JSON.stringify(['Strength Zone', 'Cardio Deck', 'Free Weights', 'Functional Training', 'Group Studio', 'Recovery Lounge', 'Locker Rooms', 'Juice Bar', 'Parking'])]);
  run("INSERT INTO branches (name, slug, address, city, state, pincode, phone, email, opening_hours, facilities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['Zacson Fitness - Powai', 'powai', 'Ground Floor, Hiranandani Gardens, Powai', 'Mumbai', 'Maharashtra', '400076', '+91 98765 43211', 'powai@zacsonfitness.com', JSON.stringify({'mon-sat': '6:00 AM - 10:00 PM', 'sunday': '7:00 AM - 9:00 PM'}), JSON.stringify(['Strength Zone', 'Cardio Deck', 'Free Weights', 'Group Studio', 'Yoga Studio', 'Locker Rooms'])]);

  // ========== ADMIN USER ==========
  run("INSERT INTO users (username, email, password_hash, role, full_name, phone, gender, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['admin', 'admin@zacsonfitness.com', adminHash, 'admin', 'Rajesh Sharma', '+91 98765 43210', 'male', 1]);

  // ========== MEMBERSHIP PLANS ==========
  const plans = [
    ['Starter', 'starter', 'Perfect for beginners who want to explore our facilities.', 1499, 1999, 1, JSON.stringify(['Access to gym floor', 'Locker room access', 'Free WiFi', 'Basic equipment usage']), 1, 1, 0, 0, 0, 0, 0, 3, 'all', '', 0, 1, 1],
    ['Pro', 'pro', 'Our most popular plan for consistent trainers.', 4999, 4999, 3, JSON.stringify(['Everything in Starter', 'Group classes access', 'Steam room access', 'Monthly body analysis', 'Nutrition guide', '2 guest passes/month']), 1, 1, 1, 1, 1, 2, 0, 7, 'all', '', 0, 1, 2],
    ['Elite', 'elite', 'The complete fitness experience for serious athletes.', 11994, 11994, 6, JSON.stringify(['Everything in Pro', 'Personal trainer (4 sessions/month)', 'Recovery zone access', 'Priority class booking', 'Diet consultation', '5 guest passes/month']), 1, 1, 4, 1, 1, 5, 1, 14, 'all', '', 1, 1, 3],
    ['Ultimate', 'ultimate', 'Maximum value. Unbeatable commitment.', 23988, 23988, 12, JSON.stringify(['Everything in Elite', 'Unlimited personal training', 'VIP locker', 'Monthly INBODY scan', 'Quarterly fitness assessment', 'Unlimited guest passes', 'Merchandise kit']), 1, 1, 99, 1, 1, 99, 1, 30, 'all', '', 0, 1, 4],
    ['Student', 'student', 'Special pricing for students with valid ID.', 999, 1499, 1, JSON.stringify(['Full gym access', 'Group classes', 'Locker room', 'Student ID required']), 1, 1, 0, 0, 0, 0, 0, 3, 'all', '', 0, 1, 5],
    ['Couple', 'couple', 'Train together, stay together.', 3999, 3999, 1, JSON.stringify(['Full access for 2 members', 'Couple workout sessions', 'Shared locker', 'Group classes']), 1, 1, 0, 0, 1, 0, 0, 7, 'all', '', 0, 1, 6],
    ['Personal Training', 'personal-training', 'One-on-one coaching for maximum results.', 7999, 7999, 1, JSON.stringify(['Dedicated personal trainer', 'Custom workout plan', 'Diet planning', 'Weekly progress tracking', 'All gym facilities']), 1, 1, 12, 1, 1, 0, 1, 0, 'all', '', 0, 1, 7],
    ['Corporate', 'corporate', 'Group memberships for companies.', 2999, 2999, 1, JSON.stringify(['Full gym access', 'Group classes', 'Corporate events', 'Flexible hours', 'Dedicated account manager']), 1, 1, 0, 0, 0, 0, 0, 7, 'all', '', 0, 1, 8],
    ['Annual Premium', 'annual-premium', 'Best value annual membership.', 19999, 29988, 12, JSON.stringify(['Full facility access', 'All classes', '8 PT sessions/month', 'Sauna & spa', 'VIP locker', 'Guest passes', 'Nutrition plan']), 1, 1, 8, 1, 1, 4, 1, 30, 'all', '', 0, 1, 9]
  ];
  plans.forEach(p => {
    run("INSERT INTO membership_plans (name, slug, description, price, original_price, duration_months, features, gym_access, class_access, pt_sessions, sauna_access, locker_included, guest_passes, nutrition_consultation, freeze_days, branch_access, terms_conditions, is_popular, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", p);
  });

  // ========== PT PACKAGES ==========
  const ptPackages = [
    ['Basic', 4, 3999, 30, '4 personal training sessions'],
    ['Standard', 8, 6999, 45, '8 personal training sessions'],
    ['Premium', 12, 9999, 60, '12 personal training sessions'],
    ['Elite', 24, 17999, 90, '24 personal training sessions with diet plan'],
    ['Intensive', 36, 24999, 120, '36 sessions - complete transformation package']
  ];
  ptPackages.forEach(p => {
    run("INSERT INTO pt_packages (name, sessions, price, duration_days, description) VALUES (?, ?, ?, ?, ?)", p);
  });

  // ========== EXERCISE LIBRARY ==========
  const exercises = [
    ['Barbell Bench Press', 'strength', 'chest', 'barbell', 'intermediate', 'Compound chest exercise', '', '', 'Lie on bench, grip bar slightly wider than shoulder width, lower to chest, press up.'],
    ['Incline Dumbbell Press', 'strength', 'chest', 'dumbbells', 'intermediate', 'Upper chest exercise', '', '', 'Set bench to 30-45 degrees, press dumbbells from shoulder level upward.'],
    ['Deadlift', 'strength', 'back', 'barbell', 'advanced', 'Full body compound lift', '', '', 'Stand with feet hip-width, grip bar, keep back straight, lift by extending hips and knees.'],
    ['Barbell Squat', 'strength', 'legs', 'barbell', 'intermediate', 'Compound leg exercise', '', '', 'Bar on upper back, feet shoulder width, squat down until thighs parallel, drive up.'],
    ['Pull-ups', 'strength', 'back', 'bodyweight', 'intermediate', 'Upper body pull exercise', '', '', 'Hang from bar, pull body up until chin over bar, lower with control.'],
    ['Overhead Press', 'strength', 'shoulders', 'barbell', 'intermediate', 'Shoulder compound exercise', '', '', 'Press barbell from shoulder level to overhead, keep core tight throughout.'],
    ['Bicep Curls', 'strength', 'biceps', 'dumbbells', 'beginner', 'Isolation arm exercise', '', '', 'Hold dumbbells at sides, curl up by bending elbows, lower with control.'],
    ['Tricep Dips', 'strength', 'triceps', 'bodyweight', 'intermediate', 'Tricep compound exercise', '', '', 'Support on parallel bars, lower body by bending arms, push back up.'],
    ['Romanian Deadlift', 'strength', 'hamstrings', 'barbell', 'intermediate', 'Hip hinge exercise', '', '', 'Hold barbell, hinge at hips keeping legs slightly bent, feel hamstring stretch.'],
    ['Lateral Raises', 'strength', 'shoulders', 'dumbbells', 'beginner', 'Shoulder isolation exercise', '', '', 'Hold dumbbells at sides, raise arms out to shoulder height, lower slowly.'],
    ['Plank', 'core', 'core', 'bodyweight', 'beginner', 'Core stability exercise', '', '', 'Hold push-up position on forearms, keep body straight, hold for time.'],
    ['Russian Twists', 'core', 'core', 'bodyweight', 'beginner', 'Core rotation exercise', '', '', 'Sit with knees bent, lean back slightly, rotate torso side to side.'],
    ['Treadmill Running', 'cardio', 'legs', 'treadmill', 'beginner', 'Cardiovascular exercise', '', '', 'Start with warm-up walk, increase to jogging or running pace, cool down.'],
    ['Rowing Machine', 'cardio', 'full_body', 'rower', 'intermediate', 'Full body cardio', '', '', 'Grip handle, push with legs, pull handle to torso, return with control.'],
    ['Kettlebell Swing', 'functional', 'full_body', 'kettlebell', 'intermediate', 'Power exercise', '', '', 'Hinge at hips, swing kettlebell between legs, drive hips forward to swing up.'],
    ['Battle Ropes', 'functional', 'arms', 'ropes', 'intermediate', 'Cardio and strength', '', '', 'Grip rope ends, create alternating waves with powerful arm movements.'],
    ['Burpees', 'hiit', 'full_body', 'bodyweight', 'intermediate', 'Full body HIIT exercise', '', '', 'Squat down, jump feet back to plank, do push-up, jump feet forward, jump up.'],
    ['Mountain Climbers', 'hiit', 'core', 'bodyweight', 'beginner', 'Core and cardio exercise', '', '', 'Start in plank, alternate driving knees toward chest rapidly.'],
    ['Yoga Sun Salutation', 'flexibility', 'full_body', 'mat', 'beginner', 'Flexibility and breathing sequence', '', '', 'Flow through mountain, forward fold, plank, cobra, downward dog poses.'],
    ['Foam Rolling', 'recovery', 'full_body', 'foam_roller', 'beginner', 'Myofascial release', '', '', 'Roll target muscle groups slowly, pause on tender spots for 20-30 seconds.']
  ];
  exercises.forEach(e => {
    run("INSERT INTO exercise_library (name, category, muscle_group, equipment, difficulty, description, video_url, image, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", e);
  });

  // ========== EMPLOYEES (10 trainers + 5 staff) ==========
  const employees = [
    ['E001', 'Arjun Kapoor', 'arjun@zacsonfitness.com', '+91 98765 43201', 'Training', 'Head Trainer', 1, null, '2020-01-15', 55000, 'monthly', 'HDFC0001234', 'HDFC0001234', 'ABCPK1234A', '1234-5678-9012'],
    ['E002', 'Priya Menon', 'priya@zacsonfitness.com', '+91 98765 43202', 'Training', 'Yoga Director', 1, null, '2020-03-10', 48000, 'monthly', 'HDFC0005678', 'HDFC0005678', 'ABCPM5678B', '2345-6789-0123'],
    ['E003', 'Vikram Singh', 'vikram@zacsonfitness.com', '+91 98765 43203', 'Training', 'Strength Coach', 1, 1, '2021-01-20', 45000, 'monthly', 'ICICI0001234', 'ICICI0001234', 'ABCPS9012C', '3456-7890-1234'],
    ['E004', 'Meera Reddy', 'meera@zacsonfitness.com', '+91 98765 43204', 'Training', 'Cardio Specialist', 1, null, '2021-06-01', 42000, 'monthly', 'SBI0001234', 'SBI0001234', 'ABCPR3456D', '4567-8901-2345'],
    ['E005', 'Karthik Iyer', 'karthik@zacsonfitness.com', '+91 98765 43205', 'Training', 'Nutrition Coach', 1, null, '2020-09-15', 50000, 'monthly', 'HDFC0009012', 'HDFC0009012', 'ABCPK7890E', '5678-9012-3456'],
    ['E006', 'Nisha Gupta', 'nisha@zacsonfitness.com', '+91 98765 43206', 'Training', 'Boxing Coach', 1, 1, '2022-01-10', 40000, 'monthly', 'ICICI0005678', 'ICICI0005678', 'ABCPR2345F', '6789-0123-4567'],
    ['E007', 'Sanjay Patil', 'sanjay@zacsonfitness.com', '+91 98765 43207', 'Training', 'CrossFit Coach', 1, null, '2022-04-01', 42000, 'monthly', 'SBI0005678', 'SBI0005678', 'ABCPR6789G', '7890-1234-5678'],
    ['E008', 'Ananya Deshmukh', 'ananya@zacsonfitness.com', '+91 98765 43208', 'Training', 'Pilates Instructor', 2, null, '2022-07-15', 38000, 'monthly', 'HDFC0001234', 'HDFC0001234', 'ABCPR0123H', '8901-2345-6789'],
    ['E009', 'Ravi Kumar', 'ravi@zacsonfitness.com', '+91 98765 43209', 'Training', 'Functional Trainer', 1, 3, '2023-01-05', 40000, 'monthly', 'ICICI0001234', 'ICICI0001234', 'ABCPR4567I', '9012-3456-7890'],
    ['E010', 'Deepa Nair', 'deepa@zacsonfitness.com', '+91 98765 43210', 'Training', 'Zumba Instructor', 2, null, '2023-03-20', 36000, 'monthly', 'SBI0001234', 'SBI0001234', 'ABCPR8901J', '0123-4567-8901'],
    ['S001', 'Priyanka Joshi', 'priyanka.j@zacsonfitness.com', '+91 98765 43301', 'Sales', 'Sales Manager', 1, null, '2021-01-15', 35000, 'monthly', 'HDFC0001111', 'HDFC0001111', 'ABCPS1111K', '1111-2222-3333'],
    ['S002', 'Amit Desai', 'amit@zacsonfitness.com', '+91 98765 43302', 'Sales', 'Sales Executive', 1, null, '2022-06-01', 25000, 'monthly', 'ICICI0001111', 'ICICI0001111', 'ABCPS2222L', '2222-3333-4444'],
    ['S003', 'Neha Sharma', 'neha@zacsonfitness.com', '+91 98765 43303', 'Sales', 'Sales Executive', 1, null, '2023-01-10', 25000, 'monthly', 'SBI0001111', 'SBI0001111', 'ABCPS3333M', '3333-4444-5555'],
    ['R001', 'Suresh More', 'suresh@zacsonfitness.com', '+91 98765 43401', 'Reception', 'Receptionist', 1, null, '2021-04-15', 22000, 'monthly', 'HDFC0002222', 'HDFC0002222', 'ABCPM4444N', '4444-5555-6666'],
    ['R002', 'Kavita Pisal', 'kavita@zacsonfitness.com', '+91 98765 43402', 'Reception', 'Receptionist', 2, null, '2022-08-01', 20000, 'monthly', 'ICICI0002222', 'ICICI0002222', 'ABCPM5555O', '5555-6666-7777'],
    ['A001', 'Manoj Kulkarni', 'manoj@zacsonfitness.com', '+91 98765 43501', 'Accounts', 'Accountant', 1, null, '2020-06-01', 40000, 'monthly', 'HDFC0003333', 'HDFC0003333', 'ABCPK6666P', '6666-7777-8888'],
    ['HR01', 'Pooja Bhatt', 'pooja@zacsonfitness.com', '+91 98765 43601', 'HR', 'HR Manager', 1, null, '2021-02-15', 42000, 'monthly', 'SBI0003333', 'SBI0003333', 'ABCPB7777Q', '7777-8888-9999'],
    ['M001', 'Vikrant Rao', 'vikrant@zacsonfitness.com', '+91 98765 43701', 'Marketing', 'Marketing Manager', 1, null, '2021-09-01', 38000, 'monthly', 'HDFC0004444', 'HDFC0004444', 'ABCPV8888R', '8888-9999-0000']
  ];
  employees.forEach(e => {
    run("INSERT INTO employees (employee_id, full_name, email, phone, department, designation, branch_id, manager_id, joining_date, salary, salary_type, bank_account, ifsc_code, pan_number, aadhar_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", e);
  });

  // ========== TRAINER PROFILES (linked to employees) ==========
  const trainers = [
    [1, 'Arjun Kapoor', 'arjun-kapoor', '/assets/img/trainers/trainer1.jpg', 'Head Trainer & Founder', 12, JSON.stringify(['ACE Certified', 'K11 Academy', 'CrossFit L2']), JSON.stringify(['Body Building', 'Strength Training', 'Transformation']), 'Arjun founded Zacson Fitness with a vision to make premium fitness accessible.', JSON.stringify({instagram:'#',twitter:'#',facebook:'#'}), 4.9, 85, 1, 1],
    [2, 'Priya Menon', 'priya-menon', '/assets/img/trainers/trainer2.jpg', 'Yoga & Wellness Director', 9, JSON.stringify(['RYT 500', 'ACE Group Fitness', 'Sports Nutrition']), JSON.stringify(['Yoga', 'Pilates', 'Meditation', 'Flexibility']), 'Priya brings a holistic approach to fitness, blending traditional yoga with modern science.', JSON.stringify({instagram:'#',twitter:'#'}), 4.8, 60, 1, 2],
    [3, 'Vikram Singh', 'vikram-singh', '/assets/img/trainers/trainer3.jpg', 'Strength & Conditioning Coach', 8, JSON.stringify(['NSCA-CSCS', 'CrossFit L3', 'Olympic Lifting']), JSON.stringify(['Powerlifting', 'Olympic Lifting', 'CrossFit']), 'Vikram is a competitive powerlifter turned coach.', JSON.stringify({instagram:'#',facebook:'#'}), 4.7, 55, 1, 3],
    [4, 'Meera Reddy', 'meera-reddy', '/assets/img/trainers/trainer4.jpg', 'Cardio & HIIT Specialist', 7, JSON.stringify(['ACE Certified', 'Zumba Instructor', 'TRX Certified']), JSON.stringify(['HIIT', 'Zumba', 'Cardio', 'Functional Training']), 'Meera high-energy classes are the most popular at Zacson.', JSON.stringify({instagram:'#',twitter:'#'}), 4.9, 70, 1, 4],
    [5, 'Karthik Iyer', 'karthik-iyer', '/assets/img/trainers/trainer5.jpg', 'Nutrition & Transformation Coach', 10, JSON.stringify(['ISSN Certified', 'Precision Nutrition L2', 'ACE']), JSON.stringify(['Weight Loss', 'Nutrition', 'Body Recomposition']), 'Karthik has transformed over 300 bodies through integrated training and nutrition.', JSON.stringify({instagram:'#',twitter:'#',facebook:'#'}), 4.8, 50, 1, 5],
    [6, 'Nisha Gupta', 'nisha-gupta', '/assets/img/trainers/trainer6.jpg', 'Boxing & MMA Coach', 6, JSON.stringify(['ISSA Certified', 'Boxing Coach Level 2', 'Krav Maga']), JSON.stringify(['Boxing', 'Kickboxing', 'Self-Defense', 'MMA Conditioning']), 'Nisha is a former national-level boxer.', JSON.stringify({instagram:'#'}), 4.6, 40, 1, 6]
  ];
  trainers.forEach(t => {
    run("INSERT INTO trainers (employee_id, name, slug, photo, designation, experience_years, certifications, specializations, bio, social_links, rating, total_members, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", t);
  });

  // ========== CLASSES ==========
  const classes = [
    ['Power Yoga', 'power-yoga', 'Dynamic yoga flow combining strength and flexibility.', 2, 1, 60, 'all-levels', 'Yoga', 25, 'Studio A', '/assets/img/classes/yoga.jpg', 1],
    ['HIIT Burn', 'hiit-burn', 'High-intensity interval training for maximum calorie burn.', 4, 1, 45, 'advanced', 'HIIT', 20, 'HIIT Zone', '/assets/img/classes/hiit.jpg', 1],
    ['Zumba Dance', 'zumba-dance', 'Latin-inspired dance fitness party.', 10, 1, 50, 'beginner', 'Dance', 30, 'Studio B', '/assets/img/classes/zumba.jpg', 1],
    ['Functional Training', 'functional-training', 'Train movements, not muscles.', 9, 1, 55, 'intermediate', 'Functional', 18, 'Functional Zone', '/assets/img/classes/functional.jpg', 1],
    ['Boxing Fitness', 'boxing-fitness', 'Learn boxing while getting an incredible cardio workout.', 6, 1, 60, 'intermediate', 'Boxing', 16, 'Boxing Ring', '/assets/img/classes/boxing.jpg', 1],
    ['Strength Foundation', 'strength-foundation', 'Master the fundamental barbell lifts.', 3, 1, 75, 'intermediate', 'Strength', 15, 'Free Weight Zone', '/assets/img/classes/strength.jpg', 1],
    ['CrossFit WOD', 'crossfit-wod', 'Constantly varied functional movements at high intensity.', 7, 1, 60, 'advanced', 'CrossFit', 15, 'CrossFit Zone', '/assets/img/classes/crossfit.jpg', 1],
    ['Beginner Bootcamp', 'beginner-bootcamp', 'The perfect starting point for fitness newcomers.', 9, 1, 45, 'beginner', 'General', 25, 'Studio A', '/assets/img/classes/bootcamp.jpg', 1],
    ['Pilates Core', 'pilates-core', 'Mat-based Pilates focused on core strength.', 8, 2, 50, 'all-levels', 'Pilates', 20, 'Studio B', '/assets/img/classes/pilates.jpg', 1],
    ['MMA Conditioning', 'mma-conditioning', 'Mixed martial arts inspired conditioning workout.', 6, 1, 60, 'advanced', 'Boxing', 14, 'Boxing Ring', '/assets/img/classes/mma.jpg', 1],
    ['Spin Class', 'spin-class', 'High-energy indoor cycling session.', 4, 2, 45, 'intermediate', 'Cardio', 20, 'Spin Studio', '/assets/img/classes/hiit.jpg', 1],
    ['Stretch & Recovery', 'stretch-recovery', 'Guided stretching and foam rolling for recovery.', 2, 1, 30, 'beginner', 'Recovery', 20, 'Recovery Zone', '/assets/img/classes/yoga.jpg', 1]
  ];
  classes.forEach(c => {
    run("INSERT INTO classes (name, slug, description, trainer_id, branch_id, duration_minutes, difficulty, category, max_participants, room, image, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", c);
  });

  // ========== CLASS SCHEDULES ==========
  const schedules = [
    [1,'Monday','06:00','07:00','Studio A'],[1,'Wednesday','06:00','07:00','Studio A'],[1,'Friday','06:00','07:00','Studio A'],[1,'Sunday','08:00','09:00','Studio A'],
    [2,'Monday','07:00','07:45','HIIT Zone'],[2,'Tuesday','17:30','18:15','HIIT Zone'],[2,'Thursday','07:00','07:45','HIIT Zone'],[2,'Saturday','09:00','09:45','HIIT Zone'],
    [3,'Tuesday','18:00','18:50','Studio B'],[3,'Thursday','18:00','18:50','Studio B'],[3,'Saturday','10:00','10:50','Studio B'],
    [4,'Monday','17:00','17:55','Functional Zone'],[4,'Wednesday','17:00','17:55','Functional Zone'],[4,'Friday','17:00','17:55','Functional Zone'],
    [5,'Tuesday','07:00','08:00','Boxing Ring'],[5,'Thursday','07:00','08:00','Boxing Ring'],[5,'Saturday','07:00','08:00','Boxing Ring'],
    [6,'Monday','18:30','19:45','Free Weight Zone'],[6,'Wednesday','18:30','19:45','Free Weight Zone'],[6,'Friday','18:30','19:45','Free Weight Zone'],
    [7,'Monday','06:30','07:30','CrossFit Zone'],[7,'Wednesday','06:30','07:30','CrossFit Zone'],[7,'Friday','06:30','07:30','CrossFit Zone'],[7,'Saturday','08:00','09:00','CrossFit Zone'],
    [8,'Monday','09:00','09:45','Studio A'],[8,'Tuesday','09:00','09:45','Studio A'],[8,'Wednesday','09:00','09:45','Studio A'],[8,'Thursday','09:00','09:45','Studio A'],[8,'Friday','09:00','09:45','Studio A'],
    [9,'Tuesday','19:00','19:50','Studio B'],[9,'Thursday','19:00','19:50','Studio B'],[9,'Sunday','10:00','10:50','Studio B'],
    [10,'Wednesday','07:00','08:00','Boxing Ring'],[10,'Friday','07:00','08:00','Boxing Ring'],[10,'Sunday','09:00','10:00','Boxing Ring'],
    [11,'Monday','17:00','17:45','Spin Studio'],[11,'Wednesday','17:00','17:45','Spin Studio'],[11,'Friday','17:00','17:45','Spin Studio'],
    [12,'Tuesday','19:30','20:00','Recovery Zone'],[12,'Thursday','19:30','20:00','Recovery Zone'],[12,'Saturday','11:00','11:30','Recovery Zone']
  ];
  schedules.forEach(s => {
    run("INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, location) VALUES (?, ?, ?, ?, ?)", s);
  });

  // ========== MEMBER USERS (100+ members) ==========
  const firstNames = ['Rahul','Sneha','Amit','Deepa','Vikrant','Priyanka','Mohit','Kavita','Sanjay','Neha','Rohan','Pooja','Aditya','Meena','Karan','Divya','Nikhil','Shreya','Varun','Tanvi','Gaurav','Ritu','Abhishek','Sonia','Sachin','Aarti','Raj','Simran','Vivek','Nisha','Manish','Pallavi','Suraj','Komal','Tushar','Deepika','Nitin','Madhavi','Prakash','Sarita','Ravi','Jyoti','Aakash','Renu','Dev','Megha','Ashish','Trisha','Vinod','Swati','Mohan','Geeta','Anil','Usha','Sunil','Rekha','Dinesh','Lata','Ramesh','Sunita','Jatin','Mona','Pankaj','Smita','Hitesh','Ashwini','Chetan','Bharti','Yogesh','Preeti','Kapil','Anjali'];
  const lastNames = ['Sharma','Patel','Verma','Nair','Rao','Joshi','Singh','Gupta','Reddy','Iyer','Desai','Kulkarni','Mishra','Bhat','Kumar','Choudhary','Thakur','Kapoor','Mehta','Shah','Bose','Banerjee','Dutta','Mukherjee','Chakraborty','Pillai','Nambiar','Menon','Pai','Shetty'];
  const goals = ['Weight Loss','Muscle Gain','General Fitness','Body Transformation','Endurance','Flexibility','Strength','Rehabilitation','Sports Performance','Stress Relief'];
  const fitnessLevels = ['beginner','intermediate','advanced'];
  const genders = ['male','female'];

  for (let i = 0; i < 100; i++) {
    const fname = firstNames[i % firstNames.length];
    const lname = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    const fullName = `${fname} ${lname}`;
    const email = `${fname.toLowerCase()}.${lname.toLowerCase()}${i}@email.com`;
    const phone = `+91 ${90000 + i} ${String(10000 + i * 37).slice(0,5)} ${String(10000 + i * 53).slice(0,4)}`;
    const gender = genders[i % 2];
    const dob = `${1985 + (i % 20)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
    const height = 150 + (i % 30);
    const weight = 50 + (i % 40);
    const bmi = (weight / ((height/100) ** 2)).toFixed(1);
    const fitnessLevel = fitnessLevels[i % 3];
    const goal = goals[i % goals.length];
    const planId = (i % 5) + 1;
    const branchId = (i % 2) + 1;

    run("INSERT INTO users (username, email, password_hash, role, full_name, phone, gender, date_of_birth, height, weight, fitness_level, fitness_goals, address, city, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [fname.toLowerCase() + i, email, memberHash, 'member', fullName, phone, gender, dob, height, weight, fitnessLevel, goal, `${100 + i} Fitness Lane`, 'Mumbai', 1]);

    const userId = get("SELECT last_insert_rowid() as id").id || i + 30;

    // Create membership for each member
    const startDate = new Date(2025, 0, 1 + (i % 365));
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (planId <= 2 ? 1 : planId <= 4 ? 6 : 12));
    const status = endDate > new Date() ? 'active' : 'expired';

    run("INSERT INTO memberships (membership_id, user_id, plan_id, branch_id, status, start_date, end_date, assigned_salesperson, assigned_trainer, discount, tax, final_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [`MEM-${String(1000 + i).padStart(6, '0')}`, userId, planId, branchId, status, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], 11 + (i % 3), 1 + (i % 6), i % 3 === 0 ? 500 : 0, 0, plans[planId - 1][3] - (i % 3 === 0 ? 500 : 0), ['cash', 'upi', 'card'][i % 3]]);

    // Create attendance records for active members
    if (status === 'active') {
      for (let d = 0; d < 15 + (i % 20); d++) {
        const attDate = new Date();
        attDate.setDate(attDate.getDate() - d);
        if (attDate.getDay() === 0 && i % 3 !== 0) continue;
        const checkInHour = 5 + (i % 15);
        const checkOutHour = checkInHour + 1 + (i % 2);
        run("INSERT INTO attendance (user_id, branch_id, check_in, check_out, duration_minutes, entry_method, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [userId, branchId, `${String(checkInHour).padStart(2,'0')}:${String(i%60).padStart(2,'0')}`, `${String(Math.min(checkOutHour, 22)).padStart(2,'0')}:${String((i*7)%60).padStart(2,'0')}`, 60 + (i % 90), ['manual','qr','member_id'][i%3], attDate.toISOString().split('T')[0]]);
      }
    }
  }

  // ========== LEADS (30 leads) ==========
  const leadSources = ['website', 'instagram', 'facebook', 'whatsapp', 'google', 'walk_in', 'referral', 'phone', 'campaign'];
  const leadStatuses = ['NEW_LEAD', 'CONTACTED', 'INTERESTED', 'TRIAL_BOOKED', 'TRIAL_ATTENDED', 'NEGOTIATION', 'PAYMENT_PENDING', 'CONVERTED', 'LOST'];
  const leadNames = ['Arjun Mehta','Sneha Kulkarni','Rohit Bhatt','Pooja Deshmukh','Vikram Patil','Ananya Sharma','Karan Joshi','Divya Nair','Nikhil Rao','Shreya Iyer','Varun Singh','Tanvi Gupta','Gaurav Reddy','Ritu Bose','Abhishek Menon','Sonia Shah','Raj Pillai','Simran Kaur','Vivek Mishra','Nisha Choudhary','Manish Thakur','Pallavi Kapoor','Suraj Mehta','Komal Desai','Tushar Shetty','Deepika Pai','Nitin Kumar','Madhavi Verma','Prakash Sharma','Sarita Joshi'];

  leadNames.forEach((name, i) => {
    const source = leadSources[i % leadSources.length];
    const status = leadStatuses[i % leadStatuses.length];
    const phone = `+91 ${80000 + i} ${String(20000 + i * 41).slice(0,5)} ${String(10000 + i * 67).slice(0,4)}`;
    const email = `lead${i + 1}@email.com`;
    const goal = goals[i % goals.length];
    const planId = (i % 4) + 1;
    const salespersonId = 11 + (i % 3);
    const score = Math.floor(Math.random() * 100);
    const followupDate = new Date();
    followupDate.setDate(followupDate.getDate() + (i % 7) - 3);

    run("INSERT INTO leads (lead_id, source, name, phone, email, gender, fitness_goal, interested_plan, preferred_branch, assigned_salesperson, lead_score, status, next_followup_date, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [`LD-${String(1000 + i).padStart(6, '0')}`, source, name, phone, email, genders[i%2], goal, `Plan ${planId}`, (i%2)+1, salespersonId, score, status, followupDate.toISOString().split('T')[0], `Interested in ${goal}. Source: ${source}`, JSON.stringify([source, goal])]);

    // Add follow-up activities
    run("INSERT INTO lead_activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, ?, ?, ?)",
      [i + 1, salespersonId, 'call', `Initial contact via ${source}`, new Date(Date.now() - (10 - i) * 86400000).toISOString()]);
  });

  // ========== CLASS BOOKINGS ==========
  for (let i = 0; i < 50; i++) {
    const userId = 31 + (i % 100);
    const classId = (i % 12) + 1;
    const today = new Date();
    const daysAhead = i % 7;
    const bookDate = new Date(today);
    bookDate.setDate(bookDate.getDate() + daysAhead);
    run("INSERT INTO class_bookings (class_id, user_id, booking_date, status) VALUES (?, ?, ?, ?)",
      [classId, userId, bookDate.toISOString().split('T')[0], i % 10 === 0 ? 'cancelled' : 'booked']);
  }

  // ========== PT ASSIGNMENTS ==========
  for (let i = 0; i < 20; i++) {
    const userId = 31 + (i * 5);
    const trainerId = (i % 6) + 1;
    const pkgSessions = [4, 8, 12, 24][i % 4];
    const completed = Math.floor(Math.random() * pkgSessions);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 60);

    run("INSERT INTO pt_assignments (user_id, trainer_id, package_id, sessions_total, sessions_completed, sessions_remaining, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, trainerId, (i % 4) + 1, pkgSessions, completed, pkgSessions - completed, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], completed >= pkgSessions ? 'completed' : 'active']);

    // Create PT sessions
    for (let s = 0; s < Math.min(completed + 2, pkgSessions); s++) {
      const sessDate = new Date(startDate);
      sessDate.setDate(sessDate.getDate() + s * 3);
      const sessStatus = s < completed ? 'completed' : s === completed ? 'scheduled' : 'upcoming';
      run("INSERT INTO pt_sessions (assignment_id, user_id, trainer_id, scheduled_date, scheduled_time, duration_minutes, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [i + 1, userId, trainerId, sessDate.toISOString().split('T')[0], `${8 + (s % 12)}:00`, 60, sessStatus, s < completed ? 'Good session' : '']);
    }
  }

  // ========== WORKOUT PLANS ==========
  for (let i = 0; i < 15; i++) {
    const userId = 31 + (i * 7);
    const trainerId = (i % 6) + 1;
    const planName = ['Beginner Full Body', 'Intermediate Push/Pull/Legs', 'Advanced PPL', 'Strength Focus', 'Hypertrophy Program'][i % 5];

    run("INSERT INTO workout_plans (user_id, trainer_id, name, description, duration_weeks, difficulty, goal) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, trainerId, planName, `Custom ${planName.toLowerCase()} for member`, [4, 6, 8, 12][i % 4], fitnessLevels[i % 3], goals[i % goals.length]]);

    const planId = get("SELECT last_insert_rowid() as id").id || i + 1;
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const focuses = ['Chest + Triceps', 'Back + Biceps', 'Legs', 'Shoulders + Abs', 'Full Body', 'Rest / Active Recovery'];

    dayNames.forEach((day, di) => {
      run("INSERT INTO workout_days (plan_id, day_number, day_name, focus) VALUES (?, ?, ?, ?)",
        [planId, di + 1, day, focuses[di]]);

      if (di < 5) {
        const dayId = get("SELECT last_insert_rowid() as id").id || (i * 6) + di + 1;
        const exList = i % 2 === 0 ?
          [['Bench Press', 4, '8-10', '60kg'], ['Incline Press', 3, '10-12', '40kg'], ['Dips', 3, '12-15', 'BW']] :
          [['Squat', 4, '6-8', '80kg'], ['Leg Press', 3, '10-12', '120kg'], ['Leg Curl', 3, '12-15', '30kg']];

        exList.forEach((ex, ei) => {
          run("INSERT INTO workout_exercises (day_id, exercise_name, sets, reps, weight, rest_seconds, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [dayId, ex[0], ex[1], ex[2], ex[3], 60, ei + 1]);
        });
      }
    });
  }

  // ========== DIET PLANS ==========
  for (let i = 0; i < 10; i++) {
    const userId = 31 + (i * 10);
    const calories = 1800 + (i % 5) * 200;
    const meals = JSON.stringify([
      { time: '7:00 AM', name: 'Breakfast', items: ['Oats with milk', 'Boiled eggs', 'Fruit'] },
      { time: '10:00 AM', name: 'Mid-morning snack', items: ['Protein shake', 'Banana'] },
      { time: '1:00 PM', name: 'Lunch', items: ['Brown rice', 'Grilled chicken', 'Salad', 'Dal'] },
      { time: '4:00 PM', name: 'Evening snack', items: ['Nuts', 'Greek yogurt'] },
      { time: '7:00 PM', name: 'Dinner', items: ['Roti', 'Fish/Paneer', 'Vegetables', 'Soup'] }
    ]);

    run("INSERT INTO diet_plans (user_id, name, description, total_calories, protein_grams, carbs_grams, fats_grams, meals, water_intake_ml, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, `Custom Diet Plan ${i + 1}`, `Personalized nutrition plan`, calories, 120 + (i * 10), 200 + (i * 15), 50 + (i * 5), meals, 3000, new Date().toISOString().split('T')[0]]);
  }

  // ========== BODY MEASUREMENTS ==========
  for (let i = 0; i < 30; i++) {
    const userId = 31 + (i * 3);
    for (let m = 0; m < 4; m++) {
      const measureDate = new Date();
      measureDate.setMonth(measureDate.getMonth() - m);
      const weightVal = 75 - m * 1.5 + (i % 10);
      const heightVal = 170 + (i % 15);
      run("INSERT INTO body_measurements (user_id, weight, height, bmi, body_fat, chest, waist, arms, thighs, shoulders, measured_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [userId, weightVal, heightVal, (weightVal / ((heightVal/100) ** 2)).toFixed(1), 18 + (i % 12) - m, 90 + (i % 10), 75 + (i % 15) - m, 12 + (i % 5), 55 + (i % 8), 42 + (i % 6), measureDate.toISOString().split('T')[0]]);
    }
  }

  // ========== PAYMENTS & INVOICES ==========
  for (let i = 0; i < 50; i++) {
    const userId = 31 + (i % 100);
    const planIdx = i % 7;
    const amount = plans[planIdx][3];
    const method = ['cash', 'upi', 'card', 'net_banking'][i % 4];
    const status = i % 8 === 0 ? 'pending' : i % 12 === 0 ? 'refunded' : 'completed';
    const payDate = new Date();
    payDate.setDate(payDate.getDate() - (i * 3));

    run("INSERT INTO payments (payment_number, user_id, amount, method, status, branch_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [`PAY-${String(10000 + i).padStart(6, '0')}`, userId, amount, method, status, (i%2)+1, `Payment for plan`, payDate.toISOString()]);

    const invoiceNum = `INV-${String(1000 + i).padStart(6, '0')}`;
    run("INSERT INTO invoices (invoice_number, user_id, subtotal, tax_rate, tax_amount, total, amount_paid, balance, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [invoiceNum, userId, amount, 18, Math.round(amount * 0.18), Math.round(amount * 1.18), status === 'completed' ? Math.round(amount * 1.18) : 0, status === 'completed' ? 0 : Math.round(amount * 1.18), status === 'completed' ? 'paid' : 'pending', payDate.toISOString().split('T')[0], payDate.toISOString()]);

    const invoiceId = get("SELECT last_insert_rowid() as id").id || i + 1;
    run("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total, item_type) VALUES (?, ?, ?, ?, ?, ?)",
      [invoiceId, `${plans[planIdx][0]} Membership`, 1, amount, amount, 'membership']);
  }

  // ========== EXPENSES ==========
  const expenseCategories = ['Rent', 'Salaries', 'Electricity', 'Maintenance', 'Equipment', 'Marketing', 'Software', 'Utilities', 'Supplements', 'Miscellaneous'];
  for (let i = 0; i < 30; i++) {
    const cat = expenseCategories[i % expenseCategories.length];
    const amounts = [85000, 350000, 25000, 15000, 45000, 30000, 12000, 8000, 20000, 5000];
    const expDate = new Date();
    expDate.setDate(expDate.getDate() - (i * 5));
    run("INSERT INTO expenses (category, description, amount, date, branch_id, vendor, payment_method, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [cat, `${cat} payment for ${expDate.toLocaleString('default', {month: 'long'})}`, amounts[i % amounts.length], expDate.toISOString().split('T')[0], (i%2)+1, `${cat} Vendor Pvt Ltd`, ['cash', 'bank_transfer', 'upi'][i%3], 'approved', 1]);
  }

  // ========== PRODUCTS / INVENTORY ==========
  const products = [
    ['Whey Protein Isolate', 'SUP001', '8901234567890', 'Supplements', 1800, 2500, 50, 10, 'kg', 'Nutrition World'],
    ['Creatine Monohydrate', 'SUP002', '8901234567891', 'Supplements', 600, 999, 80, 15, 'kg', 'Nutrition World'],
    ['BCAA Powder', 'SUP003', '8901234567892', 'Supplements', 800, 1299, 40, 10, 'kg', 'Nutrition World'],
    ['Pre-Workout', 'SUP004', '8901234567893', 'Supplements', 900, 1499, 35, 10, 'kg', 'Nutrition World'],
    ['Zacson T-Shirt', 'MER001', '8901234567894', 'Merchandise', 300, 699, 100, 20, 'piece', 'Fashion Hub'],
    ['Zacson Shaker', 'MER002', '8901234567895', 'Merchandise', 150, 349, 75, 15, 'piece', 'Fashion Hub'],
    ['Gym Gloves', 'ACC001', '8901234567896', 'Accessories', 250, 599, 45, 10, 'piece', 'Sports World'],
    ['Resistance Bands Set', 'ACC002', '8901234567897', 'Accessories', 200, 499, 60, 10, 'set', 'Sports World'],
    ['Yoga Mat Premium', 'ACC003', '8901234567898', 'Accessories', 400, 899, 30, 10, 'piece', 'Sports World'],
    ['Towel - Gym', 'ACC004', '8901234567899', 'Accessories', 100, 199, 200, 30, 'piece', 'Textile Corp'],
    ['Water Bottle', 'ACC005', '8901234567900', 'Accessories', 80, 179, 150, 25, 'piece', 'Plastic Industries'],
    ['Foam Roller', 'ACC006', '8901234567901', 'Accessories', 350, 799, 25, 10, 'piece', 'Sports World']
  ];
  products.forEach(p => {
    run("INSERT INTO products (name, sku, barcode, category, purchase_price, selling_price, stock, minimum_stock, unit, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", p);
  });

  // ========== TICKETS ==========
  const ticketCategories = ['billing', 'membership', 'trainer', 'equipment', 'facility', 'general'];
  const ticketStatuses = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
  for (let i = 0; i < 15; i++) {
    const userId = 31 + (i * 6);
    const cat = ticketCategories[i % ticketCategories.length];
    const status = ticketStatuses[i % ticketStatuses.length];
    const priority = ['low', 'medium', 'high', 'urgent'][i % 4];

    run("INSERT INTO tickets (ticket_id, user_id, category, priority, subject, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [`TKT-${String(1000 + i).padStart(6, '0')}`, userId, cat, priority, `${cat.charAt(0).toUpperCase() + cat.slice(1)} issue - Member #${userId}`, `Detailed description of the ${cat} issue.`, status, new Date(Date.now() - i * 86400000).toISOString()]);

    // Add ticket messages
    run("INSERT INTO ticket_messages (ticket_id, sender_id, message, created_at) VALUES (?, ?, ?, ?)",
      [i + 1, userId, `I have a ${cat} issue that needs attention.`, new Date(Date.now() - i * 86400000).toISOString()]);
    if (status !== 'open') {
      run("INSERT INTO ticket_messages (ticket_id, sender_id, message, created_at) VALUES (?, ?, ?, ?)",
        [i + 1, 1, 'We are looking into this issue and will update you shortly.', new Date(Date.now() - (i-1) * 86400000).toISOString()]);
    }
  }

  // ========== TASKS ==========
  const taskStatuses = ['todo', 'in_progress', 'blocked', 'completed'];
  const taskPriorities = ['low', 'medium', 'high', 'urgent'];
  const taskTitles = ['Update membership pricing', 'Schedule trainer meeting', 'Review monthly reports', 'Clean equipment inventory', 'Update social media', 'Prepare weekly sales report', 'Organize member event', 'Update class timetable', 'Review expense reports', 'Conduct staff training', 'Update website content', 'Prepare marketing campaign', 'Review customer feedback', 'Update exercise library', 'Plan quarterly assessment'];
  for (let i = 0; i < 15; i++) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (i % 10) - 5);
    run("INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [taskTitles[i], `Task description for: ${taskTitles[i]}`, 1 + (i % 5), 1, taskPriorities[i % 4], dueDate.toISOString().split('T')[0], taskStatuses[i % 4]]);
  }

  // ========== ANNOUNCEMENTS ==========
  const announcements = [
    ['New Year Fitness Challenge', 'Join our 30-day fitness challenge starting January 1st! Win exciting prizes.', 'all', 'high'],
    ['Maintenance Notice', 'Steam room will be under maintenance from Jan 15-17.', 'branch', 'normal'],
    ['New Class Launch', 'We are launching Spin Class from next Monday!', 'all', 'normal'],
    ['Trainer of the Month', 'Congratulations to Arjun Kapoor for being Trainer of the Month!', 'all', 'low'],
    ['Holiday Hours', 'Updated gym timings for the holiday season.', 'all', 'normal']
  ];
  announcements.forEach(a => {
    run("INSERT INTO announcements (title, content, target, priority, is_active, created_by, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)",
      [a[0], a[1], a[2], a[3], new Date().toISOString()]);
  });

  // ========== OFFERS & COUPONS ==========
  const offersData = [
    ['New Year Blast', 'Start the year strong with 20% off all plans!', 20, 0, 'general', '2026-01-01', '2026-01-31', 'NEWYEAR20', 500, 0, 1],
    ['Refer & Earn', 'Refer a friend and both get 1 month free.', 0, 500, 'referral', '2026-01-01', '2026-12-31', 'REFER100', 1000, 0, 1],
    ['Summer Shred', 'Get 15% off on all annual plans.', 15, 0, 'seasonal', '2026-04-01', '2026-05-31', 'SUMMER15', 200, 0, 1],
    ['Student Special', 'Flat 25% off for students.', 0, 250, 'student', '2026-01-01', '2026-12-31', 'STUDENT25', 300, 0, 1]
  ];
  offersData.forEach(o => {
    run("INSERT INTO offers (name, description, discount_percent, discount_amount, offer_type, start_date, end_date, coupon_code, usage_limit, used_count, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", o);
  });

  const couponsData = [
    ['WELCOME10', 'Welcome discount', 10, 0, 100, 0, '2026-01-01', '2026-12-31', '[]', 0, 1],
    ['NEWYEAR20', 'New Year offer', 20, 0, 500, 0, '2026-01-01', '2026-01-31', '[]', 0, 1],
    ['REFER100', 'Referral reward', 0, 500, 1000, 0, '2026-01-01', '2026-12-31', '[]', 0, 1],
    ['FIRST50', 'First month special', 50, 0, 200, 0, '2026-01-01', '2026-12-31', '[]', 0, 1]
  ];
  couponsData.forEach(c => {
    run("INSERT INTO coupons (code, description, discount_percent, discount_amount, max_uses, used_count, valid_from, valid_until, plan_ids, min_purchase, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", c);
  });

  // ========== CAMPAIGNS ==========
  const campaigns = [
    ['Instagram Fitness Challenge', 'instagram', 'active', 25000, 18000, '2026-01-01', '2026-01-31', 'Fitness enthusiasts 18-35', 45, 12, 85000],
    ['Google Ads - New Year', 'google', 'completed', 50000, 48000, '2025-12-15', '2026-01-15', 'Health conscious individuals', 80, 25, 150000],
    ['WhatsApp Referral Program', 'whatsapp', 'active', 10000, 5000, '2026-01-01', '2026-12-31', 'Existing members', 30, 15, 75000],
    ['Facebook Lead Campaign', 'facebook', 'paused', 30000, 22000, '2026-02-01', '2026-03-31', 'Mumbai fitness market', 60, 18, 120000],
    ['Campus Ambassador Program', 'referral', 'active', 15000, 8000, '2026-01-01', '2026-06-30', 'College students', 25, 10, 50000]
  ];
  campaigns.forEach(c => {
    run("INSERT INTO campaigns (name, type, status, budget, spent, start_date, end_date, target_audience, leads_generated, conversions, revenue, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)", c);
  });

  // ========== REFERRALS ==========
  for (let i = 0; i < 10; i++) {
    const userId = 31 + (i * 10);
    const code = `REF${String(1000 + i).padStart(4, '0')}`;
    run("INSERT INTO referrals (referrer_id, referral_code, referred_name, referred_phone, converted, reward_status, reward_amount) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, code, leadNames[i], `+91 98765 ${String(43000 + i)}`, i % 3 === 0 ? 1 : 0, i % 3 === 0 ? 'claimed' : 'pending', i % 3 === 0 ? 500 : 0]);
  }

  // ========== FACILITIES ==========
  const facilitiesData = [
    ['Strength Zone', 'Over 50,000 sq ft of premium strength training equipment.', 'dumbbell', '/assets/img/facilities/strength.jpg', 1, 1],
    ['Cardio Deck', 'State-of-the-art cardio equipment with personal screens.', 'heart', '/assets/img/facilities/cardio.jpg', 1, 2],
    ['Free Weights Arena', 'Olympic platforms, competition-grade barbells, dumbbells up to 60kg.', 'weight', '/assets/img/facilities/freeweights.jpg', 1, 3],
    ['Functional Training Zone', 'TRX rigs, battle ropes, kettlebells, plyo boxes.', 'bolt', '/assets/img/facilities/functional.jpg', 1, 4],
    ['Group Fitness Studio', 'Mirrored studio with premium sound system.', 'music', '/assets/img/facilities/studio.jpg', 1, 5],
    ['Recovery Lounge', 'Foam rollers, massage guns, stretching area.', 'recycle', '/assets/img/facilities/recovery.jpg', 1, 6],
    ['Locker Rooms', 'Spacious lockers, hot showers, toiletries.', 'lock', '/assets/img/facilities/locker.jpg', 1, 7],
    ['Juice Bar & Cafe', 'Fresh smoothies, protein shakes, healthy snacks.', 'coffee', '/assets/img/facilities/juicebar.jpg', 1, 8],
    ['Parking', 'Ample covered parking for cars and two-wheelers.', 'car', '/assets/img/facilities/parking.jpg', 1, 9],
    ['Personal Training Zone', 'Exclusive area for 1-on-1 sessions.', 'user', '/assets/img/facilities/pt.jpg', 1, 10]
  ];
  facilitiesData.forEach(f => {
    run("INSERT INTO facilities (name, description, icon, image, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)", f);
  });

  // ========== GALLERY ==========
  const galleryItems = [
    ['Main Gym Floor','/assets/img/gallery/gallery1.png','gym','Spacious main training floor',1],
    ['Strength Equipment','/assets/img/gallery/gallery2.png','equipment','Premium machines',2],
    ['Cardio Section','/assets/img/gallery/gallery3.png','equipment','Latest cardio equipment',3],
    ['Free Weights','/assets/img/gallery/gallery4.png','gym','Barbells and dumbbells',4],
    ['Group Class','/assets/img/gallery/gallery5.png','classes','High-energy group fitness',5],
    ['Personal Training','/assets/img/gallery/gallery6.png','trainers','One-on-one coaching',6],
    ['Yoga Studio','/assets/img/gallery/gallery1.png','classes','Morning yoga session',7],
    ['HIIT Training','/assets/img/gallery/gallery2.png','classes','Intense HIIT burn',8],
    ['Recovery','/assets/img/gallery/gallery3.png','gym','Recovery zone',9],
    ['Lockers','/assets/img/gallery/gallery4.png','gym','Premium locker facilities',10],
    ['Juice Bar','/assets/img/gallery/gallery5.png','gym','Protein shakes',11],
    ['Member Event','/assets/img/gallery/gallery6.png','events','Annual Fitness Challenge',12]
  ];
  galleryItems.forEach(g => {
    run("INSERT INTO gallery (title, image, category, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)", g);
  });

  // ========== TESTIMONIALS ==========
  const testimonialsData = [
    ['Rahul Verma','/assets/img/testimonial/testi1.jpg',5,'Zacson Fitness changed my life. Lost 15kg in 6 months.','2025-11-15',1],
    ['Sneha Patel','/assets/img/testimonial/testi2.jpg',5,'The Pro plan gives me everything I need.','2025-12-01',1],
    ['Amit Joshi','/assets/img/testimonial/testi3.jpg',5,'Personal training at Zacson is next level.','2026-01-10',1],
    ['Deepa Nair','/assets/img/testimonial/testi4.jpg',4,'Priya yoga classes are the highlight of my week.','2026-02-20',1],
    ['Vikrant Rao','/assets/img/testimonial/testi5.jpg',5,'From 5 pushups to deadlifting 140kg!','2026-03-05',1]
  ];
  testimonialsData.forEach(t => {
    run("INSERT INTO testimonials (name, photo, rating, testimonial, date, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)", t);
  });

  // ========== TRANSFORMATIONS ==========
  const transformations = [
    ['Rahul Verma','/assets/img/transformations/rahul-before.jpg','/assets/img/transformations/rahul-after.jpg','6 months','95 kg','72 kg','Lost 23kg with consistent training and nutrition guidance.','Strength training with HIIT, 5 days/week.'],
    ['Priyanka S.','/assets/img/transformations/priyanka-before.jpg','/assets/img/transformations/priyanka-after.jpg','4 months','68 kg','55 kg','Transformed through yoga and functional training.','Yoga 3x/week, functional training 2x/week.'],
    ['Mohit T.','/assets/img/transformations/mohit-before.jpg','/assets/img/transformations/mohit-after.jpg','8 months','82 kg','70 kg','Gained lean muscle while losing fat with personal training.','Progressive overload with deficit diet.']
  ];
  transformations.forEach(t => {
    run("INSERT INTO transformations (name, before_image, after_image, duration, start_weight, end_weight, story, training_approach, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)", t);
  });

  // ========== BLOG ==========
  const blogCategories = [
    ['Fitness','fitness','Tips and guides for your fitness journey'],
    ['Nutrition','nutrition','Healthy eating and meal planning advice'],
    ['Weight Loss','weight-loss','Effective strategies for losing weight'],
    ['Muscle Building','muscle-building','Build strength and muscle mass'],
    ['Beginners','beginners','Getting started with your fitness journey'],
    ['Training','training','Workout programs and training tips'],
    ['Lifestyle','lifestyle','Healthy lifestyle habits and wellness']
  ];
  blogCategories.forEach(bc => {
    run("INSERT INTO blog_categories (name, slug, description) VALUES (?, ?, ?)", bc);
  });

  const blogPosts = [
    ['The Ultimate Guide to Starting Your Fitness Journey','the-ultimate-guide-to-starting-your-fitness-journey','/assets/img/blog/single_blog_1.png',1,'beginners',JSON.stringify(['fitness','beginners','tips']),'<h2>Starting Your Fitness Journey</h2><p>Fitness is not about being better than someone else. It is about being better than you used to be.</p><p>Starting a fitness journey can feel overwhelming, but it does not have to be.</p>','Discover how to start your fitness journey with expert tips from Zacson Fitness trainers.','The Ultimate Guide to Starting Your Fitness Journey | Zacson Fitness','Complete beginner guide to fitness.','https://zacsonfitness.com/blog/the-ultimate-guide-to-starting-your-fitness-journey',1,'2026-01-15','2026-01-15','2026-01-15'],
    ['5 Nutrition Myths That Are Sabotaging Your Progress','5-nutrition-myths-that-are-sabotaging-your-progress','/assets/img/blog/single_blog_2.png',1,'nutrition',JSON.stringify(['nutrition','myths','diet']),'<h2>Nutrition Myths Debunked</h2><p>Separating fact from fiction in the world of nutrition.</p>','Learn the truth about common nutrition myths that could be holding back your fitness progress.','5 Nutrition Myths Debunked | Zacson Fitness Blog','Common nutrition myths debunked.','https://zacsonfitness.com/blog/5-nutrition-myths-that-are-sabotaging-your-progress',1,'2026-02-10','2026-02-10','2026-02-10'],
    ['How to Build Muscle Naturally: A Science-Based Approach','how-to-build-muscle-naturally','/assets/img/blog/single_blog_3.png',1,'muscle-building',JSON.stringify(['muscle','training','science']),'<h2>Building Muscle Naturally</h2><p>A science-backed guide to gaining lean muscle without shortcuts.</p>','A comprehensive, science-based guide to building muscle naturally.','Build Muscle Naturally: Science-Based Guide | Zacson Fitness','Science-based approach to natural muscle building.','https://zacsonfitness.com/blog/how-to-build-muscle-naturally',1,'2026-03-05','2026-03-05','2026-03-05']
  ];
  blogPosts.forEach(bp => {
    run("INSERT INTO blog_posts (title, slug, featured_image, author_id, category, tags, content, excerpt, seo_title, meta_description, canonical_url, is_published, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", bp);
  });

  // ========== FAQ ==========
  const faqs = [
    ['What are the gym timings?','We are open Monday to Saturday from 5:30 AM to 10:00 PM, and Sundays from 7:00 AM to 8:00 PM.','general',1],
    ['Do you offer a free trial?','Yes! We offer a complimentary 1-day trial pass. Book it through our website or visit the gym directly.','membership',2],
    ['How do I join Zacson Fitness?','Visit our gym for a tour, choose your membership plan, complete the registration, and start training the same day.','membership',3],
    ['Is there a joining fee?','No, we do not charge any joining fee. You only pay for your chosen membership plan.','membership',4],
    ['Can I freeze my membership?','Yes, you can freeze your membership for up to 30 days per year. Contact the front desk to initiate a freeze.','membership',5],
    ['Do you provide personal training?','Yes, personal training is available with all plans at an additional cost, and included in Elite and Ultimate plans.','training',6],
    ['What group classes do you offer?','We offer Yoga, HIIT, Zumba, Functional Training, Boxing, Strength Training, CrossFit, Pilates, and more.','classes',7],
    ['Is parking available?','Yes, we have ample covered parking for cars and two-wheelers. Parking is complimentary for all members.','facilities',8],
    ['What payment methods do you accept?','We accept cash, UPI, credit/debit cards, net banking, and EMI options.','payment',9],
    ['What is the cancellation policy?','Monthly plans can be cancelled with 7 days notice. Quarterly and annual plans have pro-rata refund policies.','membership',10]
  ];
  faqs.forEach(f => {
    run("INSERT INTO faqs (question, answer, category, sort_order, is_active) VALUES (?, ?, ?, ?, 1)", f);
  });

  // ========== SITE SETTINGS ==========
  const siteSettings = [
    ['site_name', 'Zacson Fitness', 'general'],
    ['site_tagline', 'Forge Your Strength. Shape Your Life.', 'general'],
    ['site_description', 'Premium fitness facility in Andheri West, Mumbai.', 'general'],
    ['contact_phone', '+91 98765 43210', 'contact'],
    ['contact_email', 'hello@zacsonfitness.com', 'contact'],
    ['contact_whatsapp', '+919876543210', 'contact'],
    ['address', '14th Floor, Sagar Tech Plaza, Andheri Kurla Road, Andheri West, Mumbai 400053', 'contact'],
    ['instagram_url', 'https://instagram.com/zacsonfitness', 'social'],
    ['facebook_url', 'https://facebook.com/zacsonfitness', 'social'],
    ['twitter_url', 'https://twitter.com/zacsonfitness', 'social'],
    ['youtube_url', 'https://youtube.com/@zacsonfitness', 'social'],
    ['google_analytics_id', '', 'analytics'],
    ['meta_pixel_id', '', 'analytics'],
    ['razorpay_key_id', '', 'payment'],
    ['razorpay_key_secret', '', 'payment'],
    ['smtp_host', 'smtp.gmail.com', 'email'],
    ['smtp_port', '587', 'email'],
    ['smtp_user', '', 'email'],
    ['smtp_pass', '', 'email'],
    ['from_email', 'hello@zacsonfitness.com', 'email'],
    ['from_name', 'Zacson Fitness', 'email'],
    ['currency', 'INR', 'finance'],
    ['tax_rate', '18', 'finance'],
    ['timezone', 'Asia/Kolkata', 'general'],
    ['sms_provider', '', 'notifications'],
    ['whatsapp_api_key', '', 'notifications'],
    ['gst_number', '27AABCU9603R1ZM', 'finance'],
    ['pan_number', 'AABCU9603R', 'finance']
  ];
  siteSettings.forEach(s => {
    run("INSERT INTO site_settings (key, value, category) VALUES (?, ?, ?)", s);
  });

  console.log('Database seeded successfully with comprehensive Zacson Fitness data.');
}

module.exports = { seedData };
