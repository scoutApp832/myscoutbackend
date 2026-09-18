/**
 * Validate email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Rwandan format)
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^0[7-9][0-9]{8}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate password strength
 */
const isStrongPassword = (password) => {
  // At least 6 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
  return passwordRegex.test(password);
};

/**
 * Validate SIN format
 */
const isValidSIN = (sin) => {
  const sinRegex = /^MSR[0-9]{6}$/;
  return sinRegex.test(sin);
};

/**
 * Validate date
 */
const isValidDate = (date) => {
  return !isNaN(new Date(date).getTime());
};

/**
 * Validate required fields
 */
const validateRequired = (data, fields) => {
  const errors = [];
  for (const field of fields) {
    if (!data[field] || data[field].toString().trim() === '') {
      errors.push(`${field} is required`);
    }
  }
  return errors;
};

/**
 * Validate object against schema
 */
const validateSchema = (data, schema) => {
  const errors = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    if (rules.required && (!value || value.toString().trim() === '')) {
      errors[field] = `${field} is required`;
      continue;
    }
    
    if (value && rules.type) {
      if (rules.type === 'email' && !isValidEmail(value)) {
        errors[field] = `${field} must be a valid email`;
      }
      if (rules.type === 'phone' && !isValidPhone(value)) {
        errors[field] = `${field} must be a valid phone number`;
      }
      if (rules.type === 'password' && !isStrongPassword(value)) {
        errors[field] = 'Password must be at least 6 characters with uppercase, lowercase and number';
      }
      if (rules.type === 'date' && !isValidDate(value)) {
        errors[field] = `${field} must be a valid date`;
      }
    }
    
    if (value && rules.minLength && value.length < rules.minLength) {
      errors[field] = `${field} must be at least ${rules.minLength} characters`;
    }
    
    if (value && rules.maxLength && value.length > rules.maxLength) {
      errors[field] = `${field} must be at most ${rules.maxLength} characters`;
    }
    
    if (value && rules.min && Number(value) < rules.min) {
      errors[field] = `${field} must be at least ${rules.min}`;
    }
    
    if (value && rules.max && Number(value) > rules.max) {
      errors[field] = `${field} must be at most ${rules.max}`;
    }
    
    if (value && rules.enum && !rules.enum.includes(value)) {
      errors[field] = `${field} must be one of: ${rules.enum.join(', ')}`;
    }
  }
  
  return errors;
};

module.exports = {
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  isValidSIN,
  isValidDate,
  validateRequired,
  validateSchema
};