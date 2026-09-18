const { Payment } = require('../models');

// ============================================
// CHECK PAYMENT OWNERSHIP
// ============================================
exports.checkPaymentOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const payment = await Payment.findByPk(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // National Commissioner can access all
    if (role === 'national_commissioner' || role === 'national-commissioner' || role === 'admin' || role === 'super_admin') {
      req.payment = payment;
      return next();
    }

    // District Commissioner can access district payments
    if (role === 'district_commissioner' || role === 'district-commissioner') {
      const district = req.user.member?.district || req.user.district;
      if (payment.district === district) {
        req.payment = payment;
        return next();
      }
      return res.status(403).json({
        success: false,
        message: 'You can only access payments from your district'
      });
    }

    // Regular user can only access their own payments
    if (payment.user_id === userId) {
      req.payment = payment;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this payment'
    });
  } catch (error) {
    console.error('❌ Payment ownership check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment ownership',
      error: error.message
    });
  }
};

// ============================================
// VALIDATE PAYMENT STATUS
// ============================================
exports.validatePaymentStatus = (allowedStatuses) => {
  return (req, res, next) => {
    const payment = req.payment;
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (!allowedStatuses.includes(payment.payment_status)) {
      return res.status(400).json({
        success: false,
        message: `Payment cannot be processed in current status: ${payment.payment_status}`
      });
    }

    next();
  };
};