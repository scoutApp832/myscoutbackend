const express = require('express');
const router = express.Router();
const {
  protect,
  isNationalCommissioner,
  isSuperAdmin,
  checkPermission,
  hasAnyPermission
} = require('../middleware/auth');
const nationalController = require('../controllers/nationalController');
const { sendScoutIDCardPDF } = require('../services/emailService');
const { Member, User } = require('../models');

// ============================================
// PUBLIC ROUTES (NO AUTH)
// ============================================
router.get('/attendance/verify/:token', nationalController.verifyAttendanceLink);
router.post('/attendance/check-in/:token', nationalController.checkInByLink);

// ============================================
// PROTECTED ROUTES - All authenticated users
// ============================================
router.use(protect);
// ✅ REMOVED: router.use(isNationalCommissioner);
// ✅ The controllers will handle role-based filtering

// ============================================
// DASHBOARD ROUTES
// ============================================
router.get('/dashboard/stats', nationalController.getStats);
router.get('/dashboard/recent-activities', nationalController.getRecentActivities);
router.get('/dashboard/upcoming-events', nationalController.getUpcomingEvents);
router.get('/dashboard/membership-by-district', nationalController.getMembershipByDistrict);
router.get('/dashboard/gender-distribution', nationalController.getGenderData);
router.get('/dashboard/age-groups', nationalController.getAgeGroups);
router.get('/dashboard/notifications', nationalController.getNotifications);

// ============================================
// NOTIFICATION ROUTES
// ============================================
router.put('/notifications/:id/read', nationalController.markNotificationAsRead);
router.put('/notifications/read-all', nationalController.markAllNotificationsAsRead);

// ============================================
// MEMBER ROUTES
// ============================================
router.get('/members', checkPermission('members', 'view'), nationalController.getMembers);
router.post('/members', checkPermission('members', 'create'), nationalController.createMember);
router.get('/members/:id', checkPermission('members', 'view'), nationalController.getMemberById);
router.put('/members/:id', checkPermission('members', 'edit'), nationalController.updateMember);
router.delete('/members/:id', isSuperAdmin, nationalController.deleteMember);
router.patch('/members/:id/toggle-status', checkPermission('members', 'edit'), nationalController.toggleMemberStatus);
router.post('/members/:id/approve-fee', checkPermission('members', 'edit'), nationalController.approveFee);
router.post('/members/:id/generate-sin', checkPermission('members', 'edit'), nationalController.generateSIN);
router.post('/members/:id/approve-payment', checkPermission('members', 'edit'), nationalController.approvePayment);

// Send Scout ID PDF to Email
router.post('/members/:id/send-scout-id-pdf', checkPermission('members', 'edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { pdfBase64 } = req.body;

    console.log(`📧 Sending Scout ID PDF for member ${id}`);

    if (!pdfBase64) {
      return res.status(400).json({
        success: false,
        message: 'PDF data is required'
      });
    }

    const member = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    if (!member.user || !member.user.email) {
      return res.status(400).json({
        success: false,
        message: 'Member does not have an email address'
      });
    }

    console.log(`📧 Sending email to: ${member.user.email}`);

    const emailResult = await sendScoutIDCardPDF(member, pdfBase64);

    res.json({
      success: true,
      message: 'Scout ID Card sent to email successfully',
      emailResult: {
        sent: true,
        to: member.user.email
      }
    });

  } catch (error) {
    console.error('❌ Send Scout ID PDF error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to send email: ' + error.message,
      error: error.message
    });
  }
});

// ============================================
// LEADER MANAGEMENT - ONLY SUPER ADMIN
// ============================================
router.get('/leaders', nationalController.getLeaders);
router.post('/leaders', isSuperAdmin, nationalController.createLeader);
router.put('/leaders/:id', isSuperAdmin, nationalController.updateLeader);
router.delete('/leaders/:id', isSuperAdmin, nationalController.deleteLeader);

// Existing route - DO NOT REMOVE
router.patch('/leaders/:id/toggle-status', isSuperAdmin, nationalController.toggleLeaderStatus);

// ✅ ADDED: Compatible with ManageLeaders.jsx
// Frontend uses: PUT /national/leaders/:id/status
router.put('/leaders/:id/status', isSuperAdmin, nationalController.toggleLeaderStatus);

router.put('/leaders/:id/permissions', isSuperAdmin, nationalController.updatePermissions);

// ============================================
// EVENT ROUTES
// ============================================
router.get('/events', checkPermission('events', 'view'), nationalController.getEvents);
router.post('/events', checkPermission('events', 'create'), nationalController.createEvent);
router.get('/events/:id', checkPermission('events', 'view'), nationalController.getEventById);
router.put('/events/:id', checkPermission('events', 'edit'), nationalController.updateEvent);
router.delete('/events/:id', isSuperAdmin, nationalController.deleteEvent);
router.get('/events/:id/registrations', checkPermission('events', 'view'), nationalController.getEventRegistrations);

// ============================================
// REGISTRATION ROUTES
// ============================================
router.get('/registrations/all', checkPermission('events', 'view'), nationalController.getAllRegistrations);
router.get('/registrations/pending', checkPermission('events', 'view'), nationalController.getPendingRegistrations);
router.put('/registrations/:id/approve', checkPermission('events', 'edit'), nationalController.approveRegistration);
router.put('/registrations/:id/reject', checkPermission('events', 'edit'), nationalController.rejectRegistration);
router.put('/registrations/:id/attended', checkPermission('events', 'manage_attendance'), nationalController.markAttended);
router.put('/registrations/:id/cancel', checkPermission('events', 'edit'), nationalController.cancelRegistration);
router.post('/registrations/:id/certificate', checkPermission('events', 'edit'), nationalController.issueCertificate);

// ============================================
// DONATION ROUTES
// ============================================
router.get('/donations', checkPermission('donations', 'view'), nationalController.getDonations);
router.post('/donations', checkPermission('donations', 'create'), nationalController.createDonation);
router.put('/donations/:id/status', checkPermission('donations', 'edit'), nationalController.updateDonationStatus);
router.delete('/donations/:id', isSuperAdmin, nationalController.deleteDonation);

// ============================================
// ATTENDANCE ROUTES
// ============================================
router.get('/attendance/:eventId', checkPermission('events', 'manage_attendance'), nationalController.getAttendance);
router.post('/attendance/generate-link/:eventId', checkPermission('events', 'manage_attendance'), nationalController.generateAttendanceLink);
router.post('/attendance/mark/:eventId/:memberId', checkPermission('events', 'manage_attendance'), nationalController.markAttendance);

// ============================================
// ATTENDANCE LINK ROUTES - NATIONAL
// ============================================
router.post('/attendance/generate-link/:eventId', nationalController.generateAttendanceLink);
router.get('/attendance/:eventId', nationalController.getAttendance);
router.post('/attendance/mark/:eventId/:memberId', nationalController.markAttendance);

// ============================================
// REPORT ROUTES - ✅ UPDATED to allow donors
// ============================================

// ✅ Allow ALL authenticated users (including donors) to view reports
// The controller filters based on role (donors see only forwarded)
router.get('/reports', nationalController.getReports);

// ✅ Allow ALL authenticated users to view single report
router.get('/reports/:id', nationalController.getReportById);

// ✅ National Commissioner only actions
router.put(
  '/reports/:id/approve',
  checkPermission('reports', 'approve'),
  nationalController.approveReport
);

router.put(
  '/reports/:id/reject',
  checkPermission('reports', 'approve'),
  nationalController.rejectReport
);

router.post(
  '/reports/:id/publish',
  checkPermission('reports', 'edit'),
  nationalController.publishReport
);

router.put(
  '/reports/:id/archive',
  checkPermission('reports', 'edit'),
  nationalController.archiveReport
);

router.delete(
  '/reports/:id',
  isSuperAdmin,
  nationalController.deleteReport
);

router.put(
  '/reports/:id',
  checkPermission('reports', 'edit'),
  nationalController.updateReport
);

router.post(
  '/reports/:id/resend',
  checkPermission('reports', 'edit'),
  nationalController.resendReport
);

// ✅ Forward to donors - National Commissioner only
router.post(
  '/reports/:id/forward-to-donors',
  checkPermission('reports', 'edit'),
  nationalController.forwardToDonors
);

// ============================================
// PROJECT ROUTES - COMPLETE
// ============================================
router.get('/projects', checkPermission('projects', 'view'), nationalController.getProjects);
router.get('/projects/:id', checkPermission('projects', 'view'), nationalController.getProjectById);
router.put('/projects/:id/approve', checkPermission('projects', 'approve'), nationalController.approveProject);
router.put('/projects/:id/reject', checkPermission('projects', 'approve'), nationalController.rejectProject);
router.put('/projects/:id/archive', checkPermission('projects', 'edit'), nationalController.archiveProject);
router.put('/projects/:id/publish', checkPermission('projects', 'edit'), nationalController.publishProject);
router.delete('/projects/:id', isSuperAdmin, nationalController.deleteProject);

// ============================================
// IDEA ROUTES - FIXED (National Commissioner)
// ============================================
router.get(
  '/ideas',
  checkPermission('reports', 'view'),
  nationalController.getNationalIdeas
);

router.get(
  '/ideas/:id',
  checkPermission('reports', 'view'),
  nationalController.getNationalIdea
);

router.put(
  '/ideas/:id/review',
  checkPermission('reports', 'approve'),
  nationalController.reviewNationalIdea
);

router.put(
  '/ideas/:id/status',
  checkPermission('reports', 'approve'),
  nationalController.updateIdeaStatus
);

router.post(
  '/ideas/:id/forward',
  checkPermission('reports', 'edit'),
  nationalController.forwardIdea
);

router.delete(
  '/ideas/:id',
  isSuperAdmin,
  nationalController.deleteNationalIdea
);

// ============================================
// COURSE ROUTES
// ============================================
router.get('/courses', checkPermission('courses', 'view'), nationalController.getCourses);
router.post('/courses', checkPermission('courses', 'create'), nationalController.createCourse);
router.put('/courses/:id', checkPermission('courses', 'edit'), nationalController.updateCourse);
router.delete('/courses/:id', isSuperAdmin, nationalController.deleteCourse);
router.get('/courses/:id/learners', checkPermission('courses', 'view'), nationalController.getCourseLearners);

// ============================================
// ANNOUNCEMENT ROUTES - ✅ UPDATED to allow donors
// ============================================

// ✅ Allow ALL authenticated users (including donors) to view announcements
// The controller filters based on role (donors see only published)
router.get('/announcements', nationalController.getAnnouncements);

// ✅ National Commissioner only actions
router.post(
  '/announcements',
  checkPermission('announcements', 'create'),
  nationalController.createAnnouncement
);

router.put(
  '/announcements/:id',
  checkPermission('announcements', 'edit'),
  nationalController.updateAnnouncement
);

router.delete(
  '/announcements/:id',
  isSuperAdmin,
  nationalController.deleteAnnouncement
);

// ============================================
// STATISTICS ROUTES
// ============================================
router.get(
  '/statistics',
  checkPermission('statistics', 'view'),
  nationalController.getStatistics
);

router.get(
  '/statistics/export',
  checkPermission('statistics', 'export'),
  nationalController.exportStatistics
);

// ============================================
// DISTRICT ROUTES
// ============================================
router.get(
  '/districts',
  checkPermission('settings', 'view'),
  nationalController.getDistricts
);

console.log('✅ National routes loaded successfully');

module.exports = router;