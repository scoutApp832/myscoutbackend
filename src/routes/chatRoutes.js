// backend/src/routes/chatRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// ============================================
// CHAT UPLOAD DIRECTORY
// ============================================

const chatUploadDir = path.join(__dirname, '../../uploads/chat');

// Create uploads/chat automatically if it does not exist
if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, {
    recursive: true
  });

  console.log(`📁 Created chat upload directory: ${chatUploadDir}`);
}

// ============================================
// MULTER STORAGE
// ============================================

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, chatUploadDir);
  },

  filename: (req, file, cb) => {

    const timestamp = Date.now();

    // Keep the original extension
    const extension = path.extname(file.originalname);

    // Remove unsafe characters from the filename
    const originalName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    cb(
      null,
      `${timestamp}_${originalName}${extension}`
    );
  }

});

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const upload = multer({

  storage: storage,

  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },

  fileFilter: (req, file, cb) => {

    const allowedTypes = [

      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',

      // PDF
      'application/pdf',

      // Word
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

      // Excel
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      // Text
      'text/plain',

      // Archives
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

// ============================================
// ALL CHAT ROUTES REQUIRE AUTHENTICATION
// ============================================

router.use(protect);

// ============================================
// GET ALL CHAT MEMBERS
// ============================================

router.get(
  '/members',
  chatController.getMembers
);

// ============================================
// GET MESSAGES WITH A SPECIFIC USER
// ============================================

router.get(
  '/messages/:userId',
  chatController.getMessages
);

// ============================================
// SEND MESSAGE WITH OPTIONAL ATTACHMENTS
// ============================================

router.post(
  '/messages/:userId',
  upload.array('attachments', 5),
  chatController.sendMessage
);

// ============================================
// DELETE MESSAGE
// ============================================

router.delete(
  '/messages/:messageId',
  chatController.deleteMessage
);

// ============================================
// MARK MESSAGES AS READ
// ============================================

router.put(
  '/messages/read/:userId',
  chatController.markAsRead
);

// ============================================
// GET UNREAD MESSAGE COUNT
// ============================================

router.get(
  '/unread',
  chatController.getUnreadCount
);

// ============================================
// GET RECENT CHATS
// ============================================

router.get(
  '/recent',
  chatController.getRecentChats
);

module.exports = router;