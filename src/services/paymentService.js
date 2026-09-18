// ============================================
// GENERATE REFERENCE NUMBER
// ============================================
exports.generateReference = (role = 'MSR') => {
  const prefix = role === 'donor' ? 'DON' : 'MSR';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-PAY-${timestamp}-${random}`;
};

// ============================================
// GENERATE INVOICE NUMBER
// ============================================
exports.generateInvoice = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${timestamp}-${random}`;
};

// ============================================
// VALIDATE PAYMENT
// ============================================
exports.validatePayment = (paymentData) => {
  const errors = [];

  if (!paymentData.serviceName && !paymentData.serviceId) {
    errors.push('Service name or ID is required');
  }

  if (!paymentData.amount || paymentData.amount <= 0) {
    errors.push('Valid amount is required');
  }

  if (!paymentData.paymentMethod) {
    errors.push('Payment method is required');
  }

  if (!paymentData.paymentDate) {
    errors.push('Payment date is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============================================
// CALCULATE STATS
// ============================================
exports.calculateStats = (payments) => {
  const total = payments.length;
  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const pending = payments.filter(p => p.payment_status === 'pending').length;
  const approved = payments.filter(p => p.payment_status === 'approved' || p.payment_status === 'completed').length;
  const rejected = payments.filter(p => p.payment_status === 'rejected').length;
  
  return {
    total,
    totalAmount,
    pending,
    approved,
    rejected,
    approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
  };
};