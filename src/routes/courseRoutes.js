// src/routes/courseRoutes.js
const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { authenticate, authorize, checkPermission, hasAnyPermission } = require('../middleware/auth');

// ============================================
// ✅ All routes require authentication
// ============================================
router.use(authenticate);
router.use(hasAnyPermission); // ✅ Blocks users with 0 permissions

// ============================================
// ✅ SPECIFIC ROUTES FIRST (must come before parameterized routes)
// ============================================
router.get('/courses/enrolled', authorize('scout', 'unit_leader'), courseController.getEnrolledCourses);
router.get('/courses/stats', checkPermission('courses', 'view'), courseController.getCourseStats);

// ============================================
// ✅ PUBLIC COURSE ROUTES (All authenticated users with any permission)
// ============================================
router.get('/courses', courseController.getCourses);
router.get('/courses/:id', courseController.getCourseById);

// ============================================
// ✅ SCOUT ROUTES (scout and unit_leader)
// ============================================
router.post('/courses/:id/enroll', authorize('scout', 'unit_leader'), courseController.enrollCourse);
router.get('/courses/:id/progress', authorize('scout', 'unit_leader'), courseController.getCourseProgress);
router.post('/courses/:id/progress', authorize('scout', 'unit_leader'), courseController.updateProgress);
router.get('/courses/:id/topics', authorize('scout', 'unit_leader'), courseController.getCourseTopics);

// ============================================
// ✅ TOPIC MANAGEMENT ROUTES - With permission checks
// ============================================
router.post('/courses/:courseId/topics', checkPermission('courses', 'edit'), courseController.createTopic);
router.put('/topics/:id', checkPermission('courses', 'edit'), courseController.updateTopic);
router.delete('/topics/:id', checkPermission('courses', 'edit'), courseController.deleteTopic);

// ============================================
// ✅ MATERIAL MANAGEMENT ROUTES - With permission checks
// ============================================
router.post('/topics/:topicId/materials', checkPermission('courses', 'edit'), courseController.createMaterial);
router.put('/materials/:id', checkPermission('courses', 'edit'), courseController.updateMaterial);
router.delete('/materials/:id', checkPermission('courses', 'edit'), courseController.deleteMaterial);

// ============================================
// ✅ ASSESSMENT MANAGEMENT ROUTES - With permission checks
// ============================================
router.post('/courses/:courseId/assessments', checkPermission('courses', 'edit'), courseController.createAssessment);
router.delete('/assessments/:id', checkPermission('courses', 'edit'), courseController.deleteAssessment);
router.put('/assessments/:id', checkPermission('courses', 'edit'), courseController.updateAssessment);

// ============================================
// ✅ ASSESSMENT SUBMISSION ROUTES (Scouts)
// ============================================
router.post('/assessments/:id/submit', authorize('scout', 'unit_leader'), courseController.submitAssessment);
router.get('/assessments/:id/results', authorize('scout', 'unit_leader'), courseController.getAssessmentResults);

// ✅ 🔥 ADD THIS MISSING ROUTE 🔥
router.get('/assessments/:id/info', authorize('scout', 'unit_leader'), courseController.getAssessmentInfo);

// ============================================
// ✅ COURSE MANAGEMENT ROUTES - With permission checks
// ============================================
router.post('/courses', checkPermission('courses', 'create'), courseController.createCourse);
router.put('/courses/:id', checkPermission('courses', 'edit'), courseController.updateCourse);
router.delete('/courses/:id', checkPermission('courses', 'delete'), courseController.deleteCourse);

console.log('✅ Course routes loaded successfully');

module.exports = router;