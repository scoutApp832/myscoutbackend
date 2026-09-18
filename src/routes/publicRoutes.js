// backend/src/routes/publicRoutes.js

const express = require('express');
const router = express.Router();

const {
  Product,
  Event,
  EventRegistration,
  District,
  User,
  ContactSubmission,
  Announcement,
  News,
  Project,
  ProjectMember,
  sequelize
} = require('../models');

const { Op } = require('sequelize');


// ============================================
// PUBLIC EVENTS ROUTES (No Auth Required)
// ============================================

/**
 * GET /api/public/events/upcoming
 * Get upcoming events - PUBLIC (No auth required)
 */
router.get('/events/upcoming', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const events = await Event.findAll({
      where: {
        start_date: {
          [Op.gte]: new Date()
        },
        status: ['upcoming', 'published']
      },

      limit: parseInt(limit),

      order: [
        ['start_date', 'ASC']
      ],

      include: [
        {
          model: District,
          as: 'district',
          attributes: [
            'id',
            'name',
            'province'
          ]
        },
        {
          model: User,
          as: 'creator',
          attributes: [
            'id',
            'full_name'
          ]
        }
      ],

      attributes: [
        'id',
        'title',
        'description',
        'start_date',
        'end_date',
        'location',
        'venue',
        'event_type',
        'capacity',
        'price',
        'status',
        'image_url',
        'created_at'
      ]
    });

    const eventIds = events.map(
      event => event.id
    );

    let registrationCounts = [];

    if (eventIds.length > 0) {
      registrationCounts =
        await EventRegistration.findAll({
          where: {
            event_id: eventIds
          },

          attributes: [
            'event_id',

            [
              sequelize.fn(
                'COUNT',
                sequelize.col('id')
              ),
              'count'
            ]
          ],

          group: [
            'event_id'
          ]
        });
    }

    const countsMap = {};

    registrationCounts.forEach(item => {
      countsMap[item.event_id] =
        item.get('count');
    });

    const formattedEvents =
      events.map(event => ({
        ...event.toJSON(),

        registrationCount:
          countsMap[event.id] || 0,

        available_spots:
          event.capacity
            ? event.capacity -
              (countsMap[event.id] || 0)
            : null
      }));

    return res.status(200).json({
      success: true,
      events: formattedEvents
    });

  } catch (error) {
    console.error(
      'Error fetching upcoming events:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch upcoming events',
      error: error.message,
      events: []
    });
  }
});


/**
 * GET /api/public/events/past
 * Get past events - PUBLIC
 */
router.get('/events/past', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const events = await Event.findAll({
      where: {
        start_date: {
          [Op.lt]: new Date()
        },

        status: [
          'completed',
          'published',
          'past'
        ]
      },

      limit: parseInt(limit),

      order: [
        ['start_date', 'DESC']
      ],

      include: [
        {
          model: District,
          as: 'district',
          attributes: [
            'id',
            'name',
            'province'
          ]
        },

        {
          model: User,
          as: 'creator',
          attributes: [
            'id',
            'full_name'
          ]
        }
      ],

      attributes: [
        'id',
        'title',
        'description',
        'start_date',
        'end_date',
        'location',
        'venue',
        'event_type',
        'capacity',
        'price',
        'status',
        'image_url',
        'created_at'
      ]
    });

    const eventIds =
      events.map(
        event => event.id
      );

    let registrationCounts = [];

    if (eventIds.length > 0) {
      registrationCounts =
        await EventRegistration.findAll({
          where: {
            event_id: eventIds
          },

          attributes: [
            'event_id',

            [
              sequelize.fn(
                'COUNT',
                sequelize.col('id')
              ),
              'count'
            ]
          ],

          group: [
            'event_id'
          ]
        });
    }

    const countsMap = {};

    registrationCounts.forEach(item => {
      countsMap[item.event_id] =
        item.get('count');
    });

    const formattedEvents =
      events.map(event => ({
        ...event.toJSON(),

        registrationCount:
          countsMap[event.id] || 0
      }));

    return res.status(200).json({
      success: true,
      events: formattedEvents
    });

  } catch (error) {
    console.error(
      'Error fetching past events:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch past events',
      error: error.message,
      events: []
    });
  }
});


/**
 * GET /api/public/events/:id
 * Get single event details - PUBLIC
 */
router.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const event =
      await Event.findByPk(id, {
        include: [
          {
            model: District,
            as: 'district',
            attributes: [
              'id',
              'name',
              'province'
            ]
          },

          {
            model: User,
            as: 'creator',
            attributes: [
              'id',
              'full_name',
              'email'
            ]
          }
        ],

        attributes: [
          'id',
          'title',
          'description',
          'start_date',
          'end_date',
          'location',
          'venue',
          'event_type',
          'capacity',
          'price',
          'status',
          'image_url',
          'created_at'
        ]
      });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const registrationCount =
      await EventRegistration.count({
        where: {
          event_id: id
        }
      });

    const eventData = {
      ...event.toJSON(),

      registrationCount,

      available_spots:
        event.capacity
          ? event.capacity -
            registrationCount
          : null
    };

    const similarEvents =
      await Event.findAll({
        where: {
          status: [
            'upcoming',
            'published'
          ],

          event_type:
            event.event_type,

          id: {
            [Op.ne]: id
          },

          start_date: {
            [Op.gte]: new Date()
          }
        },

        limit: 4,

        order: [
          ['start_date', 'ASC']
        ],

        attributes: [
          'id',
          'title',
          'start_date',
          'location'
        ]
      });

    return res.status(200).json({
      success: true,

      data: {
        event: eventData,
        similarEvents
      }
    });

  } catch (error) {
    console.error(
      'Error fetching event:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch event',
      error: error.message
    });
  }
});


// ============================================
// PUBLIC NEWS ROUTES (No Auth Required)
// ============================================

/**
 * GET /api/public/news
 * Get all published news articles - PUBLIC
 *
 * IMPORTANT:
 * Uses News table, NOT Announcement table.
 */
router.get('/news', async (req, res) => {
  try {
    const {
      limit = 20,
      category,
      search
    } = req.query;

    const whereCondition = {
      status: 'published'
    };

    // ----------------------------------------
    // Category filter
    // ----------------------------------------
    if (
      category &&
      category !== 'All' &&
      category !== 'all'
    ) {
      whereCondition.category =
        category;
    }

    // ----------------------------------------
    // Search
    // ----------------------------------------
    if (search) {
      whereCondition[Op.or] = [
        {
          title: {
            [Op.iLike]:
              `%${search}%`
          }
        },

        {
          content: {
            [Op.iLike]:
              `%${search}%`
          }
        },

        {
          excerpt: {
            [Op.iLike]:
              `%${search}%`
          }
        }
      ];
    }

    // ----------------------------------------
    // Get news
    // ----------------------------------------
    const news = await News.findAll({
      where: whereCondition,

      limit: Math.min(
        parseInt(limit) || 20,
        100
      ),

      order: [
        [
          'published_at',
          'DESC'
        ],

        [
          'created_at',
          'DESC'
        ]
      ],

      include: [
        {
          model: User,
          as: 'author',

          attributes: [
            'id',
            'full_name',
            'email'
          ],

          required: false
        }
      ],

      attributes: [
        'id',
        'title',
        'content',
        'excerpt',
        'image_url',
        'category',
        'status',
        'author_id',
        'published_at',
        'created_at',
        'updated_at'
      ]
    });

    return res.status(200).json({
      success: true,
      news,
      total: news.length
    });

  } catch (error) {
    console.error(
      '❌ Error fetching public news:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch news',
      error: error.message,
      news: []
    });
  }
});


/**
 * GET /api/public/news/categories
 * Get all published news categories - PUBLIC
 *
 * IMPORTANT:
 * This route MUST come before /news/:id.
 */
router.get(
  '/news/categories',
  async (req, res) => {
    try {
      const categories =
        await News.findAll({
          where: {
            status: 'published'
          },

          attributes: [
            'category',

            [
              sequelize.fn(
                'COUNT',
                sequelize.col('id')
              ),
              'count'
            ]
          ],

          group: [
            'category'
          ]
        });

      return res.status(200).json({
        success: true,

        categories:
          categories
            .map(item =>
              item.get('category')
            )
            .filter(Boolean)
      });

    } catch (error) {
      console.error(
        '❌ Error fetching news categories:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to fetch categories',
        categories: []
      });
    }
  }
);


/**
 * GET /api/public/news/:id
 * Get one published news article - PUBLIC
 *
 * IMPORTANT:
 * Uses News table, NOT Announcement table.
 */
router.get(
  '/news/:id',
  async (req, res) => {
    try {
      const { id } = req.params;

      // --------------------------------------
      // IMPORTANT:
      // Use findOne() instead of findByPk()
      // because we need status condition.
      // --------------------------------------
      const article =
        await News.findOne({
          where: {
            id,
            status: 'published'
          },

          include: [
            {
              model: User,
              as: 'author',

              attributes: [
                'id',
                'full_name',
                'email'
              ],

              required: false
            }
          ],

          attributes: [
            'id',
            'title',
            'content',
            'excerpt',
            'image_url',
            'category',
            'status',
            'author_id',
            'published_at',
            'created_at',
            'updated_at'
          ]
        });

      if (!article) {
        return res.status(404).json({
          success: false,
          message:
            'News article not found'
        });
      }

      return res.status(200).json({
        success: true,
        news: article
      });

    } catch (error) {
      console.error(
        '❌ Error fetching news article:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to fetch article',
        error: error.message
      });
    }
  }
);


// ============================================
// MARKETPLACE ROUTES (No Auth Required)
// ============================================

/**
 * GET /api/public/marketplace/products
 * Get all products
 */
router.get(
  '/marketplace/products',
  async (req, res) => {
    try {
      const {
        category,
        search,
        sort = 'newest'
      } = req.query;

      let where = {
        is_active: true
      };

      let order = [
        ['created_at', 'DESC']
      ];

      if (
        category &&
        category !== 'all'
      ) {
        where.category =
          category;
      }

      if (search) {
        where[Op.or] = [
          {
            name: {
              [Op.iLike]:
                `%${search}%`
            }
          },

          {
            description: {
              [Op.iLike]:
                `%${search}%`
            }
          }
        ];
      }

      switch (sort) {

        case 'price-low':
          order = [
            ['price', 'ASC']
          ];
          break;

        case 'price-high':
          order = [
            ['price', 'DESC']
          ];
          break;

        case 'popular':
          order = [
            ['views', 'DESC']
          ];
          break;

        case 'name':
          order = [
            ['name', 'ASC']
          ];
          break;

        default:
          order = [
            ['created_at', 'DESC']
          ];
      }

      const products =
        await Product.findAll({
          where,
          order,

          attributes: [
            'id',
            'name',
            'description',
            'price',
            'category',
            'stock',
            'image_url',
            'created_at'
          ]
        });

      return res.json({
        success: true,
        products
      });

    } catch (error) {
      console.error(
        'Error fetching products:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to load products',
        error: error.message
      });
    }
  }
);


/**
 * GET /api/public/marketplace/products/:id
 * Get single product
 */
router.get(
  '/marketplace/products/:id',
  async (req, res) => {
    try {
      const { id } = req.params;

      const product =
        await Product.findByPk(
          id,
          {
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
              'created_at',
              'updated_at'
            ]
          }
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            'Product not found'
        });
      }

      await product.increment(
        'views'
      );

      const relatedProducts =
        await Product.findAll({
          where: {
            category:
              product.category,

            id: {
              [Op.ne]: id
            },

            is_active: true
          },

          limit: 4,

          order: [
            ['views', 'DESC']
          ],

          attributes: [
            'id',
            'name',
            'price',
            'image_url'
          ]
        });

      return res.json({
        success: true,

        product,

        relatedProducts
      });

    } catch (error) {
      console.error(
        'Error fetching product:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to load product',
        error: error.message
      });
    }
  }
);


/**
 * GET /api/public/marketplace/categories
 * Get product categories
 */
router.get(
  '/marketplace/categories',
  async (req, res) => {
    try {
      const categories =
        await Product.findAll({
          attributes: [
            [
              sequelize.literal(
                'DISTINCT "category"'
              ),
              'category'
            ]
          ],

          where: {
            category: {
              [Op.ne]: null
            }
          },

          raw: true
        });

      return res.json({
        success: true,

        categories:
          categories
            .map(
              c => c.category
            )
            .filter(Boolean)
      });

    } catch (error) {
      console.error(
        'Error fetching product categories:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to load categories',
        error: error.message
      });
    }
  }
);


// ============================================
// PUBLIC CONTACT ROUTE
// ============================================

/**
 * POST /api/public/contact
 * Submit contact form
 */
router.post(
  '/contact',
  async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        subject,
        message,
        category
      } = req.body;

      if (
        !name ||
        !email ||
        !subject ||
        !message
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Name, email, subject, and message are required'
        });
      }

      const submission =
        await ContactSubmission.create({
          name: name.trim(),

          email:
            email
              .trim()
              .toLowerCase(),

          phone:
            phone || null,

          subject:
            subject.trim(),

          message:
            message.trim(),

          category:
            category ||
            'general',

          status: 'new',

          ip_address:
            req.ip ||
            req.connection
              ?.remoteAddress,

          user_agent:
            req.headers[
              'user-agent'
            ]
        });

      return res.status(200).json({
        success: true,

        message:
          'Contact form submitted successfully',

        data: {
          id: submission.id
        }
      });

    } catch (error) {
      console.error(
        'Error submitting contact:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          'Failed to submit contact form',

        error: error.message
      });
    }
  }
);


// ============================================
// PUBLIC SYSTEM STATISTICS
// ============================================

/**
 * GET /api/public/stats
 *
 * Get real statistics directly from
 * the MSR database.
 *
 * No authentication required.
 */
router.get('/stats', async (req, res) => {
  try {

    // ----------------------------------------
    // Current year
    // ----------------------------------------
    const currentYear =
      new Date().getFullYear();

    const startOfYear =
      new Date(
        `${currentYear}-01-01T00:00:00`
      );

    const startOfNextYear =
      new Date(
        `${currentYear + 1}-01-01T00:00:00`
      );


    // ----------------------------------------
    // REAL USER COUNT (Active Scouts)
    // ----------------------------------------
    const totalUsers =
      await User.count();

    // Get users by role for trained leaders breakdown
    const unitLeaders =
      await User.count({
        where: {
          role: 'unit_leader'
        }
      });

    const districtCommissioners =
      await User.count({
        where: {
          role: 'district_commissioner'
        }
      });

    const nationalCommissioners =
      await User.count({
        where: {
          role: 'national_commissioner'
        }
      });

    // Calculate total trained leaders
    const totalTrainedLeaders =
      unitLeaders +
      districtCommissioners +
      nationalCommissioners;


    // ----------------------------------------
    // REAL DISTRICT COUNT
    // ----------------------------------------
    const totalDistricts =
      await District.count();


    // ----------------------------------------
    // REAL EVENTS FOR CURRENT YEAR
    // ----------------------------------------
    const yearlyEvents =
      await Event.count({
        where: {
          start_date: {
            [Op.gte]: startOfYear,
            [Op.lt]: startOfNextYear
          }
        }
      });


    // ----------------------------------------
    // REAL PROJECT COUNTS BY STATUS
    // ----------------------------------------
    // Check if Project model exists
    let approvedProjects = 0;
    let pendingProjects = 0;
    let inProgressProjects = 0;
    let completedProjects = 0;
    let totalProjects = 0;

    if (Project) {
      // Count projects by status - MATCH YOUR DATABASE STATUSES
      approvedProjects =
        await Project.count({
          where: {
            status: 'approved'
          }
        });

      pendingProjects =
        await Project.count({
          where: {
            status: 'pending'
          }
        });

      // 'active' = In Progress
      inProgressProjects =
        await Project.count({
          where: {
            status: 'active'
          }
        });

      // 'published' = Completed
      completedProjects =
        await Project.count({
          where: {
            status: 'published'
          }
        });

      totalProjects =
        approvedProjects +
        pendingProjects +
        inProgressProjects +
        completedProjects;
    }


    // ----------------------------------------
    // REAL PUBLISHED NEWS COUNT
    // ----------------------------------------
    const publishedNews =
      await News.count({
        where: {
          status: 'published'
        }
      });


    // ----------------------------------------
    // REAL ACTIVE PRODUCTS COUNT
    // ----------------------------------------
    const activeProducts =
      await Product.count({
        where: {
          is_active: true
        }
      });


    // ----------------------------------------
    // RETURN STATISTICS
    // ----------------------------------------
    return res.status(200).json({

      success: true,

      stats: {

        // Real number from User table
        activeScouts:
          totalUsers,

        // Individual role counts for trained leaders
        unitLeaders,
        districtCommissioners,
        nationalCommissioners,

        // Total trained leaders (calculated)
        trainedLeaders:
          totalTrainedLeaders,

        // Real number from District table
        districts:
          totalDistricts,

        // Real number of events
        // created during current year
        eventsYearly:
          yearlyEvents,

        // Individual project status counts
        approvedProjects,
        pendingProjects,
        inProgressProjects,
        completedProjects,

        // Total community projects (calculated)
        communityProjects:
          totalProjects,

        // Additional real statistics
        publishedNews,
        activeProducts
      }
    });

  } catch (error) {

    console.error(
      '❌ Error fetching public statistics:',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        'Failed to fetch statistics',

      stats: {
        activeScouts: 0,
        unitLeaders: 0,
        districtCommissioners: 0,
        nationalCommissioners: 0,
        trainedLeaders: 0,
        districts: 0,
        eventsYearly: 0,
        approvedProjects: 0,
        pendingProjects: 0,
        inProgressProjects: 0,
        completedProjects: 0,
        communityProjects: 0,
        publishedNews: 0,
        activeProducts: 0
      }

    });
  }
});


// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;