const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const { initDatabase } = require('./database/db');
const { createTables } = require('./database/schema');
const { seedData } = require('./database/seed');

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = !!process.env.VERCEL;

let dbReady = null;

function ensureDb() {
  if (!dbReady) {
    dbReady = (async () => {
      await initDatabase();
      createTables();
      seedData();
    })();
  }
  return dbReady;
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : true;
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Math.max(parseInt(process.env.API_RATE_LIMIT) || 500, 100) });
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/send-otp', authLimiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/portal', express.static(path.join(__dirname, 'portal')));
app.use('/trainer-portal', express.static(path.join(__dirname, 'trainer-portal')));
app.use('/reception-portal', express.static(path.join(__dirname, 'reception-portal')));
app.use('/sales-portal', express.static(path.join(__dirname, 'sales-portal')));
app.use('/site.webmanifest', express.static(path.join(__dirname, 'site.webmanifest')));
app.use('/robots.txt', express.static(path.join(__dirname, 'robots.txt')));
app.use('/sitemap.xml', express.static(path.join(__dirname, 'sitemap.xml')));

// Ensure DB middleware for all API routes
const dbMiddleware = (req, res, next) => ensureDb().then(() => next()).catch(next);
app.use('/api/', dbMiddleware);

function mountIfExists(mountPath, routeFilePath) {
  const full = path.join(__dirname, 'routes', routeFilePath);
  if (fs.existsSync(full)) {
    app.use(mountPath, require(full));
    return true;
  }
  return false;
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/member', require('./routes/member'));
app.use('/api/membership', require('./routes/membership'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/payment', require('./routes/payment'));

['trainers', 'gallery', 'testimonials', 'faq', 'classes', 'facilities', 'transformations', 'offers', 'locations', 'calculators', 'workouts'].forEach(name => {
  mountIfExists(`/api/${name}`, `${name}.js`);
});

mountIfExists('/api/hr', 'hr.js');
mountIfExists('/api/finance', 'finance.js');
mountIfExists('/api/inventory', 'inventory.js');
mountIfExists('/api/fitness', 'fitness.js');
mountIfExists('/api/crm', 'crm.js');
mountIfExists('/api/calendar', 'calendar.js');
mountIfExists('/api/automation', 'automation.js');
mountIfExists('/api/ai', 'ai.js');
mountIfExists('/api/support', 'support.js');
mountIfExists('/api/member-extra', 'member-extra.js');
mountIfExists('/api/notify-extra', 'notify-extra.js');

app.get('/api/health', (req, res) => res.json({ status: 'ok', brand: 'Zacson Fitness', version: '2.0.0' }));

// Static HTML routes
app.get('/blog/:slug', (req, res) => {
  const filePath = path.join(__dirname, 'blog_details.html');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.get('/trainers/:slug', (req, res) => {
  const filePath = path.join(__dirname, 'trainers.html');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

function serveHtml(route, file) {
  app.get(route, (req, res) => {
    const target = path.join(__dirname, file);
    if (fs.existsSync(target)) return res.sendFile(target);
    if (fs.existsSync(path.join(__dirname, '404.html'))) return res.status(404).sendFile(path.join(__dirname, '404.html'));
    res.status(404).send('<h1>404 Not Found</h1>');
  });
}

['/admin', '/admin/*'].forEach(r => serveHtml(r, 'admin/index.html'));
['/portal', '/portal/*'].forEach(r => serveHtml(r, 'portal/index.html'));
['/trainer-portal', '/trainer-portal/*'].forEach(r => serveHtml(r, 'trainer-portal/index.html'));
['/reception-portal', '/reception-portal/*'].forEach(r => serveHtml(r, 'reception-portal/index.html'));
['/sales-portal', '/sales-portal/*'].forEach(r => serveHtml(r, 'sales-portal/index.html'));

app.get('/', (req, res) => {
  const target = path.join(__dirname, 'index.html');
  if (fs.existsSync(target)) return res.sendFile(target);
  res.status(404).send('<h1>404 Not Found</h1>');
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const htmlPath = path.join(__dirname, req.path.endsWith('.html') ? req.path : req.path + '.html');
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  const cleanPath = path.join(__dirname, path.basename(req.path) + '.html');
  if (fs.existsSync(cleanPath)) return res.sendFile(cleanPath);
  if (fs.existsSync(path.join(__dirname, '404.html'))) return res.status(404).sendFile(path.join(__dirname, '404.html'));
  res.status(404).send('<h1>404 Not Found</h1>');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

if (!isVercel) {
  ensureDb().then(() => {
    try {
      const { startAutomationScheduler } = require('./routes/automation');
      if (typeof startAutomationScheduler === 'function') startAutomationScheduler();
    } catch (e) { /* scheduler unavailable */ }
    app.listen(PORT, () => {
      console.log(`Zacson Fitness server running at http://localhost:${PORT}`);
      console.log(`Admin: http://localhost:${PORT}/admin/`);
      console.log(`Member Portal: http://localhost:${PORT}/portal/`);
    });
  }).catch(console.error);
}

module.exports = app;