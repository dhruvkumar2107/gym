const API = '/api';
async function apiGet(path) {
  try {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error('Request failed');
    return await res.json();
  } catch (e) { console.error('API Error:', e); return null; }
}
async function apiPost(path, data) {
  try {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) { console.error('API Error:', e); return { error: 'Network error' }; }
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
    toast.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:9999;padding:15px 30px;border-radius:8px;color:#fff;font-size:14px;display:none;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    document.body.appendChild(toast);
  }
  toast.style.background = type === 'error' ? '#e74c3c' : '#27ae60';
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 4000);
}
function trackEvent(eventName, params) {
  params = params || {};
  if (typeof gtag === 'function') { gtag('event', eventName, params); }
  if (typeof fbq === 'function') {
    var pixelMap = { lead_generated: 'Lead', checkout_initiated: 'InitiateCheckout', purchase_completed: 'Purchase', whatsapp_click: 'Contact' };
    if (pixelMap[eventName]) fbq('track', pixelMap[eventName], params);
  }
}
async function loadMembershipPlans() {
  var container = document.getElementById('plans-container');
  if (!container) return;
  var plans = await apiGet('/membership/plans');
  if (!plans) return;
  container.innerHTML = plans.map(function(p) {
    var features = Array.isArray(p.features) ? p.features : (typeof p.features === 'string' ? JSON.parse(p.features) : []);
    var total = p.price * p.duration_months;
    return '<div class="col-lg-4 col-md-6 col-sm-6"><div class="properties mb-30 ' + (p.is_popular ? 'popular-plan' : '') + '">' +
      (p.is_popular ? '<div class="popular-badge">Most Popular</div>' : '') +
      '<div class="properties__card"><div class="properties__caption">' +
      '<span class="month">' + p.duration_months + (p.duration_months === 1 ? ' month' : ' months') + '</span>' +
      '<p class="mb-25 plan-price">&#8377;' + p.price.toLocaleString() + '/mo' +
      (p.duration_months > 1 ? ' <span class="plan-total">(&#8377;' + total.toLocaleString() + ' total)</span>' : '') +
      (p.original_price ? ' <span class="original-price">&#8377;' + (p.original_price * p.duration_months).toLocaleString() + '</span>' : '') +
      '</p>' +
      features.map(function(f) { return '<div class="single-features"><div class="features-icon"><i class="fas fa-check"></i></div><div class="features-caption"><p>' + f + '</p></div></div>'; }).join('') +
      '<a href="javascript:void(0)" class="border-btn border-btn2 plan-join-btn" data-plan-id="' + p.id + '" data-plan-name="' + p.name + '" data-plan-price="' + p.price + '" data-plan-duration="' + p.duration_months + '">Join Now</a>' +
      '</div></div></div></div>';
  }).join('');
  container.querySelectorAll('.plan-join-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openCheckoutModal({ id: this.dataset.planId, name: this.dataset.planName, price: parseInt(this.dataset.planPrice), duration: parseInt(this.dataset.planDuration) });
    });
  });
}
var checkoutState = { plan: null, coupon: null, discount: 0 };
function openCheckoutModal(plan) {
  checkoutState = { plan: plan, coupon: null, discount: 0 };
  trackEvent('checkout_initiated', { plan_name: plan.name, value: plan.price * plan.duration });
  var modal = document.getElementById('checkoutModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'checkoutModal';
    modal.innerHTML = '<div class="checkout-overlay" onclick="closeCheckoutModal()"></div><div class="checkout-dialog"><div class="checkout-header"><h3>Join Zacson Fitness</h3><button class="checkout-close" onclick="closeCheckoutModal()">&times;</button></div><div class="checkout-body"><div class="checkout-steps"><div class="step active" data-step="1"><span>1</span> Plan</div><div class="step" data-step="2"><span>2</span> Details</div><div class="step" data-step="3"><span>3</span> Payment</div></div><div id="checkoutStep1" class="checkout-step-content"><div class="checkout-plan-summary"></div><div class="checkout-coupon"><input type="text" id="couponInput" placeholder="Enter coupon code (e.g. WELCOME10)"><button onclick="applyCoupon()" class="btn-coupon">Apply</button></div><div id="couponMessage" class="coupon-message"></div><div class="checkout-pricing"></div><button class="checkout-next-btn" onclick="checkoutGoStep(2)">Continue</button></div><div id="checkoutStep2" class="checkout-step-content" style="display:none"><form id="checkoutForm"><div class="form-group"><label>Full Name *</label><input type="text" name="name" required class="form-control" placeholder="Your full name"></div><div class="form-group"><label>Email *</label><input type="email" name="email" required class="form-control" placeholder="your@email.com"></div><div class="form-group"><label>Phone *</label><input type="tel" name="phone" required class="form-control" placeholder="+91 98765 43210"></div><button type="button" class="checkout-back-btn" onclick="checkoutGoStep(1)">Back</button><button type="button" class="checkout-next-btn" onclick="checkoutGoStep(3)">Proceed to Payment</button></form></div><div id="checkoutStep3" class="checkout-step-content" style="display:none"><div class="checkout-final-summary"></div><div id="checkoutPaymentBtn" class="checkout-pay-btn">Pay with Razorpay</div><p class="checkout-secure"><i class="fas fa-lock"></i> Secured by Razorpay</p><button type="button" class="checkout-back-btn" onclick="checkoutGoStep(2)">Back</button></div><div id="checkoutSuccess" class="checkout-step-content" style="display:none;text-align:center;padding:40px 20px;"><div class="success-icon"><i class="fas fa-check-circle"></i></div><h3>Welcome to Zacson Fitness!</h3><p id="checkoutSuccessMsg"></p><p id="checkoutInvoiceNum" style="color:#c7a44e;font-weight:600;"></p><button class="checkout-next-btn" onclick="closeCheckoutModal()" style="margin-top:20px;">Done</button></div></div></div>';
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
  el.innerHTML = '<div class="plan-selected"><h4>' + plan.name + '</h4><p>' + plan.duration + ' month' + (plan.duration > 1 ? 's' : '') + ' &#8377;' + (plan.price * plan.duration).toLocaleString() + '</p></div>';
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
async function applyCoupon() {
  var code = document.getElementById('couponInput').value.trim();
  if (!code) return;
  var msgEl = document.getElementById('couponMessage');
  var result = await apiPost('/membership/validate-coupon', { code: code, plan_id: checkoutState.plan.id });
  if (result.error) {
    msgEl.innerHTML = '<span class="coupon-error">' + result.error + '</span>';
    checkoutState.coupon = null; checkoutState.discount = 0;
  } else {
    var base = checkoutState.plan.price * checkoutState.plan.duration;
    if (result.discount_percent > 0) checkoutState.discount = Math.round(base * result.discount_percent / 100);
    else checkoutState.discount = result.discount_amount || 0;
    checkoutState.coupon = result.code;
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
  el.innerHTML = '<div class="final-summary"><div class="summary-row"><span>Plan</span><span>' + plan.name + ' (' + plan.duration + 'mo)</span></div><div class="summary-row"><span>Name</span><span>' + (user.name || '') + '</span></div><div class="summary-row"><span>Email</span><span>' + (user.email || '') + '</span></div><div class="summary-row"><span>Phone</span><span>' + (user.phone || '') + '</span></div>' + (checkoutState.discount > 0 ? '<div class="summary-row discount"><span>Discount</span><span>-&#8377;' + checkoutState.discount.toLocaleString() + '</span></div>' : '') + '<div class="summary-row total"><span>Total</span><span>&#8377;' + total.toLocaleString() + '</span></div></div>';
  document.getElementById('checkoutPaymentBtn').onclick = function() { initiateRazorpayPayment(); };
}
async function initiateRazorpayPayment() {
  var plan = checkoutState.plan;
  var form = document.getElementById('checkoutForm');
  var userData = {};
  if (form) new FormData(form).forEach(function(v, k) { userData[k] = v; });
  var token = getToken();
  if (!token) {
    var regResult = await apiPost('/auth/register', { email: userData.email, password: 'zacson_' + Date.now(), full_name: userData.name, phone: userData.phone });
    if (regResult.token) { token = regResult.token; setToken(token); setUser(regResult.user || { email: userData.email, full_name: userData.name }); }
    else if (regResult.error && regResult.error.indexOf('already') >= 0) {
      var lr = await apiPost('/auth/login', { email: userData.email, password: userData.password || 'zacson_' + Date.now() });
      if (lr.token) { token = lr.token; setToken(token); setUser(lr.user || { email: userData.email, full_name: userData.name }); }
    }
    if (!token) { showToast('Please try again.', 'error'); return; }
  }
  var orderResult = await apiPost('/payment/create-order', { plan_id: plan.id, coupon_code: checkoutState.coupon });
  if (orderResult.error) { showToast(orderResult.error, 'error'); return; }
  var options = {
    key: orderResult.key_id, amount: orderResult.amount * 100, currency: 'INR',
    name: 'Zacson Fitness', description: plan.name + ' Membership', order_id: orderResult.order_id,
    handler: async function(response) {
      var vr = await apiPost('/payment/verify-payment', { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, plan_id: plan.id, coupon_code: checkoutState.coupon });
      if (vr.error) { showToast('Payment verification failed.', 'error'); }
      else {
        trackEvent('purchase_completed', { plan_name: plan.name, value: orderResult.amount });
        document.querySelectorAll('.checkout-step-content').forEach(function(el) { el.style.display = 'none'; });
        document.getElementById('checkoutSuccess').style.display = 'block';
        document.getElementById('checkoutSuccessMsg').textContent = vr.message;
        document.getElementById('checkoutInvoiceNum').textContent = 'Invoice: ' + vr.invoice_number;
        showToast('Welcome to Zacson Fitness!', 'success');
      }
    },
    prefill: { name: userData.name, email: userData.email, contact: userData.phone },
    theme: { color: '#c7a44e' },
    modal: { ondismiss: function() { showToast('Payment cancelled.', 'error'); } }
  };
  if (typeof Razorpay !== 'undefined') { new Razorpay(options).open(); }
  else {
    var s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = function() { new Razorpay(options).open(); };
    document.head.appendChild(s);
  }
}
async function loadTrainers() {
  var container = document.getElementById('trainers-container');
  if (!container) return;
  var trainers = await apiGet('/trainers');
  if (!trainers) return;
  container.innerHTML = trainers.map(function(t) {
    var specs = Array.isArray(t.specializations) ? t.specializations : (typeof t.specializations === 'string' ? JSON.parse(t.specializations) : []);
    return '<div class="col-lg-4 col-md-6"><div class="team-member text-center mb-30"><div class="team-img"><img src="' + t.photo + '" alt="' + t.name + '" onerror="this.src=\'assets/img/trainers/trainer1.jpg\'"></div><div class="team-info"><h4><a href="javascript:void(0)" onclick="showTrainerProfile(\'' + t.slug + '\')">' + t.name + '</a></h4><span>' + t.designation + '</span><p>' + t.experience_years + ' years experience</p><div class="team-social">' + (t.social_links.instagram && t.social_links.instagram !== '#' ? '<a href="' + t.social_links.instagram + '" target="_blank"><i class="fab fa-instagram"></i></a>' : '') + (t.social_links.twitter && t.social_links.twitter !== '#' ? '<a href="' + t.social_links.twitter + '" target="_blank"><i class="fab fa-twitter"></i></a>' : '') + (t.social_links.facebook && t.social_links.facebook !== '#' ? '<a href="' + t.social_links.facebook + '" target="_blank"><i class="fab fa-facebook-f"></i></a>' : '') + '</div></div></div></div>';
  }).join('');
}
async function showTrainerProfile(slug) {
  var trainer = await apiGet('/trainers/' + slug);
  if (!trainer) return;
  var specs = Array.isArray(trainer.specializations) ? trainer.specializations : JSON.parse(trainer.specializations || '[]');
  var certs = Array.isArray(trainer.certifications) ? trainer.certifications : JSON.parse(trainer.certifications || '[]');
  var modal = document.getElementById('trainerModal');
  if (!modal) {
    modal = document.createElement('div'); modal.id = 'trainerModal'; modal.className = 'trainer-modal-overlay';
    modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
    document.body.appendChild(modal);
  }
  modal.innerHTML = '<div class="trainer-modal"><button class="trainer-modal-close" onclick="document.getElementById(\'trainerModal\').style.display=\'none\'">&times;</button><div class="trainer-modal-content"><div class="trainer-modal-img"><img src="' + trainer.photo + '" alt="' + trainer.name + '" onerror="this.src=\'assets/img/trainers/trainer1.jpg\'"></div><div class="trainer-modal-info"><h2>' + trainer.name + '</h2><span class="trainer-designation">' + trainer.designation + '</span><p class="trainer-bio">' + (trainer.bio || '') + '</p><div class="trainer-specs"><h4>Specializations</h4>' + specs.map(function(s) { return '<span class="spec-tag">' + s + '</span>'; }).join('') + '</div><div class="trainer-certs"><h4>Certifications</h4>' + certs.map(function(c) { return '<span class="cert-tag"><i class="fas fa-certificate"></i> ' + c + '</span>'; }).join('') + '</div><div class="trainer-stats"><div class="stat"><strong>' + trainer.experience_years + '</strong><span>Years Exp</span></div></div><a href="javascript:void(0)" onclick="openWhatsApp(\'Hi! I would like to book a consultation with ' + trainer.name + '.\')" class="btn-book-trainer">Book Consultation</a></div></div></div>';
  modal.style.display = 'flex';
}
async function loadTestimonials() {
  var container = document.getElementById('testimonials-container');
  if (!container) return;
  var testimonials = await apiGet('/testimonials');
  if (!testimonials) return;
  container.innerHTML = testimonials.map(function(t) {
    var stars = Array(t.rating).fill('<i class="fas fa-star"></i>').join('');
    return '<div class="testimonail-item"><div class="testimonail-cap"><p>' + t.testimonial + '</p><div class="rating">' + stars + '</div><div class="testimonail-name"><h4>' + t.name + '</h4><span>Zacson Fitness Member</span></div></div></div>';
  }).join('');
}
async function loadBlogPosts() {
  var container = document.getElementById('blog-container');
  if (!container) return;
  var data = await apiGet('/blog?limit=6');
  if (!data || !data.posts) return;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  container.innerHTML = data.posts.map(function(p) {
    var date = p.published_at ? new Date(p.published_at) : new Date();
    return '<div class="col-xl-4 col-lg-4 col-md-6"><div class="home-blog-single mb-30"><div class="blog-img-cap"><div class="blog-img"><img src="' + (p.featured_image || 'assets/img/gallery/blog1.png') + '" alt="' + p.title + '"></div><div class="blog-cap"><span>' + p.category + '</span><h3><a href="/blog/' + p.slug + '">' + p.title + '</a></h3><span class="blog-date">' + months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + '</span></div></div></div></div>';
  }).join('');
}
async function loadBlogDetail() {
  var container = document.getElementById('blog-detail-container');
  if (!container) return;
  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) { var pp = window.location.pathname.split('/'); slug = pp[pp.length - 1] || pp[pp.length - 2]; }
  if (!slug) { container.innerHTML = '<p>Article not found.</p>'; return; }
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  var post = await apiGet('/blog/' + slug);
  if (!post || post.error) { container.innerHTML = '<p>Article not found.</p>'; return; }
  var date = post.published_at ? new Date(post.published_at) : new Date();
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var tags = Array.isArray(post.tags) ? post.tags : (typeof post.tags === 'string' ? JSON.parse(post.tags) : []);
  container.innerHTML = '<div class="blog-detail-header"><span class="blog-category">' + post.category + '</span><h1>' + post.title + '</h1><div class="blog-meta"><span><i class="fas fa-user"></i> Zacson Fitness Team</span><span><i class="fas fa-calendar"></i> ' + months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + '</span></div></div>' + (post.featured_image ? '<div class="blog-detail-img"><img src="' + post.featured_image + '" alt="' + post.title + '"></div>' : '') + '<div class="blog-detail-content">' + (post.content || '<p>' + (post.excerpt || '') + '</p>') + '</div>' + (tags.length ? '<div class="blog-tags">' + tags.map(function(t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</div>' : '');
}
async function loadFacilities() {
  var container = document.getElementById('facilities-container');
  if (!container) return;
  var facilities = await apiGet('/facilities');
  if (!facilities) return;
  container.innerHTML = facilities.map(function(f) {
    return '<div class="col-lg-4 col-md-6"><div class="single-facility mb-30"><div class="facility-icon"><i class="fas fa-' + (f.icon || 'star') + '"></i></div><h3>' + f.name + '</h3><p>' + f.description + '</p></div></div>';
  }).join('');
}
async function loadGallery() {
  var container = document.getElementById('gallery-container');
  if (!container) return;
  var gallery = await apiGet('/gallery');
  if (!gallery) return;
  container.innerHTML = gallery.map(function(g) {
    return '<div class="col-xl-4 col-lg-6 col-md-6 col-sm-6 gallery-item" data-category="' + g.category + '"><div class="box snake mb-30"><div class="gallery-img big-img" style="background-image: url(' + g.image + ');"></div><div class="overlay"><div class="overlay-content"><h3>' + g.title + '</h3><a href="' + g.image + '" class="gallery-popup lightbox-link"><i class="ti-plus"></i></a></div></div></div></div>';
  }).join('');
  initGalleryFilter();
  initLightbox();
}
function initLightbox() {
  document.querySelectorAll('.gallery-popup, .lightbox-link').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var img = this.getAttribute('href');
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:pointer;';
      overlay.innerHTML = '<img src="' + img + '" style="max-width:90%;max-height:90%;border-radius:8px;"><button style="position:absolute;top:20px;right:30px;background:none;border:none;color:#fff;font-size:30px;cursor:pointer;" onclick="this.parentElement.remove()">&times;</button>';
      overlay.onclick = function(ev) { if (ev.target === overlay) overlay.remove(); };
      document.body.appendChild(overlay);
    });
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
        item.style.display = (filter === 'all' || item.dataset.category === filter) ? 'block' : 'none';
      });
    });
  });
}
async function loadClassSchedule() {
  var container = document.getElementById('schedule-container');
  if (!container) return;
  var schedules = await apiGet('/classes/schedule');
  if (!schedules) return;
  var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var html = '<div class="schedule-table-wrap"><table class="table schedule-table"><thead><tr><th>Time</th>';
  days.forEach(function(d) { html += '<th>' + d.substring(0, 3) + '</th>'; });
  html += '</tr></thead><tbody>';
  var timeSlots = [
    { label: 'Morning', filter: function(s) { return parseInt(s.start_time) < 12; } },
    { label: 'Evening', filter: function(s) { return parseInt(s.start_time) >= 12; } }
  ];
  timeSlots.forEach(function(slot) {
    html += '<tr><td class="time-label">' + slot.label + '</td>';
    days.forEach(function(d) {
      var dayClasses = schedules.filter(function(s) { return s.day_of_week === d && slot.filter(s); });
      html += '<td>' + dayClasses.map(function(c) {
        return '<div class="schedule-item"><strong>' + c.class_name + '</strong><br><small>' + c.start_time + '-' + c.end_time + '</small><br><span class="trainer-name">' + (c.trainer_name || '') + '</span></div>';
      }).join('') + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}
async function loadClassesList() {
  var container = document.getElementById('classes-list');
  if (!container) return;
  var classes = await apiGet('/classes');
  if (!classes) return;
  var diffColors = { beginner: '#27ae60', intermediate: '#f39c12', advanced: '#e74c3c', 'all-levels': '#3498db' };
  container.innerHTML = classes.map(function(c) {
    return '<div class="col-lg-4 col-md-6"><div class="single-class mb-30"><div class="class-img"><img src="' + (c.image || 'assets/img/classes/yoga.jpg') + '" alt="' + c.name + '" onerror="this.src=\'assets/img/classes/yoga.jpg\'"></div><div class="class-content"><span class="difficulty-badge" style="background:' + (diffColors[c.difficulty] || '#3498db') + '">' + (c.difficulty || 'all-levels') + '</span><h3>' + c.name + '</h3><p>' + (c.description || '') + '</p><div class="class-meta"><span><i class="fas fa-clock"></i> ' + c.duration_minutes + ' min</span><span><i class="fas fa-users"></i> Max ' + c.max_participants + '</span></div><a href="javascript:void(0)" onclick="openWhatsApp(\'Hi! I would like to join the ' + c.name + ' class.\')" class="border-btn border-btn2">Enquire Now</a></div></div></div>';
  }).join('');
}
async function loadTransformations() {
  var container = document.getElementById('transformations-container');
  if (!container) return;
  var data = await apiGet('/transformations');
  if (!data || !data.length) { container.innerHTML = '<p class="text-center">No transformations yet.</p>'; return; }
  container.innerHTML = data.map(function(t) {
    return '<div class="col-lg-4 col-md-6"><div class="transformation-card mb-30"><div class="before-after"><div class="ba-img"><img src="' + (t.before_image || '') + '" alt="Before"><span class="ba-label">Before</span></div><div class="ba-img"><img src="' + (t.after_image || '') + '" alt="After"><span class="ba-label">After</span></div></div><div class="transformation-info"><h4>' + t.name + '</h4><div class="trans-stats"><span>' + t.duration + '</span><span>' + t.start_weight + ' &rarr; ' + t.end_weight + '</span></div><p>' + (t.story || '') + '</p></div></div></div>';
  }).join('');
}
function handleContactForm() {
  var form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var data = { name: form.querySelector('[name="name"]').value, email: form.querySelector('[name="email"]').value, phone: form.querySelector('[name="phone"]') ? form.querySelector('[name="phone"]').value : '', subject: form.querySelector('[name="subject"]') ? form.querySelector('[name="subject"]').value : '', message: form.querySelector('[name="message"]').value };
    var result = await apiPost('/contact/submit', data);
    if (result.error) { showToast(result.error, 'error'); } else { showToast(result.message, 'success'); form.reset(); trackEvent('lead_generated', { source: 'contact_form' }); }
  });
}
function handleFreeTrialForm() {
  var form = document.getElementById('freeTrialForm');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var data = { name: form.querySelector('[name="name"]').value, phone: form.querySelector('[name="phone"]').value, email: form.querySelector('[name="email"]').value, age: form.querySelector('[name="age"]') ? form.querySelector('[name="age"]').value : '', fitness_goal: form.querySelector('[name="fitness_goal"]') ? form.querySelector('[name="fitness_goal"]').value : '', preferred_date: form.querySelector('[name="preferred_date"]') ? form.querySelector('[name="preferred_date"]').value : '', preferred_time: form.querySelector('[name="preferred_time"]') ? form.querySelector('[name="preferred_time"]').value : '', message: form.querySelector('[name="message"]') ? form.querySelector('[name="message"]').value : '' };
    var result = await apiPost('/contact/free-trial', data);
    if (result.error) { showToast(result.error, 'error'); } else { showToast(result.message, 'success'); form.reset(); trackEvent('lead_generated', { source: 'free_trial' }); }
  });
}
function initWhatsAppBtn() {
  var fab = document.getElementById('whatsapp-fab');
  if (fab) return;
  fab = document.createElement('div');
  fab.id = 'whatsapp-fab';
  fab.innerHTML = '<a href="https://wa.me/919876543210?text=' + encodeURIComponent('Hi! I would like to know more about Zacson Fitness.') + '" target="_blank" style="position:fixed;bottom:30px;left:30px;z-index:9999;background:#25d366;color:#fff;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 4px 20px rgba(0,0,0,0.3);text-decoration:none;"><i class="fab fa-whatsapp"></i></a>';
  document.body.appendChild(fab);
}
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
}
document.addEventListener('DOMContentLoaded', function() {
  initWhatsAppBtn();
  initSmoothScroll();
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
});