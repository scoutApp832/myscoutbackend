const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

router.get('/statistics', authorize('national_commissioner'), statisticsController.getStatistics);
router.get('/statistics/export', authorize('national_commissioner'), statisticsController.exportStatistics);

module.exports = router;