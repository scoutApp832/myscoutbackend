// backend/src/controllers/marketplaceController.js
const { Op } = require('sequelize');
const {
  Product,
  User,
  Notification,
  ContactSubmission,
  sequelize
} = require('../models');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');

// ============================================
// IMAGE STORAGE HELPERS
// ============================================

/**
 * Get Cloudinary public_id from a Cloudinary URL.
 *
 * Example:
 * https://res.cloudinary.com/example/image/upload/v123456/msr/products/product.jpg
 *
 * Returns:
 * msr/products/product
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

    // Remove Cloudinary version, for example v1234567890/
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
 * Delete an existing product image.
 *
 * Supports:
 * 1. Old local images: /uploads/products/filename.jpg
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

      console.log(`☁️ Deleted Cloudinary product image: ${publicId}`);
    } catch (error) {
      console.warn(
        'Could not delete Cloudinary product image:',
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

        console.log(`🗑️ Deleted local product image: ${imagePath}`);
      } catch (error) {
        console.warn(
          'Could not delete local product image:',
          error.message
        );
      }
    }
  }
};

/**
 * Upload temporary Multer file to Cloudinary.
 */
const uploadProductImageToCloudinary = async (filePath) => {
  const uploadResult = await cloudinary.uploader.upload(filePath, {
    folder: 'msr/products',
    resource_type: 'image'
  });

  return uploadResult.secure_url;
};

/**
 * Remove temporary Multer file.
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
      'Could not remove temporary product image:',
      error.message
    );
  }
};

// ============================================
// PUBLIC MARKETPLACE CONTROLLER
// ============================================

/**
 * GET /api/public/products
 * Get all products with filtering and pagination
 */
exports.getPublicProducts = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      sort = 'created_at',
      order = 'DESC',
      page = 1,
      limit = 12,
      inStock
    } = req.query;

    const offset = (page - 1) * limit;
    const whereCondition = { is_active: true };

    if (category && category !== 'all' && category !== '') {
      whereCondition.category = category;
    }

    if (minPrice || maxPrice) {
      whereCondition.price = {};

      if (minPrice) {
        whereCondition.price[Op.gte] = parseFloat(minPrice);
      }

      if (maxPrice) {
        whereCondition.price[Op.lte] = parseFloat(maxPrice);
      }
    }

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (inStock === 'true') {
      whereCondition.stock = { [Op.gt]: 0 };
    }

    let orderBy = [[sort, order]];

    if (sort === 'price-low') {
      orderBy = [['price', 'ASC']];
    } else if (sort === 'price-high') {
      orderBy = [['price', 'DESC']];
    } else if (sort === 'popular') {
      orderBy = [['views', 'DESC']];
    } else if (sort === 'name') {
      orderBy = [['name', 'ASC']];
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: orderBy,
      attributes: [
        'id',
        'name',
        'description',
        'price',
        'category',
        'stock',
        'image_url',
        'specifications',
        'views',
        'created_at'
      ]
    });

    const categoryCounts = await Product.findAll({
      where: { is_active: true },
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category'],
      having: sequelize.where(
        sequelize.fn('COUNT', sequelize.col('id')),
        '>',
        0
      )
    });

    res.status(200).json({
      success: true,
      data: {
        products,
        categories: categoryCounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching public products:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

/**
 * GET /api/public/products/:id
 * Get single product by ID
 */
exports.getPublicProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      attributes: [
        'id',
        'name',
        'description',
        'price',
        'category',
        'stock',
        'image_url',
        'specifications',
        'views',
        'is_active',
        'created_at',
        'updated_at'
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.is_active) {
      return res.status(404).json({
        success: false,
        message: 'Product is not available'
      });
    }

    await product.increment('views');

    const relatedProducts = await Product.findAll({
      where: {
        category: product.category,
        id: { [Op.ne]: id },
        is_active: true
      },
      limit: 4,
      order: [['views', 'DESC']],
      attributes: [
        'id',
        'name',
        'price',
        'image_url'
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        product,
        relatedProducts
      }
    });

  } catch (error) {
    console.error('Error fetching product:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
};

/**
 * GET /api/public/categories
 * Get all categories with counts
 */
exports.getPublicCategories = async (req, res) => {
  try {
    const categories = await Product.findAll({
      where: { is_active: true },
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('MIN', sequelize.col('price')), 'min_price'],
        [sequelize.fn('MAX', sequelize.col('price')), 'max_price']
      ],
      group: ['category'],
      having: sequelize.where(
        sequelize.fn('COUNT', sequelize.col('id')),
        '>',
        0
      ),
      order: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'DESC']
      ]
    });

    res.status(200).json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Error fetching categories:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

/**
 * POST /api/public/contact
 * Submit contact form
 */
exports.submitContact = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      subject,
      message,
      category
    } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, subject, and message are required'
      });
    }

    const submission = await ContactSubmission.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || null,
      subject: subject.trim(),
      message: message.trim(),
      category: category || 'general',
      status: 'new',
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent']
    });

    // Find admin users to notify
    const adminUsers = await User.findAll({
      where: {
        role: [
          'super_admin',
          'admin',
          'national_commissioner'
        ],
        status: 'active'
      },
      attributes: ['id']
    });

    // Create notifications for each admin
    for (const admin of adminUsers) {
      try {
        await Notification.create({
          user_id: admin.id,
          title: `📩 New Contact Form: ${subject}`,
          message:
            `From: ${name}\n` +
            `Email: ${email}\n` +
            `Phone: ${phone || 'Not provided'}\n` +
            `Category: ${category || 'General'}\n\n` +
            `Message:\n${message}`,
          type: 'contact_form',
          priority: 'high',
          is_read: false
        });
      } catch (notifError) {
        console.error(
          'Failed to create notification for admin:',
          admin.id,
          notifError.message
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Contact form submitted successfully',
      data: {
        id: submission.id
      }
    });

  } catch (error) {
    console.error('Error submitting contact:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form',
      error: error.message
    });
  }
};

// ============================================
// ADMIN MARKETPLACE CONTROLLER
// ============================================

/**
 * GET /api/admin/products
 * Get all products with admin filters
 */
exports.getAdminProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      inStock,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereCondition = {};

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (category && category !== 'all') {
      whereCondition.category = category;
    }

    if (inStock === 'true') {
      whereCondition.stock = { [Op.gt]: 0 };
    } else if (inStock === 'false') {
      whereCondition.stock = { [Op.eq]: 0 };
    }

    let order = [[sortBy, sortOrder]];

    if (sortBy === 'price') {
      order = [['price', sortOrder]];
    } else if (sortBy === 'stock') {
      order = [['stock', sortOrder]];
    } else if (sortBy === 'name') {
      order = [['name', sortOrder]];
    }

    const { count, rows: products } =
      await Product.findAndCountAll({
        where: whereCondition,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: order,
        attributes: [
          'id',
          'name',
          'description',
          'price',
          'category',
          'stock',
          'image_url',
          'specifications',
          'views',
          'is_active',
          'created_at',
          'updated_at'
        ]
      });

    const lowStockCount = await Product.count({
      where: {
        stock: { [Op.between]: [1, 4] },
        is_active: true
      }
    });

    const outOfStockCount = await Product.count({
      where: {
        stock: 0,
        is_active: true
      }
    });

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      },
      stats: {
        total: count,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount
      }
    });

  } catch (error) {
    console.error(
      'Error fetching admin products:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/products/:id
 * Get single product for admin
 */
exports.getAdminProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      attributes: [
        'id',
        'name',
        'description',
        'price',
        'category',
        'stock',
        'image_url',
        'specifications',
        'views',
        'is_active',
        'created_at',
        'updated_at'
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Error fetching product:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/products
 * Create new product
 */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      specifications,
      is_active
    } = req.body;

    if (
      !name ||
      price === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and stock are required'
      });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description || null,
      price: parseFloat(price),
      category: category || 'uncategorized',
      stock: parseInt(stock),
      specifications: specifications || {},
      is_active:
        is_active !== undefined
          ? is_active
          : true
    });

    // ✅ FIXED: Added user_id
    if (req.user) {
      await Notification.create({
        user_id: req.user.id,
        title: '✅ New Product Added',
        message:
          `Product "${name}" has been added to the marketplace.`,
        type: 'product_management',
        priority: 'low',
        is_read: false
      });
    }

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });

  } catch (error) {
    console.error('Error creating product:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/products/:id
 * Update existing product
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      price,
      category,
      stock,
      specifications,
      is_active
    } = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const oldName = product.name;

    await product.update({
      name:
        name !== undefined
          ? name.trim()
          : product.name,

      description:
        description !== undefined
          ? description
          : product.description,

      price:
        price !== undefined
          ? parseFloat(price)
          : product.price,

      category:
        category !== undefined
          ? category
          : product.category,

      stock:
        stock !== undefined
          ? parseInt(stock)
          : product.stock,

      specifications:
        specifications !== undefined
          ? specifications
          : product.specifications,

      is_active:
        is_active !== undefined
          ? is_active
          : product.is_active,

      updated_at: new Date()
    });

    // ✅ FIXED: Added user_id
    if (req.user) {
      await Notification.create({
        user_id: req.user.id,
        title: '📝 Product Updated',
        message:
          `Product "${oldName}" has been updated.`,
        type: 'product_management',
        priority: 'low',
        is_read: false
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });

  } catch (error) {
    console.error('Error updating product:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/products/:id/image
 * Upload product image
 */
exports.uploadProductImage = async (req, res) => {
  let newCloudinaryImageUrl = null;

  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const product = await Product.findByPk(id);

    if (!product) {
      removeTemporaryFile(req.file.path);

      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Keep the old image URL until the new image
    // has been successfully uploaded and saved.
    const oldImageUrl = product.image_url;

    // ============================================
    // UPLOAD NEW IMAGE TO CLOUDINARY
    // ============================================

    try {
      newCloudinaryImageUrl =
        await uploadProductImageToCloudinary(
          req.file.path
        );

      console.log(
        '☁️ Product image uploaded to Cloudinary'
      );

    } finally {
      // Multer file is temporary only.
      removeTemporaryFile(req.file.path);
    }

    // ============================================
    // UPDATE DATABASE
    // ============================================

    await product.update({
      image_url: newCloudinaryImageUrl,
      updated_at: new Date()
    });

    // ============================================
    // DELETE OLD IMAGE ONLY AFTER DATABASE UPDATE
    // ============================================

    if (
      oldImageUrl &&
      oldImageUrl !== newCloudinaryImageUrl
    ) {
      await deleteStoredImage(oldImageUrl);
    }

    // ✅ FIXED: Added user_id
    if (req.user) {
      await Notification.create({
        user_id: req.user.id,
        title: '🖼️ Product Image Updated',
        message:
          `Image for "${product.name}" has been updated.`,
        type: 'product_management',
        priority: 'low',
        is_read: false
      });
    }

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        image_url: newCloudinaryImageUrl
      }
    });

  } catch (error) {
    if (req.file) {
      removeTemporaryFile(req.file.path);
    }

    // If Cloudinary upload succeeded but the database
    // update failed, clean up the newly uploaded image.
    if (newCloudinaryImageUrl) {
      try {
        await deleteStoredImage(
          newCloudinaryImageUrl
        );
      } catch (cleanupError) {
        console.warn(
          'Could not clean up new Cloudinary image:',
          cleanupError.message
        );
      }
    }

    console.error('Error uploading image:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/products/:id
 * Delete product
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const productName = product.name;
    const imageUrl = product.image_url;

    // ============================================
    // DELETE PRODUCT IMAGE
    // Supports Cloudinary + old local images
    // ============================================

    if (imageUrl) {
      await deleteStoredImage(imageUrl);
    }

    await product.destroy();

    // ✅ FIXED: Added user_id
    if (req.user) {
      await Notification.create({
        user_id: req.user.id,
        title: '🗑️ Product Deleted',
        message:
          `Product "${productName}" has been deleted.`,
        type: 'product_management',
        priority: 'low',
        is_read: false
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/products/bulk-delete
 * Bulk delete products
 */
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (
      !ids ||
      !Array.isArray(ids) ||
      ids.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'No product IDs provided'
      });
    }

    const products = await Product.findAll({
      where: { id: ids }
    });

    const productNames = products
      .map(p => p.name)
      .join(', ');

    // ============================================
    // DELETE PRODUCT IMAGES
    // Supports Cloudinary + old local images
    // ============================================

    for (const product of products) {
      if (product.image_url) {
        await deleteStoredImage(
          product.image_url
        );
      }
    }

    await Product.destroy({
      where: { id: ids }
    });

    // ✅ FIXED: Added user_id
    if (req.user) {
      await Notification.create({
        user_id: req.user.id,
        title: '🗑️ Products Bulk Deleted',
        message:
          `${ids.length} products (${productNames}) have been deleted.`,
        type: 'product_management',
        priority: 'medium',
        is_read: false
      });
    }

    res.status(200).json({
      success: true,
      message:
        `${ids.length} products deleted successfully`
    });

  } catch (error) {
    console.error(
      'Error bulk deleting products:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to delete products',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/products/bulk-update-stock
 * Bulk update product stock
 */
exports.bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body;

    if (
      !updates ||
      !Array.isArray(updates) ||
      updates.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    const updatePromises = updates.map(
      async ({ id, stock }) => {
        const product =
          await Product.findByPk(id);

        if (product) {
          await product.update({
            stock: parseInt(stock),
            updated_at: new Date()
          });

          return {
            id,
            success: true
          };
        }

        return {
          id,
          success: false,
          error: 'Product not found'
        };
      }
    );

    const results =
      await Promise.all(updatePromises);

    const successful =
      results.filter(r => r.success).length;

    const failed =
      results.filter(r => !r.success).length;

    // ✅ FIXED: Added user_id
    if (req.user) {
      await Notification.create({
        user_id: req.user.id,
        title: '📊 Stock Updated',
        message:
          `Updated stock for ${successful} products.`,
        type: 'product_management',
        priority: 'low',
        is_read: false
      });
    }

    res.status(200).json({
      success: true,
      message:
        `Updated ${successful} products, ${failed} failed`,
      results
    });

  } catch (error) {
    console.error(
      'Error bulk updating stock:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to update stock',
      error: error.message
    });
  }
};

// ============================================
// CONTACT SUBMISSIONS CONTROLLER
// ============================================

/**
 * GET /api/admin/messages
 * Get all contact submissions
 */
exports.getMessages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereCondition = {};

    if (status && status !== 'all') {
      whereCondition.status = status;
    }

    if (search) {
      whereCondition[Op.or] = [
        {
          name: {
            [Op.iLike]: `%${search}%`
          }
        },
        {
          email: {
            [Op.iLike]: `%${search}%`
          }
        },
        {
          subject: {
            [Op.iLike]: `%${search}%`
          }
        },
        {
          message: {
            [Op.iLike]: `%${search}%`
          }
        }
      ];
    }

    const {
      count,
      rows: messages
    } = await ContactSubmission.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder]],
      include: [
        {
          model: User,
          as: 'replier',
          attributes: [
            'id',
            'full_name',
            'email'
          ]
        }
      ]
    });

    const statusCounts =
      await ContactSubmission.findAll({
        attributes: [
          'status',
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'count'
          ]
        ],
        group: ['status']
      });

    const counts = {};

    statusCounts.forEach(item => {
      counts[item.status] =
        parseInt(item.get('count'));
    });

    res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(
          count / limit
        )
      },
      stats: {
        new: counts.new || 0,
        read: counts.read || 0,
        replied: counts.replied || 0,
        archived: counts.archived || 0,
        total: count
      }
    });

  } catch (error) {
    console.error(
      'Error fetching messages:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/messages/:id
 * Get single message
 */
exports.getMessageById = async (req, res) => {
  try {
    const { id } = req.params;

    const message =
      await ContactSubmission.findByPk(id, {
        include: [
          {
            model: User,
            as: 'replier',
            attributes: [
              'id',
              'full_name',
              'email'
            ]
          }
        ]
      });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.status === 'new') {
      await message.update({
        status: 'read',
        updated_at: new Date()
      });
    }

    res.status(200).json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error(
      'Error fetching message:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch message',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/messages/:id/read
 * Mark message as read
 */
exports.markMessageRead = async (req, res) => {
  try {
    const { id } = req.params;

    const message =
      await ContactSubmission.findByPk(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.update({
      status: 'read',
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Message marked as read'
    });

  } catch (error) {
    console.error(
      'Error marking message read:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/messages/:id/replied
 * Mark message as replied
 */
exports.markMessageReplied = async (req, res) => {
  try {
    const { id } = req.params;

    const message =
      await ContactSubmission.findByPk(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.update({
      status: 'replied',
      replied_at: new Date(),
      replied_by: req.user?.id || null,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Message marked as replied'
    });

  } catch (error) {
    console.error(
      'Error marking message replied:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to mark message as replied',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/messages/:id
 * Delete message
 */
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const message =
      await ContactSubmission.findByPk(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.destroy();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error(
      'Error deleting message:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/messages/bulk-delete
 * Bulk delete messages
 */
exports.bulkDeleteMessages = async (req, res) => {
  try {
    const { ids } = req.body;

    if (
      !ids ||
      !Array.isArray(ids) ||
      ids.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'No message IDs provided'
      });
    }

    await ContactSubmission.destroy({
      where: { id: ids }
    });

    res.status(200).json({
      success: true,
      message:
        `${ids.length} messages deleted successfully`
    });

  } catch (error) {
    console.error(
      'Error bulk deleting messages:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to delete messages',
      error: error.message
    });
  }
};
