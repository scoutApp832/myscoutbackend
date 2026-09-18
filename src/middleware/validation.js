// src/middleware/validate.js
const { validationResult } = require('express-validator');

/**
 * Main validation middleware
 * Checks for validation errors and returns formatted response
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validate email format
 */
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Rwanda format)
 */
exports.isValidPhone = (phone) => {
  const phoneRegex = /^((07|2507)\d{8})$/;
  return phoneRegex.test(phone);
};

/**
 * Validate SIN (Scout Identification Number)
 * Format: MSR-XXXX-YYYY where XXXX is year and YYYY is sequential number
 */
exports.isValidSIN = (sin) => {
  const sinRegex = /^MSR-\d{4}-\d{4}$/;
  return sinRegex.test(sin);
};

/**
 * Validate date format (YYYY-MM-DD)
 */
exports.isValidDate = (date) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
};

/**
 * Validate password strength
 * At least 8 characters, 1 uppercase, 1 lowercase, 1 number
 */
exports.isStrongPassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Sanitize input string (remove HTML tags, trim)
 */
exports.sanitizeString = (str) => {
  if (!str) return '';
  return str.trim().replace(/<[^>]*>/g, '');
};

/**
 * Validate district exists in Rwanda
 */
exports.isValidDistrict = (district) => {
  const districts = [
    'Nyarugenge', 'Gasabo', 'Kicukiro', 'Rusizi', 'Nyamasheke',
    'Karongi', 'Rutsiro', 'Rubavu', 'Nyabihu', 'Musanze',
    'Burera', 'Gakenke', 'Rulindo', 'Muhanga', 'Kamonyi',
    'Ruhango', 'Nyanza', 'Gisagara', 'Huye', 'Nyamagabe',
    'Nyaruguru', 'Rwamagana', 'Kayonza', 'Ngoma', 'Kirehe',
    'Bugesera', 'Gatsibo', 'Nyagatare', 'Gicumbi'
  ];
  return districts.includes(district);
};

/**
 * Validate event status
 */
exports.isValidEventStatus = (status) => {
  const statuses = ['draft', 'published', 'upcoming', 'ongoing', 'completed', 'cancelled'];
  return statuses.includes(status);
};

/**
 * Validate member status
 */
exports.isValidMemberStatus = (status) => {
  const statuses = ['active', 'inactive', 'pending', 'suspended'];
  return statuses.includes(status);
};

/**
 * Validate payment status
 */
exports.isValidPaymentStatus = (status) => {
  const statuses = ['pending', 'paid', 'unpaid', 'failed', 'refunded'];
  return statuses.includes(status);
};

/**
 * Validate donation status
 */
exports.isValidDonationStatus = (status) => {
  const statuses = ['pending', 'completed', 'failed', 'refunded'];
  return statuses.includes(status);
};

/**
 * Validate report status
 */
exports.isValidReportStatus = (status) => {
  const statuses = ['pending', 'approved', 'rejected', 'published', 'archived'];
  return statuses.includes(status);
};

/**
 * Validate project status
 */
exports.isValidProjectStatus = (status) => {
  const statuses = ['pending', 'approved', 'rejected', 'archived', 'ongoing', 'completed'];
  return statuses.includes(status);
};

/**
 * Validate gender
 */
exports.isValidGender = (gender) => {
  const genders = ['male', 'female', 'other'];
  return genders.includes(gender);
};

/**
 * Validate role
 */
exports.isValidRole = (role) => {
  const roles = ['admin', 'national_commissioner', 'district_commissioner', 'unit_leader', 'scout'];
  return roles.includes(role);
};

/**
 * Validate priority level
 */
exports.isValidPriority = (priority) => {
  const priorities = ['low', 'medium', 'high', 'urgent'];
  return priorities.includes(priority);
};

/**
 * Validate audience
 */
exports.isValidAudience = (audience) => {
  const audiences = ['all', 'members', 'leaders', 'public'];
  return audiences.includes(audience);
};

/**
 * Validate course level
 */
exports.isValidCourseLevel = (level) => {
  const levels = ['beginner', 'intermediate', 'advanced'];
  return levels.includes(level);
};

/**
 * Validate idea status
 */
exports.isValidIdeaStatus = (status) => {
  const statuses = ['pending', 'reviewing', 'approved', 'rejected', 'forwarded', 'implemented'];
  return statuses.includes(status);
};

/**
 * Validate attendance status
 */
exports.isValidAttendanceStatus = (status) => {
  const statuses = ['present', 'absent', 'pending'];
  return statuses.includes(status);
};

/**
 * Validate registration status
 */
exports.isValidRegistrationStatus = (status) => {
  const statuses = ['pending', 'approved', 'rejected', 'cancelled', 'attended'];
  return statuses.includes(status);
};

/**
 * Validate payment method
 */
exports.isValidPaymentMethod = (method) => {
  const methods = ['mobile_money', 'bank_transfer', 'cash', 'card'];
  return methods.includes(method);
};

/**
 * Validate file type
 */
exports.isValidFileType = (mimetype, allowedTypes) => {
  return allowedTypes.includes(mimetype);
};

/**
 * Validate file size (in bytes)
 */
exports.isValidFileSize = (size, maxSize) => {
  return size <= maxSize;
};

/**
 * Common validation rules for pagination
 */
exports.paginationRules = {
  page: { min: 1, default: 1 },
  limit: { min: 1, max: 100, default: 20 }
};

/**
 * Common validation rules for search
 */
exports.searchRules = {
  search: { optional: true, trim: true },
  sortBy: { optional: true },
  sortOrder: { optional: true, isIn: ['ASC', 'DESC'] }
};

/**
 * Common validation rules for date filtering
 */
exports.dateFilterRules = {
  fromDate: { optional: true, isISO8601: true },
  toDate: { optional: true, isISO8601: true }
};

/**
 * Middleware to validate pagination parameters
 */
exports.validatePagination = (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  
  if (isNaN(parsedPage) || parsedPage < 1) {
    return res.status(400).json({
      success: false,
      message: 'Page must be a positive integer'
    });
  }
  
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100'
    });
  }
  
  req.pagination = {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit
  };
  
  next();
};

/**
 * Middleware to validate date range
 */
exports.validateDateRange = (req, res, next) => {
  const { fromDate, toDate } = req.query;
  
  if (fromDate && !exports.isValidDate(fromDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid fromDate format. Use YYYY-MM-DD'
    });
  }
  
  if (toDate && !exports.isValidDate(toDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid toDate format. Use YYYY-MM-DD'
    });
  }
  
  if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
    return res.status(400).json({
      success: false,
      message: 'fromDate cannot be after toDate'
    });
  }
  
  next();
};

/**
 * Middleware to validate email
 */
exports.validateEmail = (req, res, next) => {
  const { email } = req.body;
  if (email && !exports.isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }
  next();
};

/**
 * Middleware to validate phone
 */
exports.validatePhone = (req, res, next) => {
  const { phone } = req.body;
  if (phone && !exports.isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format. Use 078XXXXXXX or 25078XXXXXXXX'
    });
  }
  next();
};

/**
 * Middleware to validate password strength
 */
exports.validatePassword = (req, res, next) => {
  const { password } = req.body;
  if (password && !exports.isStrongPassword(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'
    });
  }
  next();
};

/**
 * Sanitize request body strings
 */
exports.sanitizeBody = (req, res, next) => {
  const fields = ['name', 'fullName', 'description', 'title', 'content', 'message', 'remarks', 'feedback'];
  
  fields.forEach(field => {
    if (req.body[field]) {
      req.body[field] = exports.sanitizeString(req.body[field]);
    }
  });
  
  next();
};

module.exports = {
  // Main validator
  validate: exports.validate,
  
  // Validation functions
  isValidEmail: exports.isValidEmail,
  isValidPhone: exports.isValidPhone,
  isValidSIN: exports.isValidSIN,
  isValidDate: exports.isValidDate,
  isStrongPassword: exports.isStrongPassword,
  isValidDistrict: exports.isValidDistrict,
  isValidEventStatus: exports.isValidEventStatus,
  isValidMemberStatus: exports.isValidMemberStatus,
  isValidPaymentStatus: exports.isValidPaymentStatus,
  isValidDonationStatus: exports.isValidDonationStatus,
  isValidReportStatus: exports.isValidReportStatus,
  isValidProjectStatus: exports.isValidProjectStatus,
  isValidGender: exports.isValidGender,
  isValidRole: exports.isValidRole,
  isValidPriority: exports.isValidPriority,
  isValidAudience: exports.isValidAudience,
  isValidCourseLevel: exports.isValidCourseLevel,
  isValidIdeaStatus: exports.isValidIdeaStatus,
  isValidAttendanceStatus: exports.isValidAttendanceStatus,
  isValidRegistrationStatus: exports.isValidRegistrationStatus,
  isValidPaymentMethod: exports.isValidPaymentMethod,
  isValidFileType: exports.isValidFileType,
  isValidFileSize: exports.isValidFileSize,
  
  // Sanitization
  sanitizeString: exports.sanitizeString,
  sanitizeBody: exports.sanitizeBody,
  
  // Middleware
  validatePagination: exports.validatePagination,
  validateDateRange: exports.validateDateRange,
  validateEmail: exports.validateEmail,
  validatePhone: exports.validatePhone,
  validatePassword: exports.validatePassword,
  
  // Rules
  paginationRules: exports.paginationRules,
  searchRules: exports.searchRules,
  dateFilterRules: exports.dateFilterRules
};