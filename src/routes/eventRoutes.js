const express = require('express');

const router = express.Router();

const eventController = require('../controllers/eventController');

const { authenticate, authorize } = require('../middleware/auth');

const { uploadSingle } = require('../middleware/upload');

// =====================================================
// Event viewing
// =====================================================

// Get all events
router.get(
  '/events',
  authenticate,
  eventController.getEvents
);

// Get one event
router.get(
  '/events/:id',
  authenticate,
  eventController.getEventById
);

// =====================================================
// Event registration — Scout / Unit Leader
// =====================================================

// Register for an event
router.post(
  '/events/:id/register',
  authenticate,
  authorize('scout', 'unit_leader'),
  eventController.registerForEvent
);

// Cancel event registration
router.delete(
  '/events/:id/cancel',
  authenticate,
  authorize('scout', 'unit_leader'),
  eventController.cancelRegistration
);

// =====================================================
// Event management — National / District
// =====================================================

// Create event
router.post(
  '/events',
  authenticate,
  authorize('national_commissioner', 'district_commissioner'),
  uploadSingle('photo'),
  eventController.createEvent
);

// Update event
router.put(
  '/events/:id',
  authenticate,
  authorize('national_commissioner', 'district_commissioner'),
  eventController.updateEvent
);

// Cancel event
router.put(
  '/events/:id/cancel-event',
  authenticate,
  authorize('national_commissioner', 'district_commissioner'),
  eventController.cancelEvent
);

// Delete event permanently
router.delete(
  '/events/:id',
  authenticate,
  authorize('national_commissioner', 'district_commissioner'),
  eventController.deleteEvent
);

// =====================================================
// Registration management — National / District
// =====================================================

// Approve registration
router.put(
  '/events/registrations/:registrationId/approve',
  authenticate,
  authorize('national_commissioner', 'district_commissioner'),
  eventController.approveRegistration
);

module.exports = router;