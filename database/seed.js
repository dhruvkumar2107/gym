const { run, get, all, exec } = require('./db');
const bcrypt = require('bcryptjs');

function seedData() {
  const existingAdmin = get("SELECT id FROM users WHERE email = 'admin@zacsonfitness.com'");
  if (existingAdmin) return console.log('Database already seeded.');

  const adminHash = bcrypt.hashSync('admin123', 10);
  run("INSERT INTO users (username, email, password_hash, role, full_name, phone) VALUES (?, ?, ?, ?, ?, ?)",
    ['admin', 'admin@zacsonfitness.com', adminHash, 'admin', 'Rajesh Sharma', '+91 98765 43210']);
  const adminUser = get("SELECT id FROM users WHERE email = 'admin@zacsonfitness.com'");
  run("INSERT INTO admins (user_id, permissions) VALUES (?, ?)",
    [adminUser.id, JSON.stringify({ all: true })]);

  const plans = [
    ['Starter', 'starter', 'Perfect for beginners who want to explore our facilities.', 1499, 1999, 1, JSON.stringify(['Access to gym floor','Locker room access','Free WiFi','Basic equipment usage','Opening hours: 6 AM - 10 PM']), 0, 1, 1],
    ['Pro', 'pro', 'Our most popular plan for consistent trainers.', 1333, 4999, 3, JSON.stringify(['Everything in Starter','Group classes access','Steam room access','Monthly body analysis','Nutrition guide','2 guest passes/month']), 0, 1, 2],
    ['Elite', 'elite', 'The complete fitness experience for serious athletes.', 1166, 11994, 6, JSON.stringify(['Everything in Pro','Personal trainer (4 sessions/month)','Recovery zone access','Priority class booking','Diet consultation','5 guest passes/month']), 1, 1, 3],
    ['Ultimate', 'ultimate', 'Maximum value. Unbeatable commitment to your transformation.', 999, 23988, 12, JSON.stringify(['Everything in Elite','Unlimited personal training','VIP locker','Monthly INBODY scan','Quarterly fitness assessment','Unlimited guest passes','Merchandise kit']), 0, 1, 4],
    ['Student', 'student', 'Special pricing for students with valid ID.', 999, 1499, 1, JSON.stringify(['Full gym access','Group classes','Locker room','Student ID required']), 0, 1, 5],
    ['Couple', 'couple', 'Train together, stay together.', 2499, 3999, 1, JSON.stringify(['Full access for 2 members','Couple workout sessions','Shared locker','Group classes']), 0, 1, 6],
    ['Personal Training', 'personal-training', 'One-on-one coaching for maximum results.', 4999, 7999, 1, JSON.stringify(['Dedicated personal trainer','Custom workout plan','Diet planning','Weekly progress tracking','All gym facilities']), 0, 1, 7]
  ];
  plans.forEach(p => {
    run("INSERT INTO membership_plans (name, slug, description, price, original_price, duration_months, features, is_popular, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", p);
  });

  const trainers = [
    ['Arjun Kapoor', 'arjun-kapoor', '/assets/img/trainers/trainer1.jpg', 'Head Trainer & Founder', 12, JSON.stringify(['ACE Certified','K11 Academy','CrossFit L2']), JSON.stringify(['Body Building','Strength Training','Transformation']), 'Arjun founded Zacson Fitness with a vision to make premium fitness accessible. With 12 years of experience training over 500 clients, he specializes in body transformations and competitive preparation.', JSON.stringify({instagram:'#',twitter:'#',facebook:'#'}), 1, 1],
    ['Priya Menon', 'priya-menon', '/assets/img/trainers/trainer2.jpg', 'Yoga & Wellness Director', 9, JSON.stringify(['RYT 500','ACE Group Fitness','Sports Nutrition']), JSON.stringify(['Yoga','Pilates','Meditation','Flexibility']), 'Priya brings a holistic approach to fitness, blending traditional yoga with modern exercise science.', JSON.stringify({instagram:'#',twitter:'#'}), 1, 2],
    ['Vikram Singh', 'vikram-singh', '/assets/img/trainers/trainer3.jpg', 'Strength & Conditioning Coach', 8, JSON.stringify(['NSCA-CSCS','CrossFit L3','Olympic Lifting']), JSON.stringify(['Powerlifting','Olympic Lifting','CrossFit']), 'Vikram is a competitive powerlifter turned coach with an evidence-based approach.', JSON.stringify({instagram:'#',facebook:'#'}), 1, 3],
    ['Meera Reddy', 'meera-reddy', '/assets/img/trainers/trainer4.jpg', 'Cardio & HIIT Specialist', 7, JSON.stringify(['ACE Certified','Zumba Instructor','TRX Certified']), JSON.stringify(['HIIT','Zumba','Cardio','Functional Training']), 'Meera high-energy classes are the most popular at Zacson.', JSON.stringify({instagram:'#',twitter:'#'}), 1, 4],
    ['Karthik Iyer', 'karthik-iyer', '/assets/img/trainers/trainer5.jpg', 'Nutrition & Transformation Coach', 10, JSON.stringify(['ISSN Certified','Precision Nutrition L2','ACE']), JSON.stringify(['Weight Loss','Nutrition','Body Recomposition']), 'Karthik has transformed over 300 bodies through integrated training and nutrition.', JSON.stringify({instagram:'#',twitter:'#',facebook:'#'}), 1, 5],
    ['Nisha Gupta', 'nisha-gupta', '/assets/img/trainers/trainer6.jpg', 'Boxing & MMA Coach', 6, JSON.stringify(['ISSA Certified','Boxing Coach Level 2','Krav Maga']), JSON.stringify(['Boxing','Kickboxing','Self-Defense','MMA Conditioning']), 'Nisha is a former national-level boxer who brings real combat sports experience.', JSON.stringify({instagram:'#'}), 1, 6]
  ];
  trainers.forEach(t => {
    run("INSERT INTO trainers (name, slug, photo, designation, experience_years, certifications, specializations, bio, social_links, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", t);
  });

  const classes = [
    ['Power Yoga', 'power-yoga', 'Dynamic yoga flow combining strength and flexibility.', 2, 60, 'all-levels', 'Yoga', 25, '/assets/img/classes/yoga.jpg', 1],
    ['HIIT Burn', 'hiit-burn', 'High-intensity interval training for maximum calorie burn.', 4, 45, 'advanced', 'HIIT', 20, '/assets/img/classes/hiit.jpg', 1],
    ['Zumba Dance', 'zumba-dance', 'Latin-inspired dance fitness party.', 4, 50, 'beginner', 'Dance', 30, '/assets/img/classes/zumba.jpg', 1],
    ['Functional Training', 'functional-training', 'Train movements, not muscles.', 3, 55, 'intermediate', 'Functional', 18, '/assets/img/classes/functional.jpg', 1],
    ['Boxing Fitness', 'boxing-fitness', 'Learn boxing while getting an incredible cardio workout.', 6, 60, 'intermediate', 'Boxing', 16, '/assets/img/classes/boxing.jpg', 1],
    ['Strength Foundation', 'strength-foundation', 'Master the fundamental barbell lifts.', 3, 75, 'intermediate', 'Strength', 15, '/assets/img/classes/strength.jpg', 1],
    ['CrossFit WOD', 'crossfit-wod', 'Constantly varied functional movements at high intensity.', 3, 60, 'advanced', 'CrossFit', 15, '/assets/img/classes/crossfit.jpg', 1],
    ['Beginner Bootcamp', 'beginner-bootcamp', 'The perfect starting point for fitness newcomers.', 1, 45, 'beginner', 'General', 25, '/assets/img/classes/bootcamp.jpg', 1],
    ['Pilates Core', 'pilates-core', 'Mat-based Pilates focused on core strength.', 2, 50, 'all-levels', 'Pilates', 20, '/assets/img/classes/pilates.jpg', 1],
    ['MMA Conditioning', 'mma-conditioning', 'Mixed martial arts inspired conditioning workout.', 6, 60, 'advanced', 'Boxing', 14, '/assets/img/classes/mma.jpg', 1]
  ];
  classes.forEach(c => {
    run("INSERT INTO classes (name, slug, description, trainer_id, duration_minutes, difficulty, category, max_participants, image, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", c);
  });

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
    [10,'Wednesday','07:00','08:00','Boxing Ring'],[10,'Friday','07:00','08:00','Boxing Ring'],[10,'Sunday','09:00','10:00','Boxing Ring']
  ];
  schedules.forEach(s => {
    run("INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, location) VALUES (?, ?, ?, ?, ?)", s);
  });

  const facilities = [
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
  facilities.forEach(f => {
    run("INSERT INTO facilities (name, description, icon, image, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)", f);
  });

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

  const transformations = [
    ['Rahul Verma','/assets/img/transformations/rahul-before.jpg','/assets/img/transformations/rahul-after.jpg','6 months','95 kg','72 kg','Lost 23kg with consistent training and nutrition guidance.','Strength training with HIIT, 5 days/week.'],
    ['Priyanka S.','/assets/img/transformations/priyanka-before.jpg','/assets/img/transformations/priyanka-after.jpg','4 months','68 kg','55 kg','Transformed through yoga and functional training.','Yoga 3x/week, functional training 2x/week.'],
    ['Mohit T.','/assets/img/transformations/mohit-before.jpg','/assets/img/transformations/mohit-after.jpg','8 months','82 kg','70 kg','Gained lean muscle while losing fat with personal training.','Progressive overload with deficit diet.']
  ];
  transformations.forEach(t => {
    run("INSERT INTO transformations (name, before_image, after_image, duration, start_weight, end_weight, story, training_approach, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)", t);
  });

  const offers = [
    ['New Year Blast','Start the year strong with 20% off all plans!',20,'2026-01-01','2026-01-31','NEWYEAR20','[]',500,0,1],
    ['Refer & Earn','Refer a friend and both get 1 month free.',0,'2026-01-01','2026-12-31','REFER100','[]',1000,0,1]
  ];
  offers.forEach(o => {
    run("INSERT INTO offers (name, description, discount_percent, start_date, end_date, coupon_code, plan_ids, usage_limit, used_count, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", o);
  });

  const coupons = [
    ['WELCOME10',10,0,100,0,'2026-01-01','2026-12-31','[]',1],
    ['NEWYEAR20',20,0,500,0,'2026-01-01','2026-01-31','[]',1],
    ['REFER100',0,500,1000,0,'2026-01-01','2026-12-31','[]',1]
  ];
  coupons.forEach(c => {
    run("INSERT INTO coupons (code, discount_percent, discount_amount, max_uses, used_count, valid_from, valid_until, plan_ids, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", c);
  });

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
    ['The Ultimate Guide to Starting Your Fitness Journey','the-ultimate-guide-to-starting-your-fitness-journey','/assets/img/blog/single_blog_1.png',1,'beginners',JSON.stringify(['fitness','beginners','tips']),'<h2>Starting Your Fitness Journey</h2><p>Fitness is not about being better than someone else. It is about being better than you used to be.</p><p>Starting a fitness journey can feel overwhelming, but it does not have to be. Here is a step-by-step guide to help you begin:</p><h3>1. Set Clear Goals</h3><p>Before you walk into any gym, know what you want. Weight loss? Muscle gain? Better endurance? Your goals will shape your training program.</p><h3>2. Start Slow</h3><p>The biggest mistake beginners make is going too hard, too fast. Start with 3 days per week and build from there.</p><h3>3. Focus on Form</h3><p>Proper form prevents injury and maximizes results. Our trainers at Zacson Fitness provide complimentary form checks for all new members.</p><h3>4. Nutrition Matters</h3><p>You cannot out-train a bad diet. Focus on whole foods, adequate protein, and proper hydration.</p><h3>5. Be Patient</h3><p>Results take time. Trust the process and stay consistent. The body adapts to stress over time.</p>','Discover how to start your fitness journey with expert tips from Zacson Fitness trainers.','The Ultimate Guide to Starting Your Fitness Journey | Zacson Fitness','Complete beginner guide to fitness. Expert tips on starting your gym routine, nutrition, and building healthy habits.','https://zacsonfitness.com/blog/the-ultimate-guide-to-starting-your-fitness-journey',1,'2026-01-15','2026-01-15','2026-01-15'],
    ['5 Nutrition Myths That Are Sabotaging Your Progress','5-nutrition-myths-that-are-sabotaging-your-progress','/assets/img/blog/single_blog_2.png',1,'nutrition',JSON.stringify(['nutrition','myths','diet']),'<h2>Nutrition Myths Debunked</h2><p>Separating fact from fiction in the world of nutrition.</p><h3>Myth 1: Carbs Make You Fat</h3><p>Carbohydrates are your body primary energy source. The problem is not carbs, it is eating too much of anything. Complex carbs like oats, rice, and sweet potatoes fuel your workouts and aid recovery.</p><h3>Myth 2: You Need to Eat Every 2-3 Hours</h3><p>Meal frequency does not significantly impact metabolism. What matters more is your total daily caloric intake and macronutrient distribution.</p><h3>Myth 3: Supplements Are Essential</h3><p>Most supplements are unnecessary if your diet is solid. Focus on whole foods first, then supplement only what you cannot get from food.</p><h3>Myth 4: Late-Night Eating Causes Weight Gain</h3><p>It is not when you eat, but how much you eat. Your total daily calories determine weight gain or loss.</p><h3>Myth 5: Protein Shakes Are Only for Bodybuilders</h3><p>Protein shakes are convenient for anyone who struggles to meet their protein needs through food alone.</p>','Learn the truth about common nutrition myths that could be holding back your fitness progress.','5 Nutrition Myths Debunked | Zacson Fitness Blog','Common nutrition myths debunked. Learn what really matters for your diet and fitness goals.','https://zacsonfitness.com/blog/5-nutrition-myths-that-are-sabotaging-your-progress',1,'2026-02-10','2026-02-10','2026-02-10'],
    ['How to Build Muscle Naturally: A Science-Based Approach','how-to-build-muscle-naturally','/assets/img/blog/single_blog_3.png',1,'muscle-building',JSON.stringify(['muscle','training','science']),'<h2>Building Muscle Naturally</h2><p>A science-backed guide to gaining lean muscle without shortcuts.</p><h3>Progressive Overload</h3><p>The fundamental principle of muscle growth is progressive overload. You must consistently increase the demand on your muscles over time.</p><h3>Training Variables</h3><p>Volume (sets x reps), intensity (weight), and frequency (how often you train) are the key variables to manipulate.</p><p>Aim for 10-20 sets per muscle group per week, training each muscle 2-3 times per week.</p><h3>Nutrition for Growth</h3><p>You need a caloric surplus of 200-500 calories above maintenance. Consume 1.6-2.2g of protein per kg of bodyweight daily.</p><h3>Recovery</h3><p>Muscles grow during rest, not during training. Aim for 7-9 hours of sleep and manage stress levels.</p><h3>Patience and Consistency</h3><p>Natural muscle gain is slow - expect 0.5-1kg per month of training as a beginner. Stay consistent for at least 12 months before evaluating your program.</p>','A comprehensive, science-based guide to building muscle naturally through proper training and nutrition.','Build Muscle Naturally: Science-Based Guide | Zacson Fitness','Science-based approach to natural muscle building. Training, nutrition, and recovery strategies that work.','https://zacsonfitness.com/blog/how-to-build-muscle-naturally',1,'2026-03-05','2026-03-05','2026-03-05']
  ];
  blogPosts.forEach(bp => {
    run("INSERT INTO blog_posts (title, slug, featured_image, author_id, category, tags, content, excerpt, seo_title, meta_description, canonical_url, is_published, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", bp);
  });

  const faqs = [
    ['What are the gym timings?','We are open Monday to Saturday from 5:30 AM to 10:00 PM, and Sundays from 7:00 AM to 8:00 PM. Peak hours are 6-9 AM and 5-8 PM.','general',1],
    ['Do you offer a free trial?','Yes! We offer a complimentary 1-day trial pass. Book it through our website or visit the gym directly. No commitment required.','membership',2],
    ['How do I join Zacson Fitness?','Visit our gym for a tour, choose your membership plan, complete the registration, and start training the same day. You can also purchase membership online.','membership',3],
    ['Is there a joining fee?','No, we do not charge any joining fee. You only pay for your chosen membership plan.','membership',4],
    ['Can I freeze my membership?','Yes, you can freeze your membership for up to 30 days per year for medical reasons or travel. Contact the front desk to initiate a freeze.','membership',5],
    ['Do you provide personal training?','Yes, personal training is available with all plans at an additional cost, and included in the Elite and Ultimate plans. Our certified trainers create customized programs.','training',6],
    ['What group classes do you offer?','We offer Yoga, HIIT, Zumba, Functional Training, Boxing, Strength Training, CrossFit, Pilates, and more. Check the class timetable on our website.','classes',7],
    ['Is parking available?','Yes, we have ample covered parking for cars and two-wheelers. Parking is complimentary for all members.','facilities',8],
    ['What payment methods do you accept?','We accept cash, UPI, credit/debit cards, net banking, and EMI options. Online payments are processed through Razorpay.','payment',9],
    ['What is the cancellation policy?','Monthly plans can be cancelled with 7 days notice. Quarterly and annual plans have pro-rata refund policies. Contact management for details.','membership',10],
    ['Do you have locker facilities?','Yes, we provide spacious locker rooms with individual lockers, hot showers, toiletries, and hair dryers. Premium members get dedicated VIP lockers.','facilities',11],
    ['Can women train at the gym?','Absolutely! Zacson Fitness is a co-ed facility with equal access to all areas. We also have women-only group classes and female trainers available.','general',12],
    ['Do you offer student discounts?','Yes, we have a dedicated Student membership plan at reduced pricing. Valid student ID is required.','membership',13],
    ['Is there a dietitian or nutritionist on staff?','Yes, our Elite and Ultimate plans include diet consultations with our certified nutrition coach. Other members can book consultations separately.', 'training', 14]
  ];
  faqs.forEach(f => {
    run("INSERT INTO faqs (question, answer, category, sort_order, is_active) VALUES (?, ?, ?, ?, 1)", f);
  });

  const location = ['Zacson Fitness - Andheri West','andheri-west','14th Floor, Sagar Tech Plaza, Andheri Kurla Road, Andheri West','Mumbai','Maharashtra','400053','+91 98765 43210','hello@zacsonfitness.com',JSON.stringify({'mon-sat':'5:30 AM - 10:00 PM','sunday':'7:00 AM - 8:00 PM'}),'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.2!2d72.83!3d19.13!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDA3JzQ4LjAiTiA3MsKwNDknNDguMCJF!5e0!3m2!1sen!2sin!4v1',JSON.stringify(['Strength Zone','Cardio Deck','Free Weights','Functional Training','Group Studio','Recovery Lounge','Locker Rooms','Juice Bar','Parking']),1];
  run("INSERT INTO locations (name, slug, address, city, state, pincode, phone, email, opening_hours, map_embed_url, facilities, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", location);

  const siteSettings = [
    ['site_name', 'Zacson Fitness'],
    ['site_tagline', 'Forge Your Strength. Shape Your Life.'],
    ['site_description', 'Premium fitness facility in Andheri West, Mumbai. Personal training, group classes, and state-of-the-art equipment.'],
    ['contact_phone', '+91 98765 43210'],
    ['contact_email', 'hello@zacsonfitness.com'],
    ['contact_whatsapp', '+919876543210'],
    ['address', '14th Floor, Sagar Tech Plaza, Andheri Kurla Road, Andheri West, Mumbai 400053'],
    ['instagram_url', 'https://instagram.com/zacsonfitness'],
    ['facebook_url', 'https://facebook.com/zacsonfitness'],
    ['twitter_url', 'https://twitter.com/zacsonfitness'],
    ['youtube_url', 'https://youtube.com/@zacsonfitness'],
    ['google_analytics_id', ''],
    ['meta_pixel_id', ''],
    ['razorpay_key_id', ''],
    ['razorpay_key_secret', ''],
    ['smtp_host', 'smtp.gmail.com'],
    ['smtp_port', '587'],
    ['smtp_user', ''],
    ['smtp_pass', ''],
    ['from_email', 'hello@zacsonfitness.com'],
    ['from_name', 'Zacson Fitness']
  ];
  siteSettings.forEach(s => {
    run("INSERT INTO site_settings (key, value) VALUES (?, ?)", s);
  });

  console.log('Database seeded successfully with Zacson Fitness data.');
}

module.exports = { seedData };
