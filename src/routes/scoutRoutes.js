const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const scoutController = require('../controllers/scoutController');
const { upload, uploadAvatar, uploadDocument } = require('../config/upload');

// ✅ All routes are protected
router.use(protect);

// ============================================
// PROFILE ROUTES
// ============================================
router.get('/profile', scoutController.getProfile);
router.put('/profile', scoutController.updateProfile);
router.post('/profile/avatar', uploadAvatar.single('avatar'), scoutController.uploadAvatar);
router.put('/change-password', scoutController.changePassword);

// ============================================
// EVENT ROUTES
// ============================================
router.get('/events/upcoming', scoutController.getUpcomingEvents);
router.get('/events', scoutController.getEvents);
router.get('/events/:id', scoutController.getEventById);
router.post('/events/:id/register', scoutController.registerForEvent);
router.delete('/events/:id/register', scoutController.cancelRegistration);

// ============================================
// COURSE ROUTES
// ============================================
router.get('/courses', scoutController.getCourses);
router.get('/courses/available', scoutController.getAvailableCourses);
router.post('/courses/:id/enroll', scoutController.enrollInCourse);
router.get('/courses/:courseId/enrollments', scoutController.getCourseEnrollments);
router.get('/courses/:courseId/statistics', scoutController.getCourseStatistics);
router.get('/courses/my-enrollments', scoutController.getMyEnrollments);
router.put('/enrollments/:enrollmentId/progress', scoutController.updateEnrollmentProgress);
router.get('/courses/:courseId/topics', scoutController.getCourseTopics);
router.get('/courses/:courseId/progress', scoutController.getCourseProgress);

// ============================================
// IDEA ROUTES
// ============================================
router.get('/ideas', scoutController.getIdeas);
router.post('/ideas', scoutController.createIdea);
router.put('/ideas/:id', scoutController.updateIdea);
router.delete('/ideas/:id', scoutController.deleteIdea);

// ============================================
// PROJECT ROUTES
// ============================================
router.post('/projects', uploadDocument.single('document'), scoutController.createProject);
router.get('/projects', scoutController.getProjects);
router.get('/projects/:id', scoutController.getProjectById);
router.put('/projects/:id', scoutController.updateProject);
router.delete('/projects/:id', scoutController.deleteProject);

// ============================================
// REPORT ROUTES
// ============================================
router.post('/reports', scoutController.submitReport);
router.get('/reports', scoutController.getReports);
router.get('/reports/:id', scoutController.getReportById);

// ============================================
// ✅ ANNOUNCEMENT ROUTES (ONLY)
// ============================================

// ✅ GET announcements for scouts
router.get('/announcements', scoutController.getAnnouncements);

// ✅ POST create announcement (if commissioners need to create from scout side)
// router.post('/announcements', scoutController.createAnnouncement);

// ============================================
// DASHBOARD ROUTES
// ============================================
router.get('/dashboard', scoutController.getDashboard);
router.get('/dashboard/stats', scoutController.getStats);
router.get('/dashboard/recent-activities', scoutController.getRecentActivities);
router.get('/dashboard/upcoming-events', scoutController.getUpcomingEvents);

// ============================================
// ATTENDANCE ROUTES
// ============================================
router.get('/attendance/history', scoutController.getAttendanceHistory);
router.get('/attendance/recent', scoutController.getRecentAttendance);
router.get('/attendance/upcoming', scoutController.getUpcomingEventsWithAttendance);

module.exports = router;