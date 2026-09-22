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

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

if (!isVercel) {
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
}

// Ensure DB middleware for all API routes
const dbMiddleware = (req, res, next) => ensureDb().then(() => next()).catch(next);
app.use('/api/', dbMiddleware);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/member', require('./routes/member'));
app.use('/api/membership', require('./routes/membership'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/trainers', require('./routes/trainers'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/faq', require('./routes/faq'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/facilities', require('./routes/facilities'));
app.use('/api/transformations', require('./routes/transformations'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/calculators', require('./routes/calculators'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/payment', require('./routes/payment'));

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

// Portal routes - serve HTML for all portal pages
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'portal', 'index.html'));
});

app.get('/portal/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'portal', 'index.html'));
});

app.get('/trainer-portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'trainer-portal', 'index.html'));
});

app.get('/trainer-portal/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'trainer-portal', 'index.html'));
});

app.get('/reception-portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'reception-portal', 'index.html'));
});

app.get('/reception-portal/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'reception-portal', 'index.html'));
});

app.get('/sales-portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'sales-portal', 'index.html'));
});

app.get('/sales-portal/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'sales-portal', 'index.html'));
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const htmlPath = path.join(__dirname, req.path.endsWith('.html') ? req.path : req.path + '.html');
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  const cleanPath = path.join(__dirname, path.basename(req.path) + '.html');
  if (fs.existsSync(cleanPath)) return res.sendFile(cleanPath);
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

if (!isVercel) {
  ensureDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Zacson Fitness server running at http://localhost:${PORT}`);
      console.log(`Admin: http://localhost:${PORT}/admin/`);
      console.log(`Member Portal: http://localhost:${PORT}/portal/`);
    });
  }).catch(console.error);
}

module.exports = app;
