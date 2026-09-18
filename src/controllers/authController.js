// backend/src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Member, Notification } = require('../models');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/auth');
const { Op } = require('sequelize');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');

// ✅ Constants
const ROLE_DASHBOARD_MAP = {
  'national_commissioner': '/national-dashboard',
  'district_commissioner': '/district-dashboard',
  'unit_leader': '/unit-dashboard',
  'scout': '/scout-dashboard',
  'donor': '/donor-dashboard'
};

// ✅ Helper Functions
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE || '7d' }
  );
};

const getDashboardRoute = (role) => {
  return ROLE_DASHBOARD_MAP[role] || '/login';
};

// ============================================
// ✅ LOGIN
// ============================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔑 Login attempt for email:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      include: [{ model: Member, as: 'member' }]
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ User found:', user.email, 'Role:', user.role);

    // Check user status
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: '⏳ Your account is pending approval.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '❌ Your account is not active. Please contact support.'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ Password verified for:', email);

    await user.update({ last_login: new Date() });

    const token = generateToken(user);
    const dashboardRoute = getDashboardRoute(user.role);

    const userData = user.toJSON ? user.toJSON() : user.get({ plain: true });
    delete userData.password_hash;
    delete userData.reset_token;
    delete userData.reset_token_expiry;

    console.log('✅ Login successful for:', email);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      dashboard: dashboardRoute,
      user: userData,
      member: user.member || null
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ✅ GET PROFILE
// ============================================
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Member, as: 'member' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = user.toJSON ? user.toJSON() : user.get({ plain: true });
    delete userData.password_hash;
    delete userData.reset_token;
    delete userData.reset_token_expiry;

    const dashboardRoute = getDashboardRoute(user.role);

    res.json({
      success: true,
      user: userData,
      dashboard: dashboardRoute
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ✅ UPDATE PROFILE
// ============================================
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, profile_image, ...memberData } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (fullName) user.full_name = fullName;
    if (phone) user.phone = phone;
    await user.save();

    if (user.member) {
      const updateData = { ...memberData };
      if (profile_image) {
        updateData.profile_image = profile_image;
      }
      await user.member.update(updateData);
    }

    const updatedUser = await User.findByPk(userId, {
      include: [{ model: Member, as: 'member' }]
    });

    const userData = updatedUser.toJSON ? updatedUser.toJSON() : updatedUser.get({ plain: true });
    delete userData.password_hash;
    delete userData.reset_token;
    delete userData.reset_token_expiry;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userData
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ✅ CHANGE PASSWORD
// ============================================
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    await user.update({ password_hash: newPassword });

    await Notification.create({
      user_id: user.id,
      title: 'Password Changed',
      message: 'Your password has been changed successfully.',
      type: 'success',
      link: '/profile',
      priority: 'medium'
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ✅ REGISTER
// ============================================
exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      phone,
      role,
      firstName,
      lastName,
      province,
      district,
      sector,
      cell,
      village,
      gender,
      dateOfBirth,
      troopName
    } = req.body;

    console.log('📝 Registration attempt:', { email, fullName, role });

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password and full name are required'
      });
    }

    const existingUser = await User.findOne({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const roleMap = {
      'scout': 'scout',
      'unit_leader': 'unit_leader',
      'district': 'district_commissioner',
      'district_commissioner': 'district_commissioner',
      'national': 'national_commissioner',
      'national_commissioner': 'national_commissioner',
      'donor': 'donor'
    };

    const mappedRole = roleMap[role] || 'scout';

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password_hash: password,
      full_name: fullName,
      phone: phone || null,
      role: mappedRole,
      status: mappedRole === 'district_commissioner' ? 'pending' : 'active',
      permissions: {}
    });

    console.log('✅ User created:', user.id);

    // Generate SIN
    let sin;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 100;

    while (exists && attempts < maxAttempts) {
      const random = Math.floor(100000 + Math.random() * 900000);
      sin = `MSR${random}`;
      const existing = await Member.findOne({ where: { sin } });
      exists = !!existing;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate unique SIN');
    }

    const member = await Member.create({
      user_id: user.id,
      sin: sin,
      first_name: firstName || fullName.split(' ')[0],
      last_name: lastName || fullName.split(' ').slice(1).join(' ') || fullName,
      province: province || null,
      district: district || null,
      sector: sector || null,
      cell: cell || null,
      village: village || null,
      gender: gender || null,
      date_of_birth: dateOfBirth || null,
      troop_name: troopName || null,
      membership_status: mappedRole === 'district_commissioner' ? 'pending' : 'active',
      fee_status: 'unpaid'
    });

    console.log('✅ Member created with SIN:', sin);

    await Notification.create({
      user_id: user.id,
      title: 'Welcome to MSR Rwanda! 🏕️',
      message: `Welcome ${fullName}! Your account has been created successfully. Your SIN is ${sin}`,
      type: 'success',
      link: '/profile',
      priority: 'high'
    });

    let emailSent = false;
    try {
      await sendWelcomeEmail(user, member, mappedRole);
      emailSent = true;
      console.log(`📧 Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
    }

    const token = generateToken(user);
    const dashboardRoute = getDashboardRoute(user.role);

    const userData = user.toJSON ? user.toJSON() : user.get({ plain: true });
    delete userData.password_hash;

    console.log('✅ Registration successful:', { email, role: mappedRole, sin });

    res.status(201).json({
      success: true,
      message: mappedRole === 'district_commissioner'
        ? 'Registration submitted for approval.'
        : 'Registration successful! Welcome to MSR Rwanda.',
      token: mappedRole !== 'district_commissioner' ? token : undefined,
      dashboard: dashboardRoute,
      user: userData,
      member: member,
      emailSent: emailSent
    });

  } catch (error) {
    console.error('❌ Registration error:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ✅ FORGOT PASSWORD
// ============================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Forgot password request for:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() }
    });

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Generate secure random token using crypto
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Store hashed token in database
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Token expires after 30 minutes
    const expiry = new Date(Date.now() + 30 * 60 * 1000);

    await user.update({
      reset_token: hashedToken,
      reset_token_expiry: expiry
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    console.log('🔗 Reset URL:', resetUrl);

    // Send email
    try {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.full_name,
        resetUrl
      });
      console.log(`📧 Password reset email sent to: ${user.email}`);
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process password reset request'
    });
  }
};

// ============================================
// ✅ RESET PASSWORD - Using params token
// ============================================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;  // ✅ Token from URL params
    const { password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required'
      });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirmation are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Hash the token from URL
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with this reset token
    const user = await User.findOne({
      where: { reset_token: hashedToken }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset link'
      });
    }

    // Check token expiration
    if (!user.reset_token_expiry || new Date(user.reset_token_expiry) < new Date()) {
      await user.update({
        reset_token: null,
        reset_token_expiry: null
      });

      return res.status(400).json({
        success: false,
        message: 'This password reset link has expired'
      });
    }

    // Update password (will be hashed by beforeUpdate hook)
    await user.update({
      password_hash: password,
      reset_token: null,
      reset_token_expiry: null,
      updated_at: new Date()
    });

    // Send notification
    await Notification.create({
      user_id: user.id,
      title: 'Password Reset Successful',
      message: 'Your password has been reset successfully. Please login with your new password.',
      type: 'success',
      link: '/login',
      priority: 'high'
    });

    console.log(`✅ Password reset successful for user: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to reset password'
    });
  }
};

// ============================================
// ✅ LOGOUT
// ============================================
exports.logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};