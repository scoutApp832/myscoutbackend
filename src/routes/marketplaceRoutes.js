// backend/src/routes/marketplaceRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const marketplaceController = require('../controllers/marketplaceController');

// ✅ USE EXISTING AUTH MIDDLEWARE
const { protect, isSuperAdmin } = require('../middleware/auth');

// ============================================
// MULTER CONFIGURATION FOR IMAGE UPLOADS
// ============================================

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Get all products
router.get('/public/products', marketplaceController.getPublicProducts);

// Get single product
router.get('/public/products/:id', marketplaceController.getPublicProductById);

// Get categories
router.get('/public/categories', marketplaceController.getPublicCategories);

// Submit contact form
router.post('/public/contact', marketplaceController.submitContact);

// ============================================
// ADMIN ROUTES (Authentication + Super Admin required)
// ============================================

// Product Management
router.get('/admin/products', protect, isSuperAdmin, marketplaceController.getAdminProducts);
router.get('/admin/products/:id', protect, isSuperAdmin, marketplaceController.getAdminProductById);
router.post('/admin/products', protect, isSuperAdmin, marketplaceController.createProduct);
router.put('/admin/products/:id', protect, isSuperAdmin, marketplaceController.updateProduct);
router.delete('/admin/products/:id', protect, isSuperAdmin, marketplaceController.deleteProduct);

// Product Image Upload
router.post(
  '/admin/products/:id/image',
  protect,
  isSuperAdmin,
  upload.single('image'),
  marketplaceController.uploadProductImage
);

// Bulk Operations
router.post('/admin/products/bulk-delete', protect, isSuperAdmin, marketplaceController.bulkDeleteProducts);
router.post('/admin/products/bulk-update-stock', protect, isSuperAdmin, marketplaceController.bulkUpdateStock);

// Message Management
router.get('/admin/messages', protect, isSuperAdmin, marketplaceController.getMessages);
router.get('/admin/messages/:id', protect, isSuperAdmin, marketplaceController.getMessageById);
router.put('/admin/messages/:id/read', protect, isSuperAdmin, marketplaceController.markMessageRead);
router.put('/admin/messages/:id/replied', protect, isSuperAdmin, marketplaceController.markMessageReplied);
router.delete('/admin/messages/:id', protect, isSuperAdmin, marketplaceController.deleteMessage);
router.post('/admin/messages/bulk-delete', protect, isSuperAdmin, marketplaceController.bulkDeleteMessages);

module.exports = router;