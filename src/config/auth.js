require('dotenv').config();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'msr-secret-key-2024',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  SALT_ROUNDS: 12,
  TOKEN_TYPES: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    RESET: 'reset',
    VERIFY: 'verify'
  }
};