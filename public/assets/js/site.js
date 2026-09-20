var API = '/api';
var _localData = {};

_localData.trainers = [
  {id:1,name:'Rajesh Kumar',slug:'rajesh-kumar',designation:'Head Strength Coach',photo:'assets/img/trainers/trainer1.jpg',experience_years:12,bio:'NSCA-CSCS certified with 12+ years of experience in powerlifting and strength training. Former national-level powerlifter.',specializations:['Strength Training','Powerlifting','Olympic Lifting'],certifications:['NSCA-CSCS','ACE Certified','Kettlebell Specialist'],social_links:{instagram:'#',twitter:'#',facebook:'#'}},
  {id:2,name:'Priya Sharma',slug:'priya-sharma',designation:'Yoga & Mobility Expert',photo:'assets/img/trainers/trainer2.jpg',experience_years:8,bio:'RYT-500 certified yoga instructor specializing in Vinyasa, Hatha, and mobility restoration.',specializations:['Yoga','Mobility','Flexibility'],certifications:['RYT-500','Yoga Alliance','FRC Mobility'],social_links:{instagram:'#',twitter:'#',facebook:'#'}},
  {id:3,name:'Amit Patel',slug:'amit-patel',designation:'HIIT & Functional Training',photo:'assets/img/trainers/trainer3.jpg',experience_years:10,bio:'ACE-CPT and CrossFit Level 2 trainer. Specializes in high-intensity interval training and functional fitness.',specializations:['HIIT','CrossFit','Functional Training'],certifications:['ACE-CPT','CrossFit L2','TRX Certified'],social_links:{instagram:'#',twitter:'#',facebook:'#'}},
  {id:4,name:'Neha Gupta',slug:'neha-gupta',designation:'Nutrition & Weight Management',photo:'assets/img/trainers/trainer4.jpg',experience_years:7,bio:'Certified sports nutritionist and dietitian. Expert in body recomposition and fat loss.',specializations:['Nutrition','Weight Loss','Diet Planning'],certifications:['ISSN Certified','Sports Nutritionist','Certified Dietitian'],social_links:{instagram:'#',twitter:'#',facebook:'#'}},
  {id:5,name:'Vikram Singh',slug:'vikram-singh',designation:'Boxing & MMA Coach',photo:'assets/img/trainers/trainer5.jpg',experience_years:15,bio:'Former state-level boxer with 15 years of coaching experience. Trains beginners and competitive fighters.',specializations:['Boxing','MMA','Self-Defense'],certifications:['Boxing Coach Level 3','MMA Conditioning','First Aid Certified'],social_links:{instagram:'#',twitter:'#',facebook:'#'}},
  {id:6,name:'Ananya Reddy',slug:'ananya-reddy',designation:'Dance Fitness & Zumba',photo:'assets/img/trainers/trainer6.jpg',experience_years:6,bio:'ZIN-certified Zumba instructor and dance fitness specialist. Brings energy and fun to every class.',specializations:['Zumba','Dance Fitness','Aerobics'],certifications:['ZIN Certified','AFAA Group Fitness','Dance Fitness Specialist'],social_links:{instagram:'#',twitter:'#',facebook:'#'}}
];

_localData.classes = [
  {id:1,name:'Strength Training',slug:'strength-training',description:'Build muscle and increase strength with guided weightlifting sessions.',duration_minutes:60,difficulty:'intermediate',max_participants:20,image:'assets/img/classes/strength.jpg',trainer:'Rajesh Kumar',schedule:'Mon/Wed/Fri 6:00 AM'},
  {id:2,name:'HIIT',slug:'hiit',description:'High-intensity intervals designed to maximize calorie burn and cardiovascular fitness.',duration_minutes:45,difficulty:'advanced',max_participants:25,image:'assets/img/classes/hiit.jpg',trainer:'Amit Patel',schedule:'Tue/Thu 6:00 AM'},
  {id:3,name:'Yoga Flow',slug:'yoga-flow',description:'Dynamic yoga sequences combining breath and movement for flexibility and peace.',duration_minutes:60,difficulty:'beginner',max_participants:30,image:'assets/img/classes/yoga.jpg',trainer:'Priya Sharma',schedule:'Mon-Sat 7:30 AM'},
  {id:4,name:'Boxing',slug:'boxing',description:'Learn boxing fundamentals and get an incredible full-body workout.',duration_minutes:60,difficulty:'intermediate',max_participants:15,image:'assets/img/classes/boxing.jpg',trainer:'Vikram Singh',schedule:'Tue/Thu 6:00 PM'},
  {id:5,name:'CrossFit',slug:'crossfit',description:'Constantly varied functional movements performed at high intensity.',duration_minutes:60,difficulty:'advanced',max_participants:20,image:'assets/img/classes/crossfit.jpg',trainer:'Amit Patel',schedule:'Mon/Wed/Fri 5:30 PM'},
  {id:6,name:'Zumba',slug:'zumba',description:'Dance your way to fitness with high-energy Latin-inspired choreography.',duration_minutes:50,difficulty:'beginner',max_participants:35,image:'assets/img/classes/zumba.jpg',trainer:'Ananya Reddy',schedule:'Mon/Wed/Fri 6:30 PM'},
  {id:7,name:'Functional Training',slug:'functional-training',description:'Improve everyday movement patterns with practical strength exercises.',duration_minutes:45,difficulty:'all-levels',max_participants:20,image:'assets/img/classes/functional.jpg',trainer:'Amit Patel',schedule:'Tue/Thu 7:00 PM'},
  {id:8,name:'Core Blast',slug:'core-blast',description:'Intensive core-focused workout to build a strong, stable midsection.',duration_minutes:30,difficulty:'intermediate',max_participants:25,image:'assets/img/classes/strength.jpg',trainer:'Rajesh Kumar',schedule:'Daily 8:00 AM'},
  {id:9,name:'Mobility & Recovery',slug:'mobility-recovery',description:'Restore range of motion and recover from intense training sessions.',duration_minutes:45,difficulty:'beginner',max_participants:30,image:'assets/img/classes/yoga.jpg',trainer:'Priya Sharma',schedule:'Sat 9:00 AM'},
  {id:10,name:'Bootcamp',slug:'bootcamp',description:'Military-style group workout combining cardio and strength drills.',duration_minutes:55,difficulty:'advanced',max_participants:30,image:'assets/img/classes/bootcamp.jpg',trainer:'Vikram Singh',schedule:'Sun 7:00 AM'}
];

_localData.schedule = [
  {day:'Monday',time:'6:00 AM',class_name:'Strength Training',trainer_name:'Rajesh Kumar'},
  {day:'Monday',time:'7:30 AM',class_name:'Yoga Flow',trainer_name:'Priya Sharma'},
  {day:'Monday',time:'5:30 PM',class_name:'CrossFit',trainer_name:'Amit Patel'},
  {day:'Monday',time:'6:30 PM',class_name:'Zumba',trainer_name:'Ananya Reddy'},
  {day:'Tuesday',time:'6:00 AM',class_name:'HIIT',trainer_name:'Amit Patel'},
  {day:'Tuesday',time:'7:30 AM',class_name:'Yoga Flow',trainer_name:'Priya Sharma'},
  {day:'Tuesday',time:'6:00 PM',class_name:'Boxing',trainer_name:'Vikram Singh'},
  {day:'Tuesday',time:'7:00 PM',class_name:'Functional Training',trainer_name:'Amit Patel'},
  {day:'Wednesday',time:'6:00 AM',class_name:'Strength Training',trainer_name:'Rajesh Kumar'},
  {day:'Wednesday',time:'7:30 AM',class_name:'Yoga Flow',trainer_name:'Priya Sharma'},
  {day:'Wednesday',time:'5:30 PM',class_name:'CrossFit',trainer_name:'Amit Patel'},
  {day:'Wednesday',time:'6:30 PM',class_name:'Zumba',trainer_name:'Ananya Reddy'},
  {day:'Thursday',time:'6:00 AM',class_name:'HIIT',trainer_name:'Amit Patel'},
  {day:'Thursday',time:'7:30 AM',class_name:'Yoga Flow',trainer_name:'Priya Sharma'},
  {day:'Thursday',time:'6:00 PM',class_name:'Boxing',trainer_name:'Vikram Singh'},
  {day:'Thursday',time:'7:00 PM',class_name:'Functional Training',trainer_name:'Amit Patel'},
  {day:'Friday',time:'6:00 AM',class_name:'Strength Training',trainer_name:'Rajesh Kumar'},
  {day:'Friday',time:'7:30 AM',class_name:'Yoga Flow',trainer_name:'Priya Sharma'},
  {day:'Friday',time:'5:30 PM',class_name:'CrossFit',trainer_name:'Amit Patel'},
  {day:'Friday',time:'6:30 PM',class_name:'Zumba',trainer_name:'Ananya Reddy'},
  {day:'Saturday',time:'6:00 AM',class_name:'Strength Training',trainer_name:'Rajesh Kumar'},
  {day:'Saturday',time:'7:30 AM',class_name:'Yoga Flow',trainer_name:'Priya Sharma'},
  {day:'Saturday',time:'9:00 AM',class_name:'Mobility & Recovery',trainer_name:'Priya Sharma'},
  {day:'Sunday',time:'7:00 AM',class_name:'Bootcamp',trainer_name:'Vikram Singh'}
];

_localData.plans = [
  {id:1,name:'Monthly',duration_months:1,price:2500,original_price:3000,is_popular:false,features:['Full Gym Access','Cardio & Weights Zone','Free Wi-Fi','Locker & Shower Access','1 Group Class/Week']},
  {id:2,name:'Quarterly',duration_months:3,price:2200,original_price:3000,is_popular:true,features:['Full Gym Access','Cardio & Weights Zone','Free Wi-Fi','Locker & Shower','Unlimited Group Classes','Diet Guidance','Body Composition Analysis']},
  {id:3,name:'Half-Yearly',duration_months:6,price:1900,original_price:3000,is_popular:false,features:['Full Gym Access','All Equipment Zones','Free Wi-Fi','Locker & Shower','Unlimited Group Classes','Diet & Nutrition Plan','Body Composition Analysis','2 PT Sessions/Month']},
  {id:4,name:'Annual',duration_months:12,price:1500,original_price:3000,is_popular:false,features:['Full Gym Access','All Equipment Zones','Free Wi-Fi','Locker & Shower','Unlimited Group Classes','Diet & Nutrition Plan','Monthly Body Analysis','4 PT Sessions/Month','Priority Class Booking','Guest Passes','Membership Freeze']}
];

_localData.testimonials = [
  {id:1,name:'Arjun Mehta',rating:5,testimonial:'Zacson Fitness completely transformed my approach to health. The trainers are incredibly knowledgeable and the community keeps me motivated every single day.'},
  {id:2,name:'Sneha Kulkarni',rating:5,testimonial:'After 6 months at Zacson, I lost 15kg and gained confidence I never knew I had. The personalized diet plans and group classes made all the difference.'},
  {id:3,name:'Rohit Verma',rating:5,testimonial:'Best gym in Andheri West, hands down. The equipment is world-class and the trainers actually care about your progress. Worth every rupee.'},
  {id:4,name:'Pooja Deshmukh',rating:5,testimonial:'I have been a member for over a year now. The yoga classes with Priya are exceptional. The atmosphere is both intense and welcoming.'},
  {id:5,name:'Karan Malhotra',rating:4,testimonial:'The CrossFit and boxing programs here are top-notch. Coach Vikram pushes you to your limits while ensuring proper form. Highly recommend.'}
];

_localData.transformations = [
  {id:1,name:'Mohit Sharma',before_image:'assets/img/transformations/mohit-before.jpg',after_image:'assets/img/transformations/mohit-after.jpg',duration:'6 months',start_weight:'92 kg',end_weight:'75 kg',goal:'Fat Loss',story:'Lost 17kg through a combination of strength training and clean eating. The structured program at Zacson made it sustainable.'},
  {id:2,name:'Priyanka Nair',before_image:'assets/img/transformations/priyanka-before.jpg',after_image:'assets/img/transformations/priyanka-after.jpg',duration:'8 months',start_weight:'68 kg',end_weight:'55 kg',goal:'Body Recomposition',story:'Transformed my body composition while building lean muscle. The nutrition guidance was a game-changer.'},
  {id:3,name:'Rahul Joshi',before_image:'assets/img/transformations/rahul-before.jpg',after_image:'assets/img/transformations/rahul-after.jpg',duration:'12 months',start_weight:'70 kg',end_weight:'82 kg',goal:'Muscle Gain',story:'Gained 12kg of lean muscle through progressive overload training. Coach Rajesh designed the perfect program for me.'}
];

_localData.blogPosts = [
  {id:1,slug:'progressive-overload-key',title:'Progressive Overload: The Key to Muscle Growth',category:'Strength',excerpt:'Learn why gradually increasing the demands on your muscles is essential for continuous growth.',content:'<p>Progressive overload is the fundamental principle behind all muscle growth. By systematically increasing weight, reps, or sets over time, you force your muscles to adapt and grow stronger.</p><h3>How to Apply Progressive Overload</h3><ul><li>Increase weight by 2-5% when you can complete all prescribed reps</li><li>Add 1-2 reps per set each week</li><li>Add an extra set to compound movements</li><li>Reduce rest periods between sets</li></ul><p>The key is consistency and patience. Track your workouts, and you will see steady improvement over time.</p>',featured_image:'assets/img/gallery/gallery1.png',read_time:5},
  {id:2,slug:'nutrition-for-fat-loss',title:'Nutrition Fundamentals for Fat Loss',category:'Nutrition',excerpt:'Discover the nutritional strategies that actually work for sustainable fat loss.',content:'<p>Fat loss comes down to a caloric deficit, but how you achieve that deficit matters enormously.</p><h3>Key Nutrition Principles</h3><ul><li>Prioritize protein at every meal</li><li>Eat plenty of vegetables for volume and micronutrients</li><li>Time your carbs around your workouts</li><li>Stay hydrated with at least 3 liters of water daily</li></ul>',featured_image:'assets/img/gallery/gallery3.png',read_time:6},
  {id:3,slug:'hiit-vs-steady-state',title:'HIIT vs Steady-State Cardio: Which is Better?',category:'Training',excerpt:'A comprehensive comparison of high-intensity intervals and steady-state cardio.',content:'<p>Both HIIT and steady-state cardio have their place in a well-rounded fitness program.</p><h3>When to Use HIIT</h3><ul><li>When you are short on time</li><li>For improving cardiovascular power</li><li>To break through fat loss plateaus</li></ul><h3>When to Use Steady-State</h3><ul><li>On recovery days</li><li>For building aerobic base</li></ul>',featured_image:'assets/img/gallery/video-bg.png',read_time:5},
  {id:4,slug:'beginners-guide-gym',title:'The Complete Beginners Guide to the Gym',category:'Beginner Fitness',excerpt:'Everything you need to know before your first gym session.',content:'<p>Starting at a gym can feel overwhelming, but with the right guidance, it becomes incredibly rewarding.</p><h3>Before Your First Visit</h3><ul><li>Set realistic goals</li><li>Invest in proper footwear and clothing</li><li>Bring a water bottle and small towel</li></ul><p>Ask our trainers for a complimentary orientation session.</p>',featured_image:'assets/img/gallery/about.png',read_time:7},
  {id:5,slug:'recovery-importance',title:'Why Recovery is Just as Important as Training',category:'Recovery',excerpt:'Overtraining can derail your progress. Learn how proper recovery accelerates results.',content:'<p>Your muscles do not grow in the gym. They grow during recovery.</p><h3>Recovery Essentials</h3><ul><li>Get 7-9 hours of quality sleep every night</li><li>Take at least 1-2 complete rest days per week</li><li>Practice active recovery</li><li>Eat enough protein and calories to support repair</li></ul>',featured_image:'assets/img/gallery/section_bg02.png',read_time:4},
  {id:6,slug:'protein-myths-busted',title:'5 Protein Myths That Won't Go Away',category:'Nutrition',excerpt:'Separating fact from fiction when it comes to protein intake.',content:'<p>Protein is perhaps the most discussed macronutrient in fitness.</p><h3>Myth 1: You Need 1g Per Pound</h3><p>Research shows 1.6-2.2g per kg of bodyweight is optimal for muscle growth.</p><h3>Myth 2: Protein Damages Your Kidneys</h3><p>For healthy individuals, high protein intake has been shown to be safe.</p>',featured_image:'assets/img/gallery/gallery5.png',read_time:5},
  {id:7,slug:'mental-health-benefits',title:'How Exercise Transforms Your Mental Health',category:'Lifestyle',excerpt:'The powerful connection between regular exercise and improved mental well-being.',content:'<p>Exercise is one of the most effective tools for improving mental health.</p><h3>The Science</h3><ul><li>Exercise releases endorphins, serotonin, and dopamine</li><li>Regular training reduces cortisol levels</li><li>Physical activity improves sleep quality</li><li>Group exercise provides social connection</li></ul>',featured_image:'assets/img/gallery/team2.png',read_time:6},
  {id:8,slug:'compound-exercises-guide',title:'The Top 5 Compound Exercises Everyone Should Do',category:'Strength',excerpt:'Master these fundamental movements for maximum strength.',content:'<p>Compound exercises work multiple muscle groups simultaneously.</p><h3>The Big Five</h3><ol><li><strong>Squat</strong> - The king of all exercises</li><li><strong>Deadlift</strong> - Targets the entire posterior chain</li><li><strong>Bench Press</strong> - Classic upper body builder</li><li><strong>Overhead Press</strong> - Builds strong shoulders</li><li><strong>Barbell Row</strong> - Essential for a strong back</li></ol>',featured_image:'assets/img/gallery/gallery2.png',read_time:5}
];

_localData.facilities = [
  {id:1,name:'Strength Zone',icon:'dumbbell',description:'Over 50 premium strength machines and free weight stations designed for every muscle group.'},
  {id:2,name:'Cardio Deck',icon:'heartbeat',description:'A dedicated floor with treadmills, ellipticals, rowing machines, and stationary bikes.'},
  {id:3,name:'Functional Training Area',icon:'running',description:'Open space with TRX, battle ropes, kettlebells, and plyometric boxes.'},
  {id:4,name:'Free Weights',icon:'weight-hanging',description:'Complete set of dumbbells from 1kg to 50kg, barbells, and specialized bars.'},
  {id:5,name:'Boxing Ring',icon:'fist-raised',description:'Professional boxing ring with heavy bags, speed bags, and focus mitts.'},
  {id:6,name:'Group Fitness Studio',icon:'music',description:'Spacious studio with sound system, mirrors, and equipment for group classes.'},
  {id:7,name:'Recovery Zone',icon:'spa',description:'Foam rollers, massage guns, stretching areas, and guided recovery sessions.'},
  {id:8,name:'Locker Rooms',icon:'lock',description:'Spacious lockers with complimentary towels, toiletries, and changing facilities.'}
];

_localData.gallery = [
  {id:1,title:'Strength Zone',image:'assets/img/gallery/gallery1.png',category:'gym'},
  {id:2,title:'Cardio Deck',image:'assets/img/gallery/gallery2.png',category:'equipment'},
  {id:3,title:'Group Classes',image:'assets/img/gallery/gallery3.png',category:'classes'},
  {id:4,title:'Free Weights',image:'assets/img/gallery/gallery4.png',category:'equipment'},
  {id:5,title:'Boxing Area',image:'assets/img/gallery/gallery5.png',category:'gym'},
  {id:6,title:'Functional Zone',image:'assets/img/gallery/gallery6.png',category:'gym'},
  {id:7,title:'Expert Trainers',image:'assets/img/gallery/team1.png',category:'trainers'},
  {id:8,title:'Yoga Studio',image:'assets/img/gallery/team2.png',category:'classes'},
  {id:9,title:'Community Events',image:'assets/img/gallery/team3.png',category:'events'},
  {id:10,title:'Training Session',image:'assets/img/gallery/about.png',category:'classes'},
  {id:11,title:'Premium Equipment',image:'assets/img/gallery/about2.png',category:'equipment'},
  {id:12,title:'Member Achievements',image:'assets/img/gallery/cat1.png',category:'events'}
];

_localData.faq = [
  {id:1,question:'What are the gym timings?',answer:'Zacson Fitness is open Monday to Saturday from 5:30 AM to 10:00 PM, and Sunday from 6:00 AM to 10:00 PM.'},
  {id:2,question:'Do you offer a free trial?',answer:'Yes! We offer a complimentary 1-day trial pass for first-time visitors. Fill out the Free Trial form or contact us via WhatsApp.'},
  {id:3,question:'Can I freeze my membership?',answer:'Yes, Annual plan members can freeze their membership for up to 30 days per year.'},
  {id:4,question:'Do you provide personal training?',answer:'Absolutely. We have certified personal trainers who create customized workout plans based on your goals and fitness level.'},
  {id:5,question:'What should I bring for my first visit?',answer:'Bring comfortable workout clothing, athletic shoes, a water bottle, and a small towel.'},
  {id:6,question:'Is parking available?',answer:'Yes, the Sagar Tech Plaza complex has dedicated parking for gym members.'},
  {id:7,question:'Can I bring a friend?',answer:'Annual members receive guest passes. Other members can purchase day passes for their guests at the front desk.'},
  {id:8,question:'Are there group classes included?',answer:'Group classes are included in the Quarterly, Half-Yearly, and Annual plans.'}
];

_localData.offers = [
  {id:1,title:'New Year Offer',description:'Get 20% off on all Annual plans. Limited time offer!',code:'NEWYEAR20',discount_percent:20,valid_until:'2026-01-31'},
  {id:2,title:'Refer a Friend',description:'Refer a friend and both receive one month free.',code:'REFER1MONTH',discount_amount:2500,valid_until:'2026-12-31'}
];

_localData.coupons = {'WELCOME10':{discount_percent:10},'FIT2026':{discount_percent:15},'FIRST500':{discount_amount:500},'ANNUAL20':{discount_percent:20,min_plan:4}};

_localData.workouts = [
  {id:1,name:'Bench Press',category:'Chest',difficulty:'Intermediate',duration:'4 sets x 8-10 reps',description:'Compound chest exercise targeting pectorals, anterior deltoids, and triceps. Use proper arch and foot placement.',muscles:'Pectorals, Triceps, Front Delts',equipment:'Barbell, Bench'},
  {id:2,name:'Deadlift',category:'Back',difficulty:'Advanced',duration:'4 sets x 5-6 reps',description:'Full-body compound lift targeting posterior chain. Maintain neutral spine throughout the movement.',muscles:'Hamstrings, Glutes, Lower Back, Traps',equipment:'Barbell'},
  {id:3,name:'Squat',category:'Legs',difficulty:'Intermediate',duration:'4 sets x 8-10 reps',description:'King of all exercises. Targets quads, glutes, and core. Go to parallel depth for maximum benefit.',muscles:'Quadriceps, Glutes, Hamstrings',equipment:'Barbell, Squat Rack'},
  {id:4,name:'Overhead Press',category:'Shoulders',difficulty:'Intermediate',duration:'3 sets x 8-10 reps',description:'Standing barbell press for shoulder development. Engage core and squeeze glutes for stability.',muscles:'Deltoids, Triceps, Core',equipment:'Barbell'},
  {id:5,name:'Barbell Row',category:'Back',difficulty:'Intermediate',duration:'4 sets x 8-10 reps',description:'Horizontal pulling movement for back thickness. Keep torso stable and pull to lower chest.',muscles:'Lats, Rhomboids, Biceps',equipment:'Barbell'},
  {id:6,name:'Pull-Ups',category:'Back',difficulty:'Intermediate',duration:'3 sets x max reps',description:'Bodyweight vertical pulling exercise. Full range of motion from dead hang to chin over bar.',muscles:'Lats, Biceps, Rear Delts',equipment:'Pull-Up Bar'},
  {id:7,name:'Lateral Raises',category:'Shoulders',difficulty:'Beginner',duration:'3 sets x 12-15 reps',description:'Isolation exercise for medial deltoids. Use light weight with controlled tempo.',muscles:'Lateral Deltoids',equipment:'Dumbbells'},
  {id:8,name:'Bicep Curls',category:'Arms',difficulty:'Beginner',duration:'3 sets x 10-12 reps',description:'Classic bicep isolation. Alternate between hammer and standard grip for complete development.',muscles:'Biceps, Brachialis',equipment:'Dumbbells'},
  {id:9,name:'Tricep Dips',category:'Arms',difficulty:'Intermediate',duration:'3 sets x 10-12 reps',description:'Compound arm exercise. Lean forward for chest emphasis, upright for tricep emphasis.',muscles:'Triceps, Chest, Front Delts',equipment:'Dip Station'},
  {id:10,name:'Plank',category:'Core',difficulty:'Beginner',duration:'3 sets x 45-60 seconds',description:'Isometric core exercise. Maintain straight line from head to heels. Do not let hips sag.',muscles:'Abs, Obliques, Lower Back',equipment:'None'},
  {id:11,name:'Romanian Deadlift',category:'Legs',difficulty:'Intermediate',description:'Hip-hinge movement targeting hamstrings and glutes. Keep slight knee bend throughout.',duration:'3 sets x 10-12 reps',muscles:'Hamstrings, Glutes, Lower Back',equipment:'Barbell'},
  {id:12,name:'Burpees',category:'Full Body',difficulty:'Advanced',duration:'3 sets x 15 reps',description:'Full-body metabolic conditioning exercise. Combines squat, plank, push-up, and jump.',muscles:'Full Body',equipment:'None'}
];

function apiGet(path) {
  return fetch(API + path).then(function(res) {
    if (!res.ok) throw new Error('fail');
    return res.json();
  }).then(function(data) {
    if (Array.isArray(data) && data.length > 0) return data;
    if (data && (data.posts || data.id || data.status === 'ok')) return data;
    throw new Error('empty');
  }).catch(function() { return getLocalData(path); });
}
function apiPost(path, data) {
  return fetch(API + path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(r){return r.json();}).catch(function(){return{error:'Network error'};});
}
function getLocalData(path) {
  if (path.indexOf('/membership/plans') >= 0) return _localData.plans;
  if (path.indexOf('/membership/validate-coupon') >= 0) return null;
  if (path.indexOf('/trainers') >= 0) {
    if (path.match(/\/trainers\/[\w-]+$/)) return _localData.trainers[0];
    return _localData.trainers;
  }
  if (path.indexOf('/classes') >= 0) {
    if (path.indexOf('/schedule') >= 0) return _localData.schedule;
    return _localData.classes;
  }
  if (path.indexOf('/testimonials') >= 0) return _localData.testimonials;
  if (path.indexOf('/transformations') >= 0) return _localData.transformations;
  if (path.indexOf('/blog') >= 0) {
    if (path.match(/\/blog\/[\w-]+$/)) return _localData.blogPosts[0];
    return {posts: _localData.blogPosts};
  }
  if (path.indexOf('/facilities') >= 0) return _localData.facilities;
  if (path.indexOf('/gallery') >= 0) return _localData.gallery;
  if (path.indexOf('/workouts') >= 0) return _localData.workouts;
  if (path.indexOf('/faq') >= 0) return _localData.faq;
  if (path.indexOf('/offers') >= 0) return _localData.offers;
  if (path.indexOf('/locations') >= 0) return [{id:1,name:'Zacson Fitness Andheri West',address:'14th Floor, Sagar Tech Plaza, Andheri Kurla Road, Andheri West, Mumbai',phone:'+919876543210',lat:19.1197,lng:72.8464}];
  if (path.indexOf('/settings') >= 0) return {};
  if (path.indexOf('/membership/') >= 0) return null;
  return null;
}

function getToken() { return localStorage.getItem('zacson_token'); }
function setToken(t) { localStorage.setItem('zacson_token', t); }
function getUser() { try { return JSON.parse(localStorage.getItem('zacson_user')); } catch(e) { return null; } }
function setUser(u) { localStorage.setItem('zacson_user', JSON.stringify(u)); }

function openWhatsApp(message) {
  var phone = '919876543210';
  var msg = encodeURIComponent(message || 'Hi! I am interested in Zacson Fitness memberships.');
  window.open('https://wa.me/' + phone + '?text=' + msg, '_blank');
  trackEvent('whatsapp_click');
}

function showToast(message, type) {
  var toast = document.getElementById('site-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'site-toast';
    toast.style.cssText = 'position:fixed;bottom:30px;right:90px;z-index:9999;padding:15px 30px;border-radius:8px;color:#fff;font-size:14px;display:none;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Roboto Condensed,sans-serif;';
    document.body.appendChild(toast);
  }
  toast.style.background = type === 'error' ? '#e74c3c' : '#27ae60';
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 4000);
}

function trackEvent(eventName, params) {
  params = params || {};
  if (typeof gtag === 'function') gtag('event', eventName, params);
  if (typeof fbq === 'function') {
    var px = {lead_generated:'Lead',checkout_initiated:'InitiateCheckout',purchase_completed:'Purchase',whatsapp_click:'Contact'};
    if (px[eventName]) fbq('track', px[eventName], params);
  }
}

function initNavbar() {
  var header = document.querySelector('.header-area');
  if (header) {
    window.addEventListener('scroll', function() { header.classList.toggle('scrolled', window.scrollY > 50); });
  }
  var hamburger = document.querySelector('.mobile_menu');
  var overlay = document.getElementById('mobileNavOverlay');
  var drawer = document.getElementById('mobileNavDrawer');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'mobileNavOverlay'; overlay.className = 'mobile-nav-overlay'; document.body.appendChild(overlay); }
  if (!drawer) {
    drawer = document.createElement('div'); drawer.id = 'mobileNavDrawer'; drawer.className = 'mobile-nav-drawer';
    var navItems = [
      {href:'index.html',text:'Home'},{href:'about.html',text:'About'},{href:'courses.html',text:'Programs'},
      {href:'pricing.html',text:'Pricing'},{href:'trainers.html',text:'Trainers'},{href:'classes.html',text:'Classes'},
      {href:'facilities.html',text:'Facilities'},{href:'gallery.html',text:'Gallery'},{href:'transformations.html',text:'Transformations'},
      {href:'calculators.html',text:'Calculators'},{href:'blog.html',text:'Blog'},{href:'contact.html',text:'Contact'}
    ];
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    var linksHtml = navItems.map(function(n) {
      return '<li><a href="' + n.href + '"' + (currentPage === n.href ? ' class="active"' : '') + '>' + n.text + '</a></li>';
    }).join('');
    drawer.innerHTML = '<button class="mobile-nav-close" aria-label="Close menu">&times;</button><ul>' + linksHtml + '</ul><div class="mobile-nav-cta"><a href="javascript:void(0)" onclick="openWhatsApp(\'Hi! I would like to book a free trial.\')">Free Trial</a></div>';
    document.body.appendChild(drawer);
  }
  function closeMenu() { overlay.classList.remove('active'); drawer.classList.remove('active'); document.body.style.overflow = ''; drawer.setAttribute('aria-hidden', 'true'); }
  function openMenu() { overlay.classList.add('active'); drawer.classList.add('active'); document.body.style.overflow = 'hidden'; drawer.removeAttribute('aria-hidden'); closeBtn && closeBtn.focus(); }
  function trapFocus(e) {
    if (!drawer.classList.contains('active')) return;
    var focusable = drawer.querySelectorAll('a, button, [tabindex]');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('aria-label', 'Mobile navigation');
  if (hamburger) hamburger.addEventListener('click', function() { drawer.classList.contains('active') ? closeMenu() : openMenu(); });
  overlay.addEventListener('click', closeMenu);
  var closeBtn = drawer.querySelector('.mobile-nav-close');
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  drawer.querySelectorAll('a').forEach(function(a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && drawer.classList.contains('active')) closeMenu(); trapFocus(e); });
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-menu nav ul li').forEach(function(li) {
    var a = li.querySelector('a');
    if (a && a.getAttribute('href') === currentPage) li.classList.add('active');
  });
}

function initWhatsAppBtn() {
  if (document.getElementById('whatsapp-fab')) return;
  var fab = document.createElement('div');
  fab.id = 'whatsapp-fab';
  fab.innerHTML = '<a href="https://wa.me/919876543210?text=' + encodeURIComponent('Hi! I would like to know more about Zacson Fitness.') + '" target="_blank" aria-label="Chat on WhatsApp" style="position:fixed;bottom:30px;left:30px;z-index:9998;background:#25d366;color:#fff;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 20px rgba(0,0,0,0.3);text-decoration:none;transition:transform 0.3s;"><i class="fab fa-whatsapp"></i></a>';
  document.body.appendChild(fab);
}

function initBackToTop() {
  var btn = document.getElementById('back-top');
  if (!btn) return;
  window.addEventListener('scroll', function() { btn.style.display = window.scrollY > 400 ? 'block' : 'none'; });
  btn.addEventListener('click', function(e) { e.preventDefault(); window.scrollTo({top:0,behavior:'smooth'}); });
}

function setActiveNav() {
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#navigation li, .main-menu nav ul li').forEach(function(li) {
    var a = li.querySelector('a');
    if (a && a.getAttribute('href') === currentPage) li.classList.add('active');
  });
}

function loadMembershipPlans() {
  var container = document.getElementById('plans-container');
  if (!container) return;
  apiGet('/membership/plans').then(function(plans) {
    if (!plans || !plans.length) return;
    container.innerHTML = plans.map(function(p) {
      var total = p.price * p.duration_months;
      var featuresHtml = p.features.map(function(f) {
        return '<div class="single-features"><div class="features-icon"><i class="fas fa-check"></i></div><div class="features-caption"><p>' + f + '</p></div></div>';
      }).join('');
      return '<div class="col-lg-3 col-md-6 col-sm-6"><div class="properties mb-30' + (p.is_popular ? ' popular-plan' : '') + '">' +
        (p.is_popular ? '<div class="popular-badge">Most Popular</div>' : '') +
        '<div class="properties__card"><div class="properties__caption"><span class="month">' + p.duration_months + (p.duration_months === 1 ? ' month' : ' months') + '</span>' +
        '<p class="mb-25 plan-price">&#8377;' + p.price.toLocaleString() + '/mo' +
        (p.duration_months > 1 ? ' <span class="plan-total">(&#8377;' + total.toLocaleString() + ' total)</span>' : '') +
        (p.original_price ? ' <span class="original-price">&#8377;' + (p.original_price * p.duration_months).toLocaleString() + '</span>' : '') +
        '</p>' + featuresHtml +
        '<a href="javascript:void(0)" class="border-btn border-btn2 plan-join-btn" data-plan-id="' + p.id + '" data-plan-name="' + p.name + '" data-plan-price="' + p.price + '" data-plan-duration="' + p.duration_months + '">Join Now</a>' +
        '</div></div></div></div>';
    }).join('');
    container.querySelectorAll('.plan-join-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openCheckoutModal({id:parseInt(this.dataset.planId),name:this.dataset.planName,price:parseInt(this.dataset.planPrice),duration:parseInt(this.dataset.planDuration)});
      });
    });
  });
}

var checkoutState = {plan:null,coupon:null,discount:0};

function openCheckoutModal(plan) {
  checkoutState = {plan:plan,coupon:null,discount:0};
  trackEvent('checkout_initiated', {plan_name:plan.name, value:plan.price*plan.duration});
  var modal = document.getElementById('checkoutModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'checkoutModal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;align-items:center;justify-content:center;';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Checkout');
    var html = '<div class="checkout-overlay" onclick="closeCheckoutModal()"></div>';
    html += '<div class="checkout-dialog"><div class="checkout-header"><h3>Join Zacson Fitness</h3><button class="checkout-close" onclick="closeCheckoutModal()">&times;</button></div>';
    html += '<div class="checkout-body">';
    html += '<div class="checkout-steps"><div class="step active" data-step="1"><span>1</span> Plan</div><div class="step" data-step="2"><span>2</span> Details</div><div class="step" data-step="3"><span>3</span> Payment</div></div>';
    html += '<div id="checkoutStep1" class="checkout-step-content">';
    html += '<div class="checkout-plan-summary"></div>';
    html += '<div class="checkout-coupon"><input type="text" id="couponInput" placeholder="Enter coupon (e.g. WELCOME10)"><button onclick="applyCoupon()" class="btn-coupon">Apply</button></div>';
    html += '<div id="couponMessage" class="coupon-message"></div>';
    html += '<div class="checkout-pricing"></div>';
    html += '<button class="checkout-next-btn" onclick="checkoutGoStep(2)">Continue</button></div>';
    html += '<div id="checkoutStep2" class="checkout-step-content" style="display:none">';
    html += '<form id="checkoutForm"><div class="form-group"><label>Full Name *</label><input type="text" name="name" required placeholder="Your full name"></div>';
    html += '<div class="form-group"><label>Email *</label><input type="email" name="email" required placeholder="your@email.com"></div>';
    html += '<div class="form-group"><label>Phone *</label><input type="tel" name="phone" required placeholder="+91 98765 43210"></div>';
    html += '<button type="button" class="checkout-back-btn" onclick="checkoutGoStep(1)">Back</button>';
    html += '<button type="button" class="checkout-next-btn" onclick="checkoutGoStep(3)">Proceed to Payment</button></form></div>';
    html += '<div id="checkoutStep3" class="checkout-step-content" style="display:none">';
    html += '<div class="checkout-final-summary"></div>';
    html += '<div id="checkoutPaymentBtn" class="checkout-pay-btn" onclick="initiateRazorpayPayment()">Pay with Razorpay</div>';
    html += '<p class="checkout-secure"><i class="fas fa-lock"></i> Secured by Razorpay</p>';
    html += '<button type="button" class="checkout-back-btn" onclick="checkoutGoStep(2)">Back</button></div>';
    html += '<div id="checkoutSuccess" style="display:none;text-align:center;padding:30px;">';
    html += '<i class="fas fa-check-circle" style="font-size:60px;color:#27ae60;"></i>';
    html += '<h3>Welcome to Zacson Fitness!</h3>';
    html += '<p id="checkoutSuccessMsg"></p>';
    html += '<p class="invoice-num" id="checkoutInvoiceNum"></p>';
    html += '<button class="checkout-next-btn" onclick="closeCheckoutModal()" style="margin-top:20px;">Close</button></div>';
    html += '</div></div>';
    modal.innerHTML = html;
    document.body.appendChild(modal);
  }
  renderCheckoutPlanSummary();
  checkoutGoStep(1);
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  var modal = document.getElementById('checkoutModal');
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

function checkoutGoStep(step) {
  if (step === 3) {
    var form = document.getElementById('checkoutForm');
    if (form && !form.checkValidity()) { form.reportValidity(); return; }
  }
  document.querySelectorAll('.checkout-step-content').forEach(function(el) { el.style.display = 'none'; });
  document.querySelectorAll('.checkout-steps .step').forEach(function(el) { el.classList.remove('active'); });
  var stepEl = document.getElementById('checkoutStep' + step);
  if (stepEl) stepEl.style.display = 'block';
  document.querySelectorAll('.checkout-steps .step').forEach(function(el) {
    if (parseInt(el.dataset.step) <= step) el.classList.add('active');
  });
  if (step === 3) renderCheckoutFinalSummary();
}

function renderCheckoutPlanSummary() {
  var plan = checkoutState.plan;
  var el = document.querySelector('.checkout-plan-summary');
  if (!el || !plan) return;
  el.innerHTML = '<div class="plan-selected"><h4>' + plan.name + '</h4><p>' + plan.duration + ' month' + (plan.duration > 1 ? 's' : '') + ' at &#8377;' + plan.price.toLocaleString() + '/mo = &#8377;' + (plan.price * plan.duration).toLocaleString() + '</p></div>';
  updateCheckoutPricing();
}

function updateCheckoutPricing() {
  var plan = checkoutState.plan;
  var el = document.querySelector('.checkout-pricing');
  if (!el || !plan) return;
  var base = plan.price * plan.duration;
  var html = '<div class="pricing-row"><span>Plan Total</span><span>&#8377;' + base.toLocaleString() + '</span></div>';
  if (checkoutState.discount > 0) {
    html += '<div class="pricing-row discount"><span>Coupon (' + checkoutState.coupon + ')</span><span>-&#8377;' + checkoutState.discount.toLocaleString() + '</span></div>';
  }
  html += '<div class="pricing-row total"><span>Total</span><span>&#8377;' + (base - checkoutState.discount).toLocaleString() + '</span></div>';
  el.innerHTML = html;
}

function applyCoupon() {
  var code = document.getElementById('couponInput').value.trim().toUpperCase();
  if (!code) return;
  var msgEl = document.getElementById('couponMessage');
  var couponData = _localData.coupons[code];
  if (!couponData) {
    msgEl.innerHTML = '<span class="coupon-error">Invalid coupon code</span>';
    checkoutState.coupon = null;
    checkoutState.discount = 0;
  } else if (couponData.min_plan && checkoutState.plan.duration < couponData.min_plan) {
    msgEl.innerHTML = '<span class="coupon-error">This coupon requires a ' + couponData.min_plan + '-month plan or longer</span>';
    checkoutState.coupon = null;
    checkoutState.discount = 0;
  } else {
    var base = checkoutState.plan.price * checkoutState.plan.duration;
    if (couponData.discount_percent) checkoutState.discount = Math.round(base * couponData.discount_percent / 100);
    else if (couponData.discount_amount) checkoutState.discount = couponData.discount_amount;
    checkoutState.coupon = code;
    msgEl.innerHTML = '<span class="coupon-success">Coupon applied! You save &#8377;' + checkoutState.discount.toLocaleString() + '</span>';
  }
  updateCheckoutPricing();
}

function renderCheckoutFinalSummary() {
  var plan = checkoutState.plan;
  var user = {};
  var form = document.getElementById('checkoutForm');
  if (form) { new FormData(form).forEach(function(v, k) { user[k] = v; }); }
  var base = plan.price * plan.duration;
  var total = base - checkoutState.discount;
  var el = document.querySelector('.checkout-final-summary');
  if (!el) return;
  var html = '<div class="final-summary">';
  html += '<div class="summary-row"><span>Plan</span><span>' + plan.name + ' (' + plan.duration + 'mo)</span></div>';
  html += '<div class="summary-row"><span>Name</span><span>' + (user.name || '-') + '</span></div>';
  html += '<div class="summary-row"><span>Email</span><span>' + (user.email || '-') + '</span></div>';
  html += '<div class="summary-row"><span>Phone</span><span>' + (user.phone || '-') + '</span></div>';
  if (checkoutState.discount > 0) html += '<div class="summary-row discount"><span>Discount</span><span>-&#8377;' + checkoutState.discount.toLocaleString() + '</span></div>';
  html += '<div class="summary-row total"><span>Total</span><span>&#8377;' + total.toLocaleString() + '</span></div></div>';
  el.innerHTML = html;
}

function initiateRazorpayPayment() {
  var plan = checkoutState.plan;
  var total = (plan.price * plan.duration) - checkoutState.discount;
  if (typeof Razorpay !== 'undefined') {
    var form = document.getElementById('checkoutForm');
    var userData = {};
    if (form) new FormData(form).forEach(function(v, k) { userData[k] = v; });
    var payBtn = document.querySelector('.checkout-pay-btn');
    if (payBtn && payBtn.disabled) return;
    if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'Processing...'; }
    var options = {
      key: 'rzp_test_placeholder',
      amount: total * 100,
      currency: 'INR',
      name: 'Zacson Fitness',
      description: plan.name + ' Membership',
      handler: function() {
        document.querySelectorAll('.checkout-step-content').forEach(function(el) { el.style.display = 'none'; });
        document.getElementById('checkoutSuccess').style.display = 'block';
        document.getElementById('checkoutSuccessMsg').textContent = 'Payment successful! Welcome to Zacson Fitness.';
        trackEvent('purchase_completed', {plan_name: plan.name, value: total});
        showToast('Welcome to Zacson Fitness!', 'success');
      },
      prefill: {name: userData.name, email: userData.email, contact: userData.phone},
      theme: {color: '#FF0000'},
      modal: {ondismiss: function() { if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Pay Now'; } showToast('Payment cancelled.', 'error'); }}
    };
    try { new Razorpay(options).open(); } catch(err) { if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Pay Now'; } showToast('Payment error. Please try again.', 'error'); }
  } else {
    document.querySelectorAll('.checkout-step-content').forEach(function(el) { el.style.display = 'none'; });
    document.getElementById('checkoutSuccess').style.display = 'block';
    document.getElementById('checkoutSuccessMsg').textContent = 'Demo mode: Payment simulated successfully! Welcome to Zacson Fitness.';
    document.getElementById('checkoutInvoiceNum').textContent = 'Invoice: ZAC-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);
    trackEvent('purchase_completed', {plan_name: plan.name, value: total});
    showToast('Welcome to Zacson Fitness!', 'success');
  }
}


function loadTrainers() {
  var container = document.getElementById('trainers-container');
  if (!container) return;
  apiGet('/trainers').then(function(trainers) {
    if (!trainers || !trainers.length) return;
    container.innerHTML = trainers.map(function(t) {
      var specs = Array.isArray(t.specializations) ? t.specializations : [];
      return '<div class="col-lg-4 col-md-6"><div class="team-member text-center mb-30">' +
        '<div class="team-img"><img src="' + t.photo + '" alt="' + t.name + '" loading="lazy" onerror="this.src=\'assets/img/trainers/trainer1.jpg\'"></div>' +
        '<div class="team-info"><h4><a href="javascript:void(0)" onclick="showTrainerProfile(\'' + t.slug + '\')">' + t.name + '</a></h4>' +
        '<span>' + t.designation + '</span>' +
        '<p>' + t.experience_years + ' years experience</p>' +
        '<div class="team-social">' +
        '<a href="#" aria-label="Instagram"><i class="fab fa-instagram"></i></a>' +
        '<a href="#" aria-label="Twitter"><i class="fab fa-twitter"></i></a>' +
        '<a href="#" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>' +
        '</div></div></div></div>';
    }).join('');
  });
}

function showTrainerProfile(slug) {
  var trainer = null;
  _localData.trainers.forEach(function(t) { if (t.slug === slug) trainer = t; });
  if (!trainer) return;
  var modal = document.getElementById('trainerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'trainerModal';
    modal.className = 'trainer-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Trainer profile');
    modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
    document.body.appendChild(modal);
  }
  var specs = trainer.specializations.map(function(s) { return '<span class="spec-tag">' + s + '</span>'; }).join('');
  var certs = trainer.certifications.map(function(c) { return '<span class="cert-tag"><i class="fas fa-certificate"></i> ' + c + '</span>'; }).join('');
  modal.innerHTML = '<div class="trainer-modal">' +
    '<button class="trainer-modal-close" onclick="document.getElementById(\'trainerModal\').style.display=\'none\'">&times;</button>' +
    '<div class="trainer-modal-content">' +
    '<div class="trainer-modal-img"><img src="' + trainer.photo + '" alt="' + trainer.name + '" onerror="this.src=\'assets/img/trainers/trainer1.jpg\'"></div>' +
    '<div class="trainer-modal-info"><h2>' + trainer.name + '</h2>' +
    '<span class="trainer-designation">' + trainer.designation + '</span>' +
    '<p class="trainer-bio">' + trainer.bio + '</p>' +
    '<div class="trainer-specs"><h4>Specializations</h4>' + specs + '</div>' +
    '<div class="trainer-certs"><h4>Certifications</h4>' + certs + '</div>' +
    '<div class="trainer-stats"><div class="stat"><strong>' + trainer.experience_years + '</strong><span>Years Exp</span></div></div>' +
    '<a href="javascript:void(0)" onclick="openWhatsApp(\'Hi! I would like to book a consultation with ' + trainer.name + '.\')" class="btn-book-trainer">Book Consultation</a>' +
    '</div></div></div>';
  modal.style.display = 'flex';
}

function loadTestimonials() {
  var container = document.getElementById('testimonials-container');
  if (!container) return;
  apiGet('/testimonials').then(function(testimonials) {
    if (!testimonials || !testimonials.length) return;
    container.innerHTML = testimonials.map(function(t) {
      var stars = '';
      for (var i = 0; i < t.rating; i++) stars += '<i class="fas fa-star"></i>';
      return '<div class="col-lg-4 col-md-6"><div class="testimonail-item mb-30">' +
        '<div class="testimonail-cap"><p>' + t.testimonial + '</p>' +
        '<div class="rating">' + stars + '</div>' +
        '<div class="testimonail-name"><h4>' + t.name + '</h4><span>Zacson Fitness Member</span></div>' +
        '</div></div></div>';
    }).join('');
  });
}

function loadBlogPosts() {
  var container = document.getElementById('blog-container');
  if (!container) return;
  apiGet('/blog?limit=6').then(function(data) {
    var posts = data && data.posts ? data.posts : (Array.isArray(data) ? data : []);
    if (!posts.length) return;
    container.innerHTML = posts.slice(0, 6).map(function(p) {
      var date = p.published_at ? new Date(p.published_at) : new Date();
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '<div class="col-xl-4 col-lg-4 col-md-6"><div class="home-blog-single mb-30">' +
        '<div class="blog-img"><img src="' + (p.featured_image || 'assets/img/gallery/gallery1.png') + '" alt="' + p.title + '" loading="lazy"></div>' +
        '<div class="blog-cap"><span>' + p.category + '</span>' +
        '<h3><a href="blog_details.html?slug=' + p.slug + '">' + p.title + '</a></h3>' +
        '<span class="blog-date">' + months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + '</span>' +
        '</div></div></div>';
    }).join('');
  });
}

function loadFacilities() {
  var container = document.getElementById('facilities-container');
  if (!container) return;
  apiGet('/facilities').then(function(facilities) {
    if (!facilities || !facilities.length) return;
    container.innerHTML = facilities.map(function(f) {
      return '<div class="col-lg-3 col-md-4 col-sm-6"><div class="single-facility mb-30">' +
        '<div class="facility-icon"><i class="fas fa-' + (f.icon || 'star') + '"></i></div>' +
        '<h3>' + f.name + '</h3>' +
        '<p>' + f.description + '</p>' +
        '</div></div>';
    }).join('');
  });
}

function loadGallery() {
  var container = document.getElementById('gallery-container');
  if (!container) return;
  apiGet('/gallery').then(function(gallery) {
    if (!gallery || !gallery.length) return;
    container.innerHTML = gallery.map(function(g) {
      return '<div class="col-xl-3 col-lg-4 col-md-6 col-sm-6 gallery-item" data-category="' + g.category + '">' +
        '<div class="box snake mb-30">' +
        '<div class="gallery-img big-img" style="background-image:url(' + g.image + ');"></div>' +
        '<div class="overlay"><div class="overlay-content"><h3>' + g.title + '</h3>' +
        '<a href="' + g.image + '" class="gallery-popup lightbox-link"><i class="ti-plus"></i></a>' +
        '</div></div></div></div>';
    }).join('');
    initGalleryFilter();
    initLightbox();
  });
}

function initGalleryFilter() {
  var filterBtns = document.querySelectorAll('.gallery-filter-btn');
  var items = document.querySelectorAll('.gallery-item');
  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var filter = this.dataset.filter;
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      items.forEach(function(item) {
        item.style.display = (filter === 'all' || item.dataset.category === filter) ? '' : 'none';
      });
    });
  });
}

function initLightbox() {
  var links = document.querySelectorAll('.gallery-popup, .lightbox-link');
  var images = [];
  links.forEach(function(link) { images.push({src: link.getAttribute('href'), title: ''}); });
  links.forEach(function(link, idx) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      showLightbox(images, idx);
    });
  });
}

function showLightbox(images, startIndex) {
  var overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image gallery lightbox');
  overlay.innerHTML = '<button class="lightbox-close" aria-label="Close">&times;</button>' +
    '<button class="lightbox-nav lightbox-prev" aria-label="Previous">&#10094;</button>' +
    '<button class="lightbox-nav lightbox-next" aria-label="Next">&#10095;</button>' +
    '<img src="' + images[startIndex].src + '" alt="Gallery image">';
  document.body.appendChild(overlay);
  var imgEl = overlay.querySelector('img');
  var current = startIndex;
  function goTo(i) {
    current = (i + images.length) % images.length;
    imgEl.src = images[current].src;
  }
  overlay.querySelector('.lightbox-close').onclick = function() { overlay.remove(); document.onkeydown = null; };
  overlay.querySelector('.lightbox-prev').onclick = function() { goTo(current - 1); };
  overlay.querySelector('.lightbox-next').onclick = function() { goTo(current + 1); };
  overlay.onclick = function(ev) { if (ev.target === overlay) { overlay.remove(); document.onkeydown = null; } };
  document.onkeydown = function(e) {
    if (e.key === 'Escape') { overlay.remove(); document.onkeydown = null; return; }
    if (e.key === 'ArrowLeft') goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
    if (e.key === 'Tab') {
      var btns = overlay.querySelectorAll('button');
      var first = btns[0], last = btns[btns.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  overlay.querySelector('.lightbox-close').focus();
}


function parseTimeTo24(timeStr) {
  var match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return parseInt(timeStr) || 0;
  var h = parseInt(match[1]);
  var ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h;
}
function loadClassSchedule() {
  var scheduleBody = document.getElementById('schedule-body');
  if (!scheduleBody) return;
  apiGet('/classes/schedule').then(function(schedules) {
    if (!schedules || !schedules.length) return;
    var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    var timeSlots = [
      {label:'Early Morning',filter:function(s){var t=parseTimeTo24(s.time); return t>=5 && t<9;}},
      {label:'Morning',filter:function(s){var t=parseTimeTo24(s.time); return t>=9 && t<12;}},
      {label:'Afternoon',filter:function(s){var t=parseTimeTo24(s.time); return t>=12 && t<17;}},
      {label:'Evening',filter:function(s){var t=parseTimeTo24(s.time); return t>=17;}}
    ];
    var html = '';
    timeSlots.forEach(function(slot) {
      var hasClasses = days.some(function(d) {
        return schedules.some(function(s) { return s.day === d && slot.filter(s); });
      });
      if (!hasClasses) return;
      html += '<tr><td class="time-label">' + slot.label + '</td>';
      days.forEach(function(d) {
        var dayClasses = schedules.filter(function(s) { return s.day === d && slot.filter(s); });
        html += '<td>' + dayClasses.map(function(c) {
          return '<div class="schedule-item"><strong>' + c.class_name + '</strong><br><small>' + c.time + '</small><br><span class="trainer-name">' + (c.trainer_name || '') + '</span></div>';
        }).join('') + '</td>';
      });
      html += '</tr>';
    });
    scheduleBody.innerHTML = html;
  });
}

function loadClassesList() {
  var container = document.getElementById('classes-list');
  if (!container) return;
  var loading = document.getElementById('classes-loading');
  if (loading) loading.style.display = 'none';
  apiGet('/classes').then(function(classes) {
    if (!classes || !classes.length) return;
    var diffColors = {beginner:'#27ae60',intermediate:'#f39c12',advanced:'#e74c3c','all-levels':'#3498db'};
    container.innerHTML = classes.map(function(c) {
      return '<div class="col-lg-4 col-md-6"><div class="single-class mb-30">' +
        '<div class="class-img"><img src="' + (c.image || 'assets/img/classes/yoga.jpg') + '" alt="' + c.name + '" loading="lazy" onerror="this.src=\'assets/img/classes/yoga.jpg\'"></div>' +
        '<div class="class-content"><span class="difficulty-badge" style="background:' + (diffColors[c.difficulty] || '#3498db') + '">' + (c.difficulty || 'all-levels') + '</span>' +
        '<h3>' + c.name + '</h3><p>' + (c.description || '') + '</p>' +
        '<div class="class-meta"><span><i class="fas fa-clock"></i> ' + c.duration_minutes + ' min</span>' +
        '<span><i class="fas fa-users"></i> Max ' + c.max_participants + '</span></div>' +
        '<a href="javascript:void(0)" onclick="openWhatsApp(\'Hi! I would like to join the ' + c.name + ' class.\')" class="border-btn border-btn2">Enquire Now</a>' +
        '</div></div></div>';
    }).join('');
  });
}

function loadTransformations() {
  var container = document.getElementById('transformations-container');
  if (!container) return;
  apiGet('/transformations').then(function(data) {
    var items = Array.isArray(data) ? data : [];
    if (!items.length) return;
    container.innerHTML = items.map(function(t) {
      return '<div class="col-lg-4 col-md-6"><div class="transformation-card mb-30">' +
        '<div class="before-after">' +
        '<div class="ba-img"><img src="' + (t.before_image || '') + '" alt="Before" loading="lazy"><span class="ba-label">Before</span></div>' +
        '<div class="ba-img"><img src="' + (t.after_image || '') + '" alt="After" loading="lazy"><span class="ba-label">After</span></div>' +
        '</div><div class="transformation-info"><h4>' + t.name + '</h4>' +
        '<div class="trans-stats"><span>' + t.goal + '</span><span>' + t.duration + '</span><span>' + t.start_weight + ' &#8594; ' + t.end_weight + '</span></div>' +
        '<p>' + (t.story || '') + '</p></div></div></div>';
    }).join('');
  });
}

function handleContactForm() {
  var form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var name = form.querySelector('[name="name"]').value.trim();
    var email = form.querySelector('[name="email"]').value.trim();
    var message = form.querySelector('[name="message"]').value.trim();
    if (!name) { showToast('Please enter your name.', 'error'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email address.', 'error'); return; }
    if (!message) { showToast('Please enter your message.', 'error'); return; }
    var btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    var data = {
      name: name,
      email: email,
      phone: form.querySelector('[name="phone"]') ? form.querySelector('[name="phone"]').value.trim() : '',
      subject: form.querySelector('[name="subject"]') ? form.querySelector('[name="subject"]').value.trim() : '',
      message: message
    };
    apiPost('/contact/submit', data).then(function(result) {
      if (result.error) { showToast(result.error, 'error'); }
      else { showToast(result.message || 'Message sent successfully!', 'success'); form.reset(); trackEvent('lead_generated', {source:'contact_form'}); }
      if (btn) { btn.disabled = false; btn.textContent = 'Send Message'; }
    });
  });
}

function handleFreeTrialForm() {
  var form = document.getElementById('freeTrialForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
    var data = {
      name: form.querySelector('[name="name"]').value,
      phone: form.querySelector('[name="phone"]').value,
      email: form.querySelector('[name="email"]').value,
      fitness_goal: form.querySelector('[name="fitness_goal"]') ? form.querySelector('[name="fitness_goal"]').value : '',
      preferred_date: form.querySelector('[name="preferred_date"]') ? form.querySelector('[name="preferred_date"]').value : '',
      preferred_time: form.querySelector('[name="preferred_time"]') ? form.querySelector('[name="preferred_time"]').value : '',
      message: form.querySelector('[name="message"]') ? form.querySelector('[name="message"]').value : ''
    };
    apiPost('/contact/free-trial', data).then(function(result) {
      if (result.error) { showToast(result.error, 'error'); }
      else {
        showToast('Your free trial request has been received! We will contact you within 24 hours.', 'success');
        form.reset();
        trackEvent('lead_generated', {source:'free_trial'});
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Book Free Trial'; }
    });
  });
}

function initBMICalculator() {
  var form = document.getElementById('bmi-form');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var height = parseFloat(form.querySelector('[name="height"]').value);
    var weight = parseFloat(form.querySelector('[name="weight"]').value);
    var resultEl = document.getElementById('bmi-result');
    if (!height || !weight || height <= 0 || weight <= 0) {
      if (resultEl) { resultEl.style.display = 'block'; resultEl.innerHTML = '<p style="color:#e74c3c;">Please enter valid height and weight values.</p>'; }
      return;
    }
    var heightM = height / 100;
    var bmi = weight / (heightM * heightM);
    var category = '';
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi < 25) category = 'Normal Weight';
    else if (bmi < 30) category = 'Overweight';
    else category = 'Obese';
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = '<h4>' + bmi.toFixed(1) + '</h4><p><strong>' + category + '</strong></p><p>Your BMI indicates you are in the ' + category.toLowerCase() + ' range. Consult a healthcare professional for personalized advice.</p>';
    }
  });
}

function initCalorieCalculator() {
  var form = document.getElementById('calorie-form');
  if (!form) return;
  var activityMap = {sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9};
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var age = parseInt(form.querySelector('[name="age"]').value);
    var sex = form.querySelector('[name="sex"]').value;
    var height = parseFloat(form.querySelector('[name="height"]').value);
    var weight = parseFloat(form.querySelector('[name="weight"]').value);
    var activityVal = form.querySelector('[name="activity_level"]').value;
    var activity = activityMap[activityVal] || 1.2;
    var goal = form.querySelector('[name="goal"]').value;
    var resultEl = document.getElementById('cal-result');
    if (!age || !sex || !height || !weight || age <= 0 || height <= 0 || weight <= 0) {
      if (resultEl) { resultEl.style.display = 'block'; resultEl.innerHTML = '<p style="color:#e74c3c;">Please fill all fields with valid values.</p>'; }
      return;
    }
    var bmr;
    if (sex === 'male') bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    else bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    var tdee = Math.round(bmr * activity);
    var goalCalories = tdee;
    if (goal === 'lose') goalCalories = Math.round(tdee - 500);
    else if (goal === 'gain') goalCalories = Math.round(tdee + 300);
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = '<h4>' + goalCalories.toLocaleString() + ' kcal/day</h4>' +
        '<p><strong>Estimated Daily Calories:</strong> ' + tdee.toLocaleString() + ' kcal</p>' +
        '<p><strong>Goal-Based Calories:</strong> ' + goalCalories.toLocaleString() + ' kcal</p>' +
        '<p style="font-size:12px;color:#888;margin-top:10px;">This is an estimate. Consult a nutritionist for a personalized plan.</p>';
    }
  });
}


document.addEventListener('DOMContentLoaded', function() {
  initNavbar();
  initWhatsAppBtn();
  initBackToTop();
  setActiveNav();
  loadMembershipPlans();
  loadTrainers();
  loadTestimonials();
  loadBlogPosts();
  loadBlogDetail();
  loadFacilities();
  loadGallery();
  loadClassSchedule();
  loadClassesList();
  loadTransformations();
  handleContactForm();
  handleFreeTrialForm();
  initBMICalculator();
  initCalorieCalculator();
  initBlogPage();
});

function loadBlogDetail() {
  var container = document.getElementById('blog-detail-container');
  if (!container) return;
  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) { var pp = window.location.pathname.split('/'); slug = pp[pp.length - 1] || pp[pp.length - 2]; }
  if (!slug) { container.innerHTML = '<p>Article not found.</p>'; return; }
  var post = null;
  _localData.blogPosts.forEach(function(p) { if (p.slug === slug) post = p; });
  if (!post) { container.innerHTML = '<p>Article not found.</p>'; return; }
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var date = new Date();
  container.innerHTML = '<div class="blog-detail-header"><span class="blog-category">' + post.category + '</span>' +
    '<h1>' + post.title + '</h1>' +
    '<div class="blog-meta"><span><i class="fas fa-user"></i> Zacson Fitness Team</span>' +
    '<span><i class="fas fa-calendar"></i> ' + months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + '</span>' +
    '<span><i class="fas fa-clock"></i> ' + post.read_time + ' min read</span></div></div>' +
    (post.featured_image ? '<div class="blog-detail-img"><img src="' + post.featured_image + '" alt="' + post.title + '"></div>' : '') +
    '<div class="blog-detail-content">' + post.content + '</div>';
}

function initBlogPage() {
  var container = document.getElementById('blog-container');
  if (!container) return;
  var loading = document.getElementById('blog-loading');
  if (loading) loading.style.display = 'none';
  var posts = _localData.blogPosts;
  var categories = ['All'];
  posts.forEach(function(p) { if (categories.indexOf(p.category) < 0) categories.push(p.category); });
  var searchInput = document.getElementById('blog-search-input');
  var catContainer = document.getElementById('blog-categories');
  var recentContainer = document.getElementById('recent-posts-container');

  function renderPosts(filter, search) {
    var filtered = posts;
    if (filter && filter !== 'All') filtered = posts.filter(function(p) { return p.category === filter; });
    if (search) {
      var q = search.toLowerCase();
      filtered = filtered.filter(function(p) { return p.title.toLowerCase().indexOf(q) >= 0 || p.excerpt.toLowerCase().indexOf(q) >= 0 || p.category.toLowerCase().indexOf(q) >= 0; });
    }
    if (!filtered.length) { container.innerHTML = '<div class="col-12 text-center"><p style="color:#666;padding:40px;">No articles found.</p></div>'; return; }
    container.innerHTML = filtered.map(function(p) {
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var d = new Date();
      return '<div class="col-lg-6 col-md-6"><div class="blog-card mb-30">' +
        '<div class="blog-card-img"><img src="' + (p.featured_image || 'assets/img/gallery/gallery1.png') + '" alt="' + p.title + '" loading="lazy"></div>' +
        '<div class="blog-card-body"><span class="blog-cat">' + p.category + '</span>' +
        '<h3><a href="blog_details.html?slug=' + p.slug + '">' + p.title + '</a></h3>' +
        '<p class="blog-excerpt">' + p.excerpt + '</p>' +
        '<div class="blog-meta-info"><span><i class="fas fa-calendar"></i> ' + months[d.getMonth()] + ' ' + d.getDate() + '</span>' +
        '<span><i class="fas fa-clock"></i> ' + p.read_time + ' min</span></div>' +
        '<a href="blog_details.html?slug=' + p.slug + '" class="read-more">Read More <i class="fas fa-arrow-right"></i></a>' +
        '</div></div></div>';
    }).join('');
  }

  function renderRecent() {
    if (!recentContainer) return;
    recentContainer.innerHTML = posts.slice(0, 4).map(function(p) {
      return '<div class="media mb-30"><div class="media-left"><img src="' + (p.featured_image || 'assets/img/gallery/gallery1.png') + '" alt="' + p.title + '" style="width:70px;height:70px;object-fit:cover;border-radius:8px;"></div><div class="media-body"><a href="blog_details.html?slug=' + p.slug + '"><h4 style="color:#fff;font-size:14px;margin:0;">' + p.title + '</h4></a><p style="color:#888;font-size:12px;margin:0;">' + p.category + '</p></div></div>';
    }).join('');
  }

  if (catContainer) {
    var catHtml = '<li class="cat-item cat-item-1 active"><a href="javascript:void(0)" data-cat="All">All</a></li>';
    categories.slice(1).forEach(function(c) {
      catHtml += '<li class="cat-item"><a href="javascript:void(0)" data-cat="' + c + '">' + c + '</a></li>';
    });
    catContainer.innerHTML = catHtml;
    catContainer.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        catContainer.querySelectorAll('li').forEach(function(li) { li.classList.remove('active'); });
        this.parentElement.classList.add('active');
        renderPosts(this.dataset.cat, searchInput ? searchInput.value : '');
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var activeCat = catContainer ? catContainer.querySelector('.active a') : null;
      renderPosts(activeCat ? activeCat.dataset.cat : 'All', this.value);
    });
  }

  renderRecent();
  renderPosts('All', '');
}

