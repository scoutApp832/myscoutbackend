// backend/src/routes/newsRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { News, User, Notification } = require('../models');
const { protect, isNationalCommissioner } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

// ============================================
// MULTER CONFIGURATION FOR NEWS IMAGES
// ============================================

// Ensure uploads/news directory exists
const uploadDir = path.join(__dirname, '../../uploads/news');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created news upload directory');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `news-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.'),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter
});

// ============================================
// CLOUDINARY / IMAGE HELPERS
// ============================================

/**
 * Get Cloudinary public_id from a Cloudinary secure URL.
 *
 * Example:
 * https://res.cloudinary.com/cloud/image/upload/v123/msr/news/news-image.jpg
 *
 * Returns:
 * msr/news/news-image
 */
const getCloudinaryPublicId = (imageUrl) => {
  if (!imageUrl || !imageUrl.includes('/upload/')) {
    return null;
  }

  try {
    const uploadPart = imageUrl.split('/upload/')[1];

    if (!uploadPart) {
      return null;
    }

    // Remove version such as v1234567890/
    const withoutVersion = uploadPart.replace(/^v\d+\//, '');

    // Remove file extension
    return withoutVersion.replace(/\.[^/.]+$/, '');
  } catch (error) {
    console.warn(
      'Could not determine Cloudinary public ID:',
      error.message
    );
    return null;
  }
};

/**
 * Delete an existing news image.
 *
 * Supports both:
 * 1. Old local images: /uploads/news/filename.jpg
 * 2. New Cloudinary images: https://res.cloudinary.com/...
 */
const deleteStoredImage = async (imageUrl) => {
  if (!imageUrl) {
    return;
  }

  // ============================================
  // CLOUDINARY IMAGE
  // ============================================

  if (imageUrl.includes('res.cloudinary.com')) {
    const publicId = getCloudinaryPublicId(imageUrl);

    if (!publicId) {
      console.warn(
        'Could not determine Cloudinary public ID for image:',
        imageUrl
      );
      return;
    }

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true
      });

      console.log(`☁️ Deleted Cloudinary image: ${publicId}`);
    } catch (error) {
      console.warn(
        'Could not delete Cloudinary image:',
        error.message
      );
    }

    return;
  }

  // ============================================
  // OLD LOCAL IMAGE
  // ============================================

  if (imageUrl.startsWith('/uploads/')) {
    const imagePath = path.join(__dirname, '../../', imageUrl);

    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        console.log(`🗑️ Deleted local image: ${imagePath}`);
      } catch (error) {
        console.warn(
          'Could not delete local image:',
          error.message
        );
      }
    }
  }
};

/**
 * Upload a Multer temporary file to Cloudinary.
 */
const uploadNewsImageToCloudinary = async (filePath) => {
  const uploadResult = await cloudinary.uploader.upload(filePath, {
    folder: 'msr/news',
    resource_type: 'image'
  });

  return uploadResult.secure_url;
};

/**
 * Remove a temporary Multer file.
 */
const removeTemporaryFile = (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(
      'Could not remove temporary news image:',
      error.message
    );
  }
};

// ============================================
// ADMIN NEWS ROUTES
// ============================================

/**
 * GET /api/admin/news
 * Get all news articles
 * Access: Admin only (Super Admin or National Commissioner)
 */
router.get('/', protect, isNationalCommissioner, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereCondition = {};

    if (search) {
      whereCondition[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } },
        { excerpt: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (category && category !== 'all') {
      whereCondition.category = category;
    }

    if (status && status !== 'all') {
      whereCondition.status = status;
    }

    const { count, rows: news } = await News.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder]],
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    res.status(200).json({
      success: true,
      news: news,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch news',
      error: error.message,
      news: []
    });
  }
});

/**
 * GET /api/admin/news/:id
 * Get single news article
 * Access: Admin only (Super Admin or National Commissioner)
 */
router.get('/:id', protect, isNationalCommissioner, async (req, res) => {
  try {
    const { id } = req.params;

    const article = await News.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    res.status(200).json({
      success: true,
      news: article
    });

  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/news
 * Create new news article
 * Access: Admin only (Super Admin or National Commissioner)
 */
router.post(
  '/',
  protect,
  isNationalCommissioner,
  upload.single('image'),
  async (req, res) => {
    try {
      const { title, content, excerpt, category, status } = req.body;

      if (!title || !content) {
        if (req.file) {
          removeTemporaryFile(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: 'Title and content are required'
        });
      }

      // ============================================
      // UPLOAD NEWS IMAGE TO CLOUDINARY
      // ============================================

      let imageUrl = null;

      if (req.file) {
        try {
          imageUrl = await uploadNewsImageToCloudinary(req.file.path);

          console.log('☁️ News image uploaded to Cloudinary');

        } finally {
          // Multer file is only temporary.
          removeTemporaryFile(req.file.path);
        }
      }

      const finalExcerpt = excerpt || content.substring(0, 200);

      const article = await News.create({
        title: title.trim(),
        content: content.trim(),
        excerpt: finalExcerpt.trim(),
        category: category || 'General',
        status: status || 'draft',
        image_url: imageUrl,
        author_id: req.user.id,
        published_at: status === 'published' ? new Date() : null
      });

      if (status === 'published') {
        try {
          await Notification.create({
            user_id: req.user.id,
            title: '📰 New News Published',
            message: `News "${title}" has been published by ${req.user.full_name}`,
            type: 'news',
            priority: 'low',
            is_read: false
          });
        } catch (notifError) {
          console.warn(
            'Could not create notification:',
            notifError.message
          );
        }
      }

      const createdArticle = await News.findByPk(article.id, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'full_name', 'email']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'News created successfully',
        news: createdArticle
      });

    } catch (error) {
      if (req.file) {
        removeTemporaryFile(req.file.path);
      }

      console.error('Error creating news:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create news',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/admin/news/:id
 * Update news article
 * Access: Admin only (Super Admin or National Commissioner)
 */
router.put(
  '/:id',
  protect,
  isNationalCommissioner,
  upload.single('image'),
  async (req, res) => {
    let newCloudinaryImageUrl = null;

    try {
      const { id } = req.params;
      const { title, content, excerpt, category, status } = req.body;

      const article = await News.findByPk(id);

      if (!article) {
        if (req.file) {
          removeTemporaryFile(req.file.path);
        }

        return res.status(404).json({
          success: false,
          message: 'News article not found'
        });
      }

      // Keep the existing image unless a new image is uploaded.
      const oldImageUrl = article.image_url;
      let imageUrl = oldImageUrl;

      // ============================================
      // UPLOAD NEW IMAGE TO CLOUDINARY
      // ============================================

      if (req.file) {
        try {
          newCloudinaryImageUrl =
            await uploadNewsImageToCloudinary(req.file.path);

          imageUrl = newCloudinaryImageUrl;

          console.log('☁️ Updated news image uploaded to Cloudinary');

        } finally {
          removeTemporaryFile(req.file.path);
        }
      }

      const oldStatus = article.status;
      const oldTitle = article.title;

      await article.update({
        title: title !== undefined ? title.trim() : article.title,
        content: content !== undefined ? content.trim() : article.content,
        excerpt: excerpt !== undefined ? excerpt.trim() : article.excerpt,
        category: category !== undefined ? category : article.category,
        status: status !== undefined ? status : article.status,
        image_url: imageUrl,
        published_at:
          status === 'published' && oldStatus !== 'published'
            ? new Date()
            : article.published_at,
        updated_at: new Date()
      });

      // ============================================
      // DELETE OLD IMAGE ONLY AFTER DATABASE UPDATE
      // ============================================

      if (req.file && oldImageUrl && oldImageUrl !== imageUrl) {
        await deleteStoredImage(oldImageUrl);
      }

      if (status === 'published' && oldStatus !== 'published') {
        try {
          await Notification.create({
            user_id: req.user.id,
            title: '📰 News Published',
            message: `News "${title || oldTitle}" has been published by ${req.user.full_name}`,
            type: 'news',
            priority: 'low',
            is_read: false
          });
        } catch (notifError) {
          console.warn(
            'Could not create notification:',
            notifError.message
          );
        }
      }

      const updatedArticle = await News.findByPk(id, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'full_name', 'email']
          }
        ]
      });

      res.status(200).json({
        success: true,
        message: 'News updated successfully',
        news: updatedArticle
      });

    } catch (error) {
      if (req.file) {
        removeTemporaryFile(req.file.path);
      }

      // If Cloudinary upload succeeded but the database update failed,
      // remove the newly uploaded image so it does not remain unused.
      if (newCloudinaryImageUrl) {
        try {
          await deleteStoredImage(newCloudinaryImageUrl);
        } catch (cleanupError) {
          console.warn(
            'Could not clean up new Cloudinary image:',
            cleanupError.message
          );
        }
      }

      console.error('Error updating news:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update news',
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/admin/news/:id
 * Delete news article
 * Access: Admin only (Super Admin or National Commissioner)
 */
router.delete('/:id', protect, isNationalCommissioner, async (req, res) => {
  try {
    const { id } = req.params;

    const article = await News.findByPk(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    // ============================================
    // DELETE STORED IMAGE
    // Supports Cloudinary + old local images
    // ============================================

    if (article.image_url) {
      await deleteStoredImage(article.image_url);
    }

    await article.destroy();

    res.status(200).json({
      success: true,
      message: 'News deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete news',
      error: error.message
    });
  }
});

/**
 * PATCH /api/admin/news/:id/status
 * Update news status
 * Access: Admin only (Super Admin or National Commissioner)
 */
router.patch(
  '/:id/status',
  protect,
  isNationalCommissioner,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['published', 'draft'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be "published" or "draft"'
        });
      }

      const article = await News.findByPk(id);

      if (!article) {
        return res.status(404).json({
          success: false,
          message: 'News article not found'
        });
      }

      const oldStatus = article.status;
      const oldTitle = article.title;

      await article.update({
        status: status,
        published_at: status === 'published' ? new Date() : null,
        updated_at: new Date()
      });

      if (status === 'published' && oldStatus !== 'published') {
        try {
          await Notification.create({
            user_id: req.user.id,
            title: '📰 News Published',
            message: `News "${oldTitle}" has been published by ${req.user.full_name}`,
            type: 'news',
            priority: 'low',
            is_read: false
          });
        } catch (notifError) {
          console.warn(
            'Could not create notification:',
            notifError.message
          );
        }
      }

      res.status(200).json({
        success: true,
        message: `News ${
          status === 'published' ? 'published' : 'moved to draft'
        } successfully`,
        status: status
      });

    } catch (error) {
      console.error('Error updating news status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update news status',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/admin/news/bulk-delete
 * Bulk delete news articles
 * Access: Admin only (Super Admin or National Commissioner)
 */
router.post(
  '/bulk-delete',
  protect,
  isNationalCommissioner,
  async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No news IDs provided'
        });
      }

      const articles = await News.findAll({
        where: { id: ids }
      });

      // ============================================
      // DELETE IMAGES
      // Supports Cloudinary + old local images
      // ============================================

      for (const article of articles) {
        if (article.image_url) {
          await deleteStoredImage(article.image_url);
        }
      }

      await News.destroy({
        where: { id: ids }
      });

      res.status(200).json({
        success: true,
        message: `${ids.length} news articles deleted successfully`
      });

    } catch (error) {
      console.error('Error bulk deleting news:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete news articles',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/admin/news/stats
 * Get news statistics
 * Access: Admin only (Super Admin or National Commissioner)
 */
router.get('/stats', protect, isNationalCommissioner, async (req, res) => {
  try {
    const total = await News.count();

    const published = await News.count({
      where: { status: 'published' }
    });

    const drafts = await News.count({
      where: { status: 'draft' }
    });

    const categories = await News.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category']
    });

    res.status(200).json({
      success: true,
      stats: {
        total,
        published,
        drafts,
        categories: categories.map(c => ({
          name: c.category || 'Uncategorized',
          count: parseInt(c.get('count'))
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching news stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch news statistics',
      error: error.message
    });
  }
});

module.exports = router;