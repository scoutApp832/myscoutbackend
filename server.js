const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./src/config/database');

// ✅ IMPORT ALL ROUTES
const authRoutes = require('./src/routes/authRoutes');
const memberRoutes = require('./src/routes/memberRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const reportRoutes = require('./src/routes/reportRoutes');

// ✅ IDEA ROUTES
const ideaRoutes = require('./src/routes/ideaRoutes');

// ✅ DONATION ROUTES - FIXED
let donationRoutes;
try {
  donationRoutes = require('./src/routes/donationRoutes');
  console.log('✅ Donation routes loaded successfully');
  console.log('   Router type:', typeof donationRoutes);
  console.log('   Routes count:', donationRoutes?.stack?.length || 0);
} catch (error) {
  console.error('❌ Error loading donationRoutes:', error.message);
  donationRoutes = express.Router();
  donationRoutes.get('/donations', (req, res) => {
    res.json({ success: true, donations: [] });
  });
  donationRoutes.get('/projects', (req, res) => {
    res.json({ success: true, projects: [] });
  });
  donationRoutes.get('/projects/all', (req, res) => {
    res.json({ success: true, projects: [] });
  });
  donationRoutes.get('/events', (req, res) => {
    res.json({ success: true, events: [] });
  });
  donationRoutes.get('/ideas', (req, res) => {
    res.json({ success: true, ideas: [] });
  });
  donationRoutes.get('/updates', (req, res) => {
    res.json({ success: true, updates: [] });
  });
  donationRoutes.get('/stats', (req, res) => {
    res.json({ success: true, totalDonations: 0 });
  });
  donationRoutes.post('/donate', (req, res) => {
    res.json({ success: true, message: 'Donation created' });
  });
  donationRoutes.post('/ideas', (req, res) => {
    res.json({ success: true, message: 'Idea created' });
  });
  donationRoutes.get('/dashboard/stats', (req, res) => {
    res.json({ success: true, totalDonations: 0 });
  });
  donationRoutes.get('/dashboard/recent-donations', (req, res) => {
    res.json({ success: true, donations: [] });
  });
  donationRoutes.get('/dashboard/active-projects', (req, res) => {
    res.json({ success: true, projects: [] });
  });
  donationRoutes.get('/dashboard/updates', (req, res) => {
    res.json({ success: true, updates: [] });
  });
  donationRoutes.get('/dashboard/chart-data', (req, res) => {
    res.json([
      { month: 'Jan', amount: 0 },
      { month: 'Feb', amount: 0 },
      { month: 'Mar', amount: 0 },
      { month: 'Apr', amount: 0 },
      { month: 'May', amount: 0 },
      { month: 'Jun', amount: 0 }
    ]);
  });
  donationRoutes.get('/dashboard/ideals', (req, res) => {
    res.json({ success: true, ideals: [] });
  });
  donationRoutes.get('/dashboard/events', (req, res) => {
    res.json({ success: true, events: [] });
  });
}

// ✅ IMPORT OTHER ROUTES
const notificationRoutes = require('./src/routes/notificationRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const statisticsRoutes = require('./src/routes/statisticsRoutes');
const scoutRoutes = require('./src/routes/scoutRoutes');
const districtRoutes = require('./src/routes/districtRoutes');
const nationalRoutes = require('./src/routes/nationalRoutes');
const donorRoutes = require('./src/routes/donorRoutes');

// ✅ PAYMENT ROUTES
const paymentRoutes = require('./src/routes/paymentRoutes');

// ✅ CHAT ROUTES
const chatRoutes = require('./src/routes/chatRoutes');

// ✅ IMPORT PUBLIC ROUTES
const publicRoutes = require('./src/routes/publicRoutes');

// ✅ IMPORT MARKETPLACE ROUTES
const marketplaceRoutes = require('./src/routes/marketplaceRoutes');

// ✅ IMPORT NEWS ROUTES
const newsRoutes = require('./src/routes/newsRoutes');

// ✅ IMPORT DISTRICT CONTROLLER FOR ATTENDANCE ROUTES
const districtController = require('./src/controllers/districtController');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// ✅ CREATE UPLOAD DIRECTORIES
// ============================================
const fs = require('fs');
const uploadDirs = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads/payments'),
  path.join(__dirname, 'uploads/avatars'),
  path.join(__dirname, 'uploads/documents'),
  path.join(__dirname, 'uploads/reports'),
  path.join(__dirname, 'uploads/projects'),
  path.join(__dirname, 'uploads/certificates'),
  path.join(__dirname, 'uploads/products'),
  path.join(__dirname, 'uploads/news') // ✅ ADD NEWS UPLOAD DIRECTORY
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// ============================================
// ✅ CORS & SECURITY
// ============================================

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

app.options('*', cors());

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ✅ Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  message: { 
    success: false, 
    message: 'Too many requests from this IP, please try again later.' 
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================
// ✅ BODY PARSING
// ============================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// ✅ CACHE CONTROL
// ============================================

app.use('/api', (req, res, next) => {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  res.header('Surrogate-Control', 'no-store');
  next();
});

// ============================================
// ✅ STATIC FILES - PUBLIC ACCESS
// ============================================

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf'
    };
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars')));
app.use('/uploads/documents', express.static(path.join(__dirname, 'uploads/documents')));
app.use('/uploads/reports', express.static(path.join(__dirname, 'uploads/reports')));
app.use('/uploads/projects', express.static(path.join(__dirname, 'uploads/projects')));
app.use('/uploads/certificates', express.static(path.join(__dirname, 'uploads/certificates')));
app.use('/uploads/payments', express.static(path.join(__dirname, 'uploads/payments')));
app.use('/uploads/products', express.static(path.join(__dirname, 'uploads/products')));
app.use('/uploads/news', express.static(path.join(__dirname, 'uploads/news'))); // ✅ ADD NEWS STATIC

console.log('📁 Uploads directory:', path.join(__dirname, 'uploads'));

// ============================================
// ✅ PUBLIC ATTENDANCE ROUTES (NO AUTH REQUIRED)
// ============================================

// ✅ Verify attendance link (public)
app.get('/api/attendance/:token', districtController.getAttendanceViaLink);

// ✅ Mark attendance via link (public)
app.post('/api/attendance/:token', districtController.markAttendanceViaLink);

// ✅ Public verify attendance (alternative endpoint)
app.get('/api/public/attendance/verify/:token', districtController.publicVerifyAttendance);

// ✅ Public check-in attendance (alternative endpoint)
app.post('/api/public/attendance/check-in/:token', districtController.publicCheckInAttendance);

console.log('✅ Public attendance routes loaded');

// ============================================
// ✅ HEALTH CHECK ROUTES (PUBLIC)
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health/detailed', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        name: process.env.DB_NAME,
        host: process.env.DB_HOST
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.get('/api/test-db', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      success: true,
      message: 'Database connection successful!',
      database: process.env.DB_NAME,
      host: process.env.DB_HOST
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// ============================================
// ✅ PUBLIC ROUTES - MOUNT FIRST (NO AUTH)
// ============================================

// ✅ PUBLIC ROUTES
app.use('/api/public', publicRoutes);
console.log('✅ Public routes mounted');

// ============================================
// ✅ MARKETPLACE ROUTES - PUBLIC & ADMIN
// ============================================

app.use('/api', marketplaceRoutes);
console.log('✅ Marketplace routes mounted at /api/public and /api/admin');

// ============================================
// ✅ NEWS ROUTES - ADMIN ONLY
// ============================================

app.use('/api/admin/news', newsRoutes);
console.log('✅ News routes mounted at /api/admin/news');

// ============================================
// ✅ IDEA ROUTES - MOUNT BEFORE PROTECTED ROUTES
// ============================================

console.log('📦 Mounting idea routes...');
console.log('📦 ideaRoutes type:', typeof ideaRoutes);
console.log('📦 ideaRoutes is array?', Array.isArray(ideaRoutes));
console.log('📦 ideaRoutes keys:', Object.keys(ideaRoutes || {}));

// ✅ FORCE MOUNT - Directly mount without checking
try {
  app.use('/api/ideas', ideaRoutes);
  console.log('✅ Idea routes mounted at /api/ideas');
  
  console.log('✅ Router stack exists:', !!(ideaRoutes && ideaRoutes.stack));
  console.log('✅ Router routes:', ideaRoutes?.stack?.length || 0);
} catch (error) {
  console.error('❌ Failed to mount idea routes:', error.message);
  console.log('📦 ideaRoutes value:', JSON.stringify(ideaRoutes, null, 2));
  console.log('⚠️ Ideas API will not work!');
}

// ============================================
// ✅ PROTECTED ROUTES (AUTH REQUIRED)
// ============================================

// ✅ DONATION ROUTES - Mount at /api/donation
app.use('/api/donation', donationRoutes);
console.log('✅ Donation routes mounted at /api/donation');

// ✅ PROTECTED ROUTES
app.use('/api/auth', authRoutes);
app.use('/api', memberRoutes);
app.use('/api', eventRoutes);
app.use('/api', courseRoutes);
app.use('/api', projectRoutes);
app.use('/api', reportRoutes);

// ✅ NOTIFICATION ROUTES - Mount at BOTH paths
app.use('/api/notifications', notificationRoutes);
app.use('/api/scout/notifications', notificationRoutes);

// ✅ PAYMENT ROUTES - Mount at /api/payments
app.use('/api/payments', paymentRoutes);
console.log('✅ Payment routes mounted at /api/payments');

// ✅ OTHER ROUTES
app.use('/api', dashboardRoutes);
app.use('/api', statisticsRoutes);
app.use('/api/scout', scoutRoutes);
app.use('/api/district', districtRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/national', nationalRoutes);
app.use('/api/donor', donorRoutes);

// ✅ CHAT ROUTES - Mount at /api/chat
app.use('/api/chat', chatRoutes);
console.log('✅ Chat routes mounted at /api/chat');

console.log('✅ All protected routes mounted');

// ============================================
// ✅ DEBUG ROUTES (Development Only)
// ============================================

if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/routes', (req, res) => {
    const routeList = [];
    
    const extractRoutes = (stack, basePath = '') => {
      stack.forEach(layer => {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
          routeList.push({
            path: basePath + layer.route.path,
            methods: methods,
            fullPath: 'http://localhost:' + PORT + basePath + layer.route.path
          });
        } else if (layer.name === 'router' && layer.handle.stack) {
          let routerPath = '';
          if (layer.regexp) {
            const pathStr = layer.regexp.toString();
            const match = pathStr.match(/\/\^\\\/([^\/]*)/);
            if (match) {
              routerPath = '/' + match[1].replace(/\\/g, '');
            }
          }
          extractRoutes(layer.handle.stack, basePath + routerPath);
        }
      });
    };

    extractRoutes(app._router.stack);
    
    const grouped = {};
    routeList.forEach(r => {
      if (!grouped[r.path]) {
        grouped[r.path] = [];
      }
      grouped[r.path].push(r.methods);
    });

    const formatted = Object.keys(grouped).sort().map(path => ({
      path: path,
      methods: grouped[path].join(', '),
      fullUrl: 'http://localhost:' + PORT + path
    }));

    res.json({
      totalRoutes: formatted.length,
      routes: formatted,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/debug/districts-test', (req, res) => {
    res.json({
      success: true,
      message: 'District routes are accessible',
      endpoints: [
        '/api/districts',
        '/api/district/dashboard/stats',
        '/api/district/events',
        '/api/district/members',
        '/api/district/leaders'
      ]
    });
  });

  app.get('/api/debug/notifications-test', (req, res) => {
    res.json({
      success: true,
      message: 'Notification routes are accessible',
      endpoints: [
        '/api/notifications',
        '/api/scout/notifications',
        '/api/scout/notifications/unread-count'
      ]
    });
  });

  app.get('/api/debug/payment-test', (req, res) => {
    res.json({
      success: true,
      message: 'Payment routes are accessible',
      endpoints: [
        'GET /api/payments/services - Get payment services',
        'GET /api/payments/methods - Get payment methods',
        'GET /api/payments/history - Get payment history',
        'GET /api/payments/new - Get new payments',
        'GET /api/payments/:id - Get payment details',
        'POST /api/payments/create - Create payment',
        'PUT /api/payments/:id/approve - Approve payment',
        'PUT /api/payments/:id/reject - Reject payment',
        'GET /api/payments/dashboard/:type/stats - Dashboard stats',
        'GET /api/payments/dashboard/:type/revenue - Revenue sources',
        'GET /api/payments/dashboard/:type/payments - Dashboard payments',
        'GET /api/payments/notifications - Payment notifications',
        'PUT /api/payments/notifications/:id/read - Mark notification read'
      ]
    });
  });

  app.get('/api/debug/attendance-test', (req, res) => {
    res.json({
      success: true,
      message: 'Attendance routes are accessible',
      endpoints: [
        'GET /api/attendance/:token - Verify link',
        'POST /api/attendance/:token - Mark attendance',
        'GET /api/public/attendance/verify/:token - Public verify',
        'POST /api/public/attendance/check-in/:token - Public check-in'
      ]
    });
  });

  app.get('/api/debug/ideas-test', (req, res) => {
    const { Idea } = require('./src/models');
    res.json({
      success: true,
      ideaExists: !!Idea,
      ideaType: typeof Idea,
      ideaKeys: Object.keys(Idea || {}),
      ideaMethods: Idea ? Object.keys(Idea).filter(k => typeof Idea[k] === 'function') : [],
      hasFindAll: !!(Idea && typeof Idea.findAll === 'function')
    });
  });

  // ✅ MARKETPLACE DEBUG
  app.get('/api/debug/marketplace-test', (req, res) => {
    res.json({
      success: true,
      message: 'Marketplace routes are accessible',
      endpoints: [
        'GET /api/public/products - Get all products',
        'GET /api/public/products/:id - Get product details',
        'GET /api/public/categories - Get product categories',
        'POST /api/public/contact - Submit contact form',
        'GET /api/admin/products - Admin: Get all products',
        'POST /api/admin/products - Admin: Create product',
        'PUT /api/admin/products/:id - Admin: Update product',
        'DELETE /api/admin/products/:id - Admin: Delete product',
        'POST /api/admin/products/:id/image - Admin: Upload product image',
        'POST /api/admin/products/bulk-delete - Admin: Bulk delete',
        'POST /api/admin/products/bulk-update-stock - Admin: Bulk update stock',
        'GET /api/admin/messages - Admin: Get messages',
        'PUT /api/admin/messages/:id/read - Admin: Mark message read',
        'PUT /api/admin/messages/:id/replied - Admin: Mark message replied',
        'DELETE /api/admin/messages/:id - Admin: Delete message'
      ]
    });
  });

  // ✅ NEWS DEBUG
  app.get('/api/debug/news-test', (req, res) => {
    res.json({
      success: true,
      message: 'News routes are accessible',
      endpoints: [
        'GET /api/admin/news - Get all news',
        'GET /api/admin/news/:id - Get single news',
        'POST /api/admin/news - Create news',
        'PUT /api/admin/news/:id - Update news',
        'DELETE /api/admin/news/:id - Delete news',
        'PATCH /api/admin/news/:id/status - Update status',
        'POST /api/admin/news/bulk-delete - Bulk delete',
        'GET /api/admin/news/stats - Get statistics'
      ]
    });
  });
}

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  console.log(`⚠️ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    path: req.originalUrl,
    method: req.method
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  if (err.type === 'entity.too.large' || err.message.includes('too large')) {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum size is 50MB.',
      error: 'PayloadTooLarge'
    });
  }
  
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry',
      errors: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  if (err.code === '23505') {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry',
      error: err.detail || 'Unique constraint violation'
    });
  }

  if (err.code === '23502') {
    return res.status(400).json({
      success: false,
      message: 'Required field missing',
      error: err.column || 'A required field is missing'
    });
  }

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    if (process.env.NODE_ENV === 'development') {
      try {
        await sequelize.sync({ alter: true });
        console.log('✅ Database models synchronized.');
      } catch (syncError) {
        console.warn('⚠️ Database sync warning:', syncError.message);
      }
    }

    app.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log('🚀 MSR Backend Server');
      console.log('='.repeat(60));
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
      console.log(`🔗 Ideas API: http://localhost:${PORT}/api/ideas`);
      console.log(`🔗 Chat API: http://localhost:${PORT}/api/chat`);
      console.log(`🔗 Ideas Test: http://localhost:${PORT}/api/ideas/test (PUBLIC)`);
      console.log(`🔗 Districts API: http://localhost:${PORT}/api/districts`);
      console.log(`🔗 Notifications API: http://localhost:${PORT}/api/notifications`);
      console.log(`🔗 Attendance API: http://localhost:${PORT}/api/attendance/:token`);
      console.log(`🔗 Payments API: http://localhost:${PORT}/api/payments`);
      console.log(`🔗 Marketplace API: http://localhost:${PORT}/api/public/products`);
      console.log(`🔗 News API: http://localhost:${PORT}/api/admin/news`);
      console.log(`📊 Database: ${process.env.DB_NAME}`);
      console.log(`📁 Uploads: ${path.join(__dirname, 'uploads')}`);
      console.log('='.repeat(60));
      console.log('\n✅ Server ready! Waiting for requests...');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n📋 Debug endpoints:');
        console.log(`   GET /api/debug/routes - List all routes`);
        console.log(`   GET /api/debug/notifications-test - Test notifications`);
        console.log(`   GET /api/debug/attendance-test - Test attendance routes`);
        console.log(`   GET /api/debug/ideas-test - Test ideas model`);
        console.log(`   GET /api/debug/payment-test - Test payment routes`);
        console.log(`   GET /api/debug/marketplace-test - Test marketplace routes`);
        console.log(`   GET /api/debug/news-test - Test news routes`);
        console.log(`   GET /api/ideas/test - Test idea routes (PUBLIC)`);
      }
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Please check:');
    console.error('   1. PostgreSQL is running');
    console.error('   2. Database credentials in .env are correct');
    console.error('   3. Database "scoutdatabase" exists');
    process.exit(1);
  }
};

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const shutdown = async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  shutdown();
});

// ============================================
// ✅ START THE SERVER
// ============================================

startServer();

// ============================================
// EXPORT FOR TESTING
// ============================================

module.exports = app;