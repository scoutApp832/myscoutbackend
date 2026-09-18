// backend/src/routes/districtRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, checkRole } = require('../middleware/auth');
const districtController = require('../controllers/districtController');

// ============================================
// Apply authentication to all routes
// ============================================
router.use(authenticate);

// ============================================
// Role-based access middleware
// ============================================
const allowDistrictAndNational = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  // National Commissioner has full access
  if (req.user.role === 'national_commissioner' || 
      req.user.role === 'national-commissioner' ||
      req.user.role === 'super_admin' ||
      req.user.role === 'admin') {
    console.log('👑 National Commissioner accessing district route:', req.originalUrl);
    return next();
  }

  // District Commissioner has access
  if (req.user.role === 'district_commissioner' || 
      req.user.role === 'district-commissioner') {
    console.log('🏛️ District Commissioner accessing district route:', req.originalUrl);
    return next();
  }

  // Unit Leader has access
  if (req.user.role === 'unit_leader') {
    console.log('👤 Unit Leader accessing district route:', req.originalUrl);
    return next();
  }

  // Users with district assigned can access
  if (req.user.member?.district || req.user.district) {
    console.log('👤 User with district accessing district route:', req.originalUrl);
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. Required roles: district_commissioner, national_commissioner, unit_leader'
  });
};

// ============================================
// Check district assignment middleware
// ============================================
const checkDistrict = (req, res, next) => {
  // National Commissioners don't need a district
  const isNational = req.user.role === 'national_commissioner' || 
                     req.user.role === 'national-commissioner' ||
                     req.user.role === 'super_admin' ||
                     req.user.role === 'admin';
  
  if (isNational) {
    console.log('👑 National Commissioner - bypassing district check');
    return next();
  }

  // Unit Leaders also need a district
  const district = req.user?.member?.district || req.user?.district;
  
  if (!district) {
    return res.status(400).json({
      success: false,
      message: 'No district assigned to your account. Please contact administrator.'
    });
  }
  
  req.district = district;
  console.log(`✅ District check passed: ${district}`);
  next();
};

// ============================================
// District Commissioner Middleware
// ============================================
const isDistrictCommissioner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  // National Commissioner and Super Admin have full access
  if (req.user.role === 'national_commissioner' || 
      req.user.role === 'national-commissioner' ||
      req.user.role === 'super_admin' ||
      req.user.role === 'admin') {
    console.log('👑 National Commissioner/Super Admin - full access granted');
    return next();
  }

  // District Commissioner has access
  if (req.user.role === 'district_commissioner' || 
      req.user.role === 'district-commissioner') {
    console.log('🏛️ District Commissioner access granted');
    return next();
  }

  console.log(`❌ Access denied for role: ${req.user.role}`);
  return res.status(403).json({
    success: false,
    message: 'Access denied. Only District Commissioner or higher can perform this action.'
  });
};

// ============================================
// Apply middleware to all district routes
// ============================================
router.use(allowDistrictAndNational);
router.use(checkDistrict);

// ============================================
// DISTRICTS
// ============================================
router.get('/districts', districtController.getAllDistricts);
router.get('/districts/list', districtController.getAllDistricts);

// ============================================
// DISTRICT INFO
// ============================================
router.get('/info', districtController.getDistrictInfo);

// ============================================
// DASHBOARD ROUTES
// ============================================
router.get('/dashboard/stats', districtController.getStats);
router.get('/dashboard/recent-activities', districtController.getRecentActivities);
router.get('/dashboard/upcoming-events', districtController.getUpcomingEvents);
router.get('/dashboard/announcements', districtController.getAnnouncements);
router.get('/dashboard/notifications', districtController.getNotifications);
router.get('/dashboard/chart-data', districtController.getChartData);
router.get('/dashboard/status-data', districtController.getStatusData);
router.get('/dashboard/gender-distribution', districtController.getGenderData);

// ============================================
// LEADER ROUTES
// ============================================
router.get('/leaders', districtController.getLeaders);
router.post('/leaders', districtController.createLeader);
router.put('/leaders/:id', districtController.updateLeader);
router.put('/leaders/:id/status', districtController.toggleLeaderStatus);

// ============================================
// MEMBER ROUTES
// ============================================
router.get('/members', districtController.getMembers);
router.get('/members/:id', districtController.getMemberById);
router.put('/members/:id', districtController.updateMember);
router.post('/members/:id/promote', districtController.promoteToLeader);

// ============================================
// EVENT ROUTES
// ============================================
router.get('/events', districtController.getEvents);
router.get('/events/:id', districtController.getEventDetails);
router.post('/events', districtController.createEvent);
router.put('/events/:id', districtController.updateEvent);
router.delete('/events/:id', districtController.deleteEvent);
router.put('/events/:id/cancel', districtController.cancelEvent);

// ============================================
// REGISTRATION ROUTES
// ============================================
router.get('/events/:id/registrations', districtController.getEventRegistrations);
router.put('/events/:id/registrations/:registrationId/approve', districtController.approveRegistration);
router.put('/events/:id/registrations/:registrationId/reject', districtController.rejectRegistration);
router.put('/events/:id/registrations/:registrationId/attendance', districtController.markAttendance);
router.post('/events/:id/register', districtController.registerForEvent);
router.get('/events/:id/registration-status', districtController.getRegistrationStatus);
router.delete('/events/:id/register', districtController.cancelRegistration);

// ============================================
// ATTENDANCE LINK ROUTES
// ============================================
router.post('/events/:id/attendance-link/generate', districtController.generateAttendanceLink);
router.get('/events/:id/attendance-link/status', districtController.getAttendanceLinkStatus);
router.put('/events/:id/attendance-link/regenerate', districtController.regenerateAttendanceLink);
router.delete('/events/:id/attendance-link', districtController.deleteAttendanceLink);
router.get('/events/:id/attendance/summary', districtController.getAttendanceSummary);
router.get('/events/:id/attendance/export', districtController.exportAttendanceList);

// ============================================
// REPORT ROUTES
// ============================================
router.get('/reports', districtController.getReports);
router.put('/reports/:id/approve-only', isDistrictCommissioner, districtController.approveOnly);
router.put('/reports/:id/approve-forward', isDistrictCommissioner, districtController.approveAndForward);
router.put('/reports/:id/forward', isDistrictCommissioner, districtController.forwardToNational);
router.put('/reports/:id/reject', isDistrictCommissioner, districtController.rejectReport);
router.put('/reports/:id/archive', isDistrictCommissioner, districtController.archiveReport);

// ============================================
// IDEA ROUTES
// ============================================
router.get('/ideas', districtController.getDistrictIdeas);
router.put('/ideas/:id/review', isDistrictCommissioner, districtController.reviewIdea);
router.post('/ideas/:id/forward', isDistrictCommissioner, districtController.forwardIdea);
router.delete('/ideas/:id', isDistrictCommissioner, districtController.deleteIdea);

// ============================================
// ANNOUNCEMENT ROUTES
// ============================================
router.post('/announcements', districtController.createAnnouncement);
router.get('/announcements', districtController.getAnnouncements);
router.put('/announcements/:id', districtController.updateAnnouncement);
router.delete('/announcements/:id', districtController.deleteAnnouncement);

// ============================================
// NOTIFICATION ROUTES
// ============================================
router.get('/notifications', districtController.getNotifications);
router.get('/scout/notifications/unread-count', districtController.getNotifications);

console.log('✅ District routes loaded successfully');

module.exports = router;