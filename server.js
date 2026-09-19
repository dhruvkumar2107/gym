const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { initDatabase } = require('./database/db');
const { createTables } = require('./database/schema');
const { seedData } = require('./database/seed');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const membershipRoutes = require('./routes/membership');
const contactRoutes = require('./routes/contact');
const blogRoutes = require('./routes/blog');
const trainerRoutes = require('./routes/trainers');
const galleryRoutes = require('./routes/gallery');
const testimonialRoutes = require('./routes/testimonials');
const faqRoutes = require('./routes/faq');
const leadRoutes = require('./routes/leads');
const classRoutes = require('./routes/classes');
const facilityRoutes = require('./routes/facilities');
const transformationRoutes = require('./routes/transformations');
const offerRoutes = require('./routes/offers');
const locationRoutes = require('./routes/locations');
const calculatorRoutes = require('./routes/calculators');
const workoutRoutes = require('./routes/workouts');
const notificationRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');

async function start() {
  await initDatabase();
  createTables();
  seedData();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
  app.use('/api/', limiter);

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  app.use('/assets', express.static(path.join(__dirname, 'assets')));
  app.use('/admin', express.static(path.join(__dirname, 'admin')));
  app.use('/robots.txt', express.static(path.join(__dirname, 'robots.txt')));
  app.use('/sitemap.xml', express.static(path.join(__dirname, 'sitemap.xml')));

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/membership', membershipRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/blog', blogRoutes);
  app.use('/api/trainers', trainerRoutes);
  app.use('/api/gallery', galleryRoutes);
  app.use('/api/testimonials', testimonialRoutes);
  app.use('/api/faq', faqRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/facilities', facilityRoutes);
  app.use('/api/transformations', transformationRoutes);
  app.use('/api/offers', offerRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/calculators', calculatorRoutes);
  app.use('/api/workouts', workoutRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/payment', paymentRoutes);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', brand: 'Zacson Fitness' }));

  // Razorpay webhook needs raw body - must be before json middleware, but we handle it via the payment route

  // Clean SEO URLs: /blog/:slug, /trainers/:slug
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

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    const htmlPath = path.join(__dirname, req.path.endsWith('.html') ? req.path : req.path + '.html');
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
    const cleanPath = path.join(__dirname, path.basename(req.path) + '.html');
    if (fs.existsSync(cleanPath)) {
      return res.sendFile(cleanPath);
    }
    res.status(404).sendFile(path.join(__dirname, '404.html'));
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`Zacson Fitness server running at http://localhost:${PORT}`);
  });
}

start().catch(console.error);
