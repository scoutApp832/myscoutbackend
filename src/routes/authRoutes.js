// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const authController = require('../controllers/authController');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Register
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Forgot password
router.post('/forgot-password', authController.forgotPassword);

// Reset password with token in URL
router.post('/reset-password/:token', authController.resetPassword);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// ✅ GET /api/auth/me - Get current user profile
router.get('/me', protect, authController.getProfile);

// ✅ GET /api/auth/profile - Alias for /me
router.get('/profile', protect, authController.getProfile);

// Update profile
router.put('/profile', protect, authController.updateProfile);

// Change password
router.put('/change-password', protect, authController.changePassword);

// Logout
router.post('/logout', protect, authController.logout);

// ============================================
// ✅ DEBUG: Check if routes are loaded
// ============================================
console.log('✅ Auth routes loaded:');
console.log('  - POST /api/auth/register');
console.log('  - POST /api/auth/login');
console.log('  - POST /api/auth/forgot-password');
console.log('  - POST /api/auth/reset-password/:token');
console.log('  - GET  /api/auth/me');
console.log('  - GET  /api/auth/profile');
console.log('  - PUT  /api/auth/profile');
console.log('  - PUT  /api/auth/change-password');
console.log('  - POST /api/auth/logout');

module.exports = router;