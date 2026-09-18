const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Import routes
const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const eventRoutes = require('./routes/eventRoutes');
const courseRoutes = require('./routes/courseRoutes');
const projectRoutes = require('./routes/projectRoutes');
const reportRoutes = require('./routes/reportRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const ideaRoutes = require('./routes/ideaRoutes');
const donationRoutes = require('./routes/donationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', memberRoutes);
app.use('/api', eventRoutes);
app.use('/api', courseRoutes);
app.use('/api', projectRoutes);
app.use('/api', reportRoutes);
app.use('/api', announcementRoutes);
app.use('/api', ideaRoutes);
app.use('/api', donationRoutes);
app.use('/api', notificationRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', statisticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;