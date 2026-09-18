// backend/src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/chat'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}_${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  }
});

// All routes require authentication
router.use(protect);

// Get all chat members
router.get('/members', chatController.getMembers);

// Get messages with a specific user
router.get('/messages/:userId', chatController.getMessages);

// Send a message with attachments
router.post('/messages/:userId', upload.array('attachments', 5), chatController.sendMessage);

// Delete a message
router.delete('/messages/:messageId', chatController.deleteMessage);

// Mark messages as read
router.put('/messages/read/:userId', chatController.markAsRead);

// Get unread message count
router.get('/unread', chatController.getUnreadCount);

// Get recent chats
router.get('/recent', chatController.getRecentChats);

module.exports = router;