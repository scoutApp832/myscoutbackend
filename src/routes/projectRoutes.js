const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Scout routes
router.post('/projects', authorize('scout', 'unit_leader'), projectController.createProject);
router.get('/projects', authorize('scout', 'unit_leader', 'national_commissioner'), projectController.getProjects);
router.get('/projects/:id', authorize('scout', 'unit_leader', 'national_commissioner'), projectController.getProjectById);

// Management routes
router.put('/projects/:id', authorize('national_commissioner'), projectController.updateProject);
router.delete('/projects/:id', authorize('national_commissioner'), projectController.deleteProject);
router.put('/projects/:id/approve', authorize('national_commissioner'), projectController.approveProject);
router.put('/projects/:id/reject', authorize('national_commissioner'), projectController.rejectProject);

module.exports = router;