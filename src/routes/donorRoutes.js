// backend/src/routes/donationRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const donationController = require('../controllers/donationController');

console.log('📦 Loading donationRoutes.js...');

// ============================================
// All routes require authentication
// ============================================
router.use(protect);

// ============================================
// DONOR DASHBOARD ROUTES
// ============================================

// GET /api/donation/dashboard/stats
router.get('/dashboard/stats', donationController.getDonationStats);

// GET /api/donation/dashboard/recent-donations
router.get('/dashboard/recent-donations', donationController.getDonations);

// GET /api/donation/dashboard/active-projects
router.get('/dashboard/active-projects', donationController.getProjects);

// GET /api/donation/dashboard/updates
router.get('/dashboard/updates', donationController.getUpdates);

// GET /api/donation/dashboard/chart-data
router.get('/dashboard/chart-data', (req, res) => {
  console.log('📥 GET /dashboard/chart-data called');
  res.json([
    { month: 'Jan', amount: 0 },
    { month: 'Feb', amount: 0 },
    { month: 'Mar', amount: 0 },
    { month: 'Apr', amount: 0 },
    { month: 'May', amount: 0 },
    { month: 'Jun', amount: 0 }
  ]);
});

// GET /api/donation/dashboard/ideals
router.get('/dashboard/ideals', donationController.getIdeas);

// GET /api/donation/dashboard/events
router.get('/dashboard/events', donationController.getEvents);

// ============================================
// MAIN DONATION ROUTES
// ============================================

// GET /api/donation/donations
router.get('/donations', donationController.getDonations);

// GET /api/donation/projects
router.get('/projects', donationController.getProjects);

// GET /api/donation/projects/all
router.get('/projects/all', donationController.getProjects);

// GET /api/donation/ideas
router.get('/ideas', donationController.getIdeas);

// POST /api/donation/ideas
router.post('/ideas', donationController.createIdea);

// GET /api/donation/events
router.get('/events', donationController.getEvents);

// GET /api/donation/updates
router.get('/updates', donationController.getUpdates);

// GET /api/donation/stats
router.get('/stats', donationController.getDonationStats);

// POST /api/donation/donate
router.post('/donate', donationController.donate);

console.log('✅ Donation routes registered:');
console.log('  ✅ GET  /donations');
console.log('  ✅ GET  /projects');
console.log('  ✅ GET  /projects/all');
console.log('  ✅ GET  /ideas');
console.log('  ✅ POST /ideas');
console.log('  ✅ GET  /events');
console.log('  ✅ GET  /updates');
console.log('  ✅ GET  /stats');
console.log('  ✅ POST /donate');
console.log('  ✅ GET  /dashboard/stats');
console.log('  ✅ GET  /dashboard/recent-donations');
console.log('  ✅ GET  /dashboard/active-projects');
console.log('  ✅ GET  /dashboard/updates');
console.log('  ✅ GET  /dashboard/chart-data');
console.log('  ✅ GET  /dashboard/ideals');
console.log('  ✅ GET  /dashboard/events');

module.exports = router;