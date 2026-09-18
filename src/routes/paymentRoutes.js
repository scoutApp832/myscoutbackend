const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/payments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `payment-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

// ============================================
// ✅ VERIFICATION ROUTES (PUBLIC)
// ============================================
router.get('/verify/:reference', paymentController.verifyInvoice);
router.get('/verify/status/:reference', authenticate, paymentController.getVerificationStatus);

// ============================================
// ✅ EVENT ROUTES
// ============================================
router.get('/event/:eventId', authenticate, paymentController.getEventForPayment);

// ============================================
// ✅ PAYMENT SERVICES ROUTES
// ============================================
router.get('/services', authenticate, paymentController.getPaymentServices);

// ============================================
// ✅ PAYMENT METHODS ROUTES
// ============================================
router.get('/methods', authenticate, paymentController.getPaymentMethods);
router.post('/methods', authenticate, paymentController.createPaymentMethod);
router.put('/methods/:id', authenticate, paymentController.updatePaymentMethod);
router.delete('/methods/:id', authenticate, paymentController.deletePaymentMethod);
router.put('/methods/:id/toggle', authenticate, paymentController.togglePaymentMethod);

// ============================================
// ✅ PAYMENT TRANSACTION ROUTES
// ============================================

// ✅ SPECIFIC ROUTES MUST COME BEFORE /:id
router.get('/history', authenticate, paymentController.getPaymentHistory);
router.get('/new', authenticate, paymentController.getNewPayments);
router.get('/notifications', authenticate, paymentController.getPaymentNotifications);
router.put('/notifications/:id/read', authenticate, paymentController.markNotificationRead);

// ✅ Create payment with evidence upload
router.post(
  '/create', 
  authenticate, 
  upload.single('evidence'), 
  paymentController.createPayment
);

// ✅ Approve/Reject payment
router.put('/:id/approve', authenticate, paymentController.approvePayment);
router.put('/:id/reject', authenticate, paymentController.rejectPayment);

// ============================================
// ✅ DASHBOARD ROUTES
// ============================================
router.get('/dashboard/:type/stats', authenticate, paymentController.getDashboardStats);
router.get('/dashboard/:type/revenue', authenticate, paymentController.getRevenueSources);
router.get('/dashboard/:type/payments', authenticate, paymentController.getDashboardPayments);

// ✅ PARAMETER ROUTE - MUST BE LAST!
router.get('/:id', authenticate, paymentController.getPaymentDetails);

// ============================================
// ✅ DEBUG ROUTES (for testing)
// ============================================
router.get('/debug/events', authenticate, async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const query = `
      SELECT 
        id,
        title,
        is_national,
        district_id,
        price,
        status,
        scope,
        start_date
      FROM events
      WHERE price > 0
        AND status IN ('upcoming', 'published', 'ongoing')
      ORDER BY is_national DESC, start_date ASC
    `;
    
    const events = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      events: events,
      count: events.length
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// EXPORT ROUTES
// ============================================

console.log('✅ Payment routes loaded successfully');
console.log('📋 Routes order:');
console.log('  GET    /verify/:reference - Public verify');
console.log('  GET    /verify/status/:reference - Verify status');
console.log('  GET    /event/:eventId - Get event');
console.log('  GET    /services - Get services');
console.log('  GET    /methods - Get methods');
console.log('  POST   /methods - Create method');
console.log('  PUT    /methods/:id - Update method');
console.log('  DELETE /methods/:id - Delete method');
console.log('  PUT    /methods/:id/toggle - Toggle method');
console.log('  GET    /history - Get history');
console.log('  GET    /new - Get new payments');
console.log('  GET    /notifications - Get notifications');
console.log('  PUT    /notifications/:id/read - Mark read');
console.log('  POST   /create - Create payment');
console.log('  PUT    /:id/approve - Approve payment');
console.log('  PUT    /:id/reject - Reject payment');
console.log('  GET    /dashboard/:type/stats - Dashboard stats');
console.log('  GET    /dashboard/:type/revenue - Revenue sources');
console.log('  GET    /dashboard/:type/payments - Dashboard payments');
console.log('  GET    /:id - Get payment details (MUST BE LAST)');

module.exports = router;