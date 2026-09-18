const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes (authenticated)
router.get('/events', authenticate, eventController.getEvents);
router.get('/events/:id', authenticate, eventController.getEventById);

// Scout routes
router.post('/events/:id/register', authenticate, authorize('scout', 'unit_leader'), eventController.registerForEvent);
router.delete('/events/:id/cancel', authenticate, authorize('scout', 'unit_leader'), eventController.cancelRegistration);

// Management routes
router.post('/events', authenticate, authorize('national_commissioner', 'district_commissioner'), eventController.createEvent);
router.put('/events/:id', authenticate, authorize('national_commissioner', 'district_commissioner'), eventController.updateEvent);
router.delete('/events/:id', authenticate, authorize('national_commissioner', 'district_commissioner'), eventController.deleteEvent);
router.put('/events/registrations/:registrationId/approve', authenticate, authorize('national_commissioner', 'district_commissioner'), eventController.approveRegistration);

module.exports = router;