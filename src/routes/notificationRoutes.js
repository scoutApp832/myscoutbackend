const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// ✅ All routes are protected
router.use(authenticate);

// ============================================
// NOTIFICATION ROUTES
// ============================================

// Get notifications
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark as read (UUID id)
router.put('/:id/read', notificationController.markAsRead);

// Mark all as read
router.put('/read-all', notificationController.markAllAsRead);

// Delete notification (UUID id)
router.delete('/:id', notificationController.deleteNotification);

console.log('✅ Notification routes loaded');

module.exports = router;