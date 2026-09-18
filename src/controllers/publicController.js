// backend/src/controllers/publicController.js

const { Op } = require('sequelize');

const {
  sequelize,
  User,
  Member,
  Event,
  EventRegistration,
  Project,
  Report,
  Announcement,
  Idea,
  Donation,
  District,
  Unit,
  Product,
  Notification,
  Course,
  CourseEnrollment,
  PageContent,
  TeamMember,
  Partner,
  ContactSubmission,
  News
} = require('../models');

/**
 * Get all public data for homepage - ALL DATA FROM DATABASE
 */
exports.getHomePageData = async (req, res) => {
  try {
    const [
      upcomingEvents,
      recentAnnouncements,
      featuredProjects,
      stats,
      recentProducts,
      pageContent
    ] = await Promise.all([
      Event.findAll({
        where: {
          start_date: {
            [Op.gte]: new Date()
          },
          status: 'published'
        },
        limit: 6,
        order: [['start_date', 'ASC']],
        include: [
          {
            model: District,
            as: 'district',
            attributes: ['id', 'name', 'province']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          }
        ],
        attributes: [
          'id',
          'title',
          'description',
          'start_date',
          'end_date',
          'location',
          'image_url',
          'event_type',
          'max_participants'
        ]
      }),

      Announcement.findAll({
        where: {
          status: 'published',
          is_public: true
        },
        limit: 5,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'name']
          }
        ],
        attributes: [
          'id',
          'title',
          'content',
          'image_url',
          'created_at'
        ]
      }),

      Project.findAll({
        where: {
          status: 'approved',
          is_featured: true
        },
        limit: 4,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: Member,
            as: 'submitter',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name']
              },
              {
                model: District,
                as: 'districtInfo',
                attributes: ['id', 'name']
              }
            ]
          }
        ],
        attributes: [
          'id',
          'title',
          'description',
          'goal_amount',
          'raised_amount',
          'status',
          'image_url',
          'created_at'
        ]
      }),

      Promise.all([
        Member.count({
          where: {
            status: 'active'
          }
        }),

        Project.count({
          where: {
            status: 'approved'
          }
        }),

        Event.count({
          where: {
            status: 'published'
          }
        }),

        Donation.sum('amount', {
          where: {
            status: 'completed'
          }
        }),

        Course.count({
          where: {
            status: 'published'
          }
        })
      ]),

      Product.findAll({
        where: {
          is_active: true
        },
        limit: 8,
        order: [['created_at', 'DESC']],
        attributes: [
          'id',
          'name',
          'description',
          'price',
          'category',
          'image_url',
          'stock',
          'views'
        ]
      }),

      PageContent.findAll({
        where: {
          page: 'home',
          is_active: true
        },
        order: [['order', 'ASC']]
      })
    ]);

    const [
      totalMembers,
      totalProjects,
      totalEvents,
      totalDonations,
      totalCourses
    ] = stats;

    const eventIds = upcomingEvents.map(event => event.id);

    let registrationCounts = [];

    if (eventIds.length > 0) {
      registrationCounts = await EventRegistration.findAll({
        where: {
          event_id: eventIds
        },
        attributes: [
          'event_id',
          [
            sequelize.fn('COUNT', sequelize.col('id')),
            'count'
          ]
        ],
        group: ['event_id']
      });
    }

    const countsMap = {};

    registrationCounts.forEach(item => {
      countsMap[item.event_id] = item.get('count');
    });

    const formattedEvents = upcomingEvents.map(event => ({
      ...event.toJSON(),
      registrationCount: countsMap[event.id] || 0
    }));

    const projectIds = featuredProjects.map(project => project.id);

    let projectDonations = [];

    if (projectIds.length > 0) {
      projectDonations = await Donation.findAll({
        where: {
          project_id: projectIds,
          status: 'completed'
        },
        attributes: [
          'project_id',
          [
            sequelize.fn('SUM', sequelize.col('amount')),
            'raised'
          ]
        ],
        group: ['project_id']
      });
    }

    const projectDonationsMap = {};

    projectDonations.forEach(item => {
      projectDonationsMap[item.project_id] =
        item.get('raised') || 0;
    });

    const formattedProjects = featuredProjects.map(project => ({
      ...project.toJSON(),
      raised_amount:
        projectDonationsMap[project.id] || 0
    }));

    const contentMap = {};

    pageContent.forEach(item => {
      contentMap[item.section] = item;
    });

    return res.status(200).json({
      success: true,
      data: {
        upcomingEvents: formattedEvents,
        recentAnnouncements,
        featuredProjects: formattedProjects,
        stats: {
          totalMembers,
          totalProjects,
          totalEvents,
          totalDonations: totalDonations || 0,
          totalCourses: totalCourses || 0
        },
        recentProducts,
        content: contentMap
      }
    });

  } catch (error) {
    console.error(
      'Error fetching home page data:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch home page data',
      error: error.message
    });
  }
};

/**
 * Get about page data - ALL DATA FROM DATABASE
 */
exports.getAboutPageData = async (req, res) => {
  try {
    const [
      totalMembers,
      districts,
      units,
      totalEvents,
      totalProjects,
      pageContent,
      memberDistribution,
      recentEvents
    ] = await Promise.all([
      Member.count({
        where: {
          status: 'active'
        }
      }),

      District.count(),

      Unit.count(),

      Event.count({
        where: {
          status: 'published'
        }
      }),

      Project.count({
        where: {
          status: 'approved'
        }
      }),

      PageContent.findAll({
        where: {
          page: 'about',
          is_active: true
        },
        order: [['order', 'ASC']]
      }),

      Member.findAll({
        where: {
          status: 'active'
        },
        attributes: [
          'district_id',
          [
            sequelize.fn('COUNT', sequelize.col('id')),
            'count'
          ]
        ],
        group: ['district_id'],
        include: [
          {
            model: District,
            as: 'districtInfo',
            attributes: ['id', 'name', 'province']
          }
        ],
        limit: 10,
        order: [
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'DESC'
          ]
        ]
      }),

      Event.findAll({
        where: {
          status: 'published'
        },
        limit: 5,
        order: [['created_at', 'DESC']],
        attributes: [
          'id',
          'title',
          'start_date',
          'location'
        ]
      })
    ]);

    const contentMap = {};

    pageContent.forEach(item => {
      contentMap[item.section] = {
        title: item.title,
        content: item.content,
        metadata: item.metadata
      };
    });

    const historyMilestones =
      contentMap['history_milestones']
        ?.metadata
        ?.milestones || [];

    const values =
      contentMap['values']
        ?.metadata
        ?.values || [];

    return res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalMembers,
          totalDistricts: districts,
          totalUnits: units,
          totalEvents,
          totalProjects
        },
        memberDistribution,
        recentEvents,
        history: {
          title:
            contentMap['history']?.title ||
            'Our History',
          content:
            contentMap['history']?.content || '',
          milestones: historyMilestones
        },
        mission: {
          title:
            contentMap['mission']?.title ||
            'Our Mission',
          content:
            contentMap['mission']?.content || ''
        },
        vision: {
          title:
            contentMap['vision']?.title ||
            'Our Vision',
          content:
            contentMap['vision']?.content || ''
        },
        values,
        organizationStructure: {
          levels:
            contentMap[
              'organization_structure'
            ]?.metadata?.levels || []
        }
      }
    });

  } catch (error) {
    console.error(
      'Error fetching about page data:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch about page data',
      error: error.message
    });
  }
};

/**
 * Get events page data - ALL DATA FROM DATABASE
 */
exports.getEventsPageData = async (req, res) => {
  try {
    const {
      type = 'upcoming',
      page = 1,
      limit = 10,
      category
    } = req.query;

    const pageNumber =
      Math.max(parseInt(page, 10) || 1, 1);

    const limitNumber =
      Math.max(parseInt(limit, 10) || 10, 1);

    const offset =
      (pageNumber - 1) * limitNumber;

    const whereCondition = {
      status: 'published'
    };

    if (type === 'upcoming') {
      whereCondition.start_date = {
        [Op.gte]: new Date()
      };
    } else if (type === 'past') {
      whereCondition.start_date = {
        [Op.lt]: new Date()
      };
    }

    if (category) {
      whereCondition.event_type = category;
    }

    const {
      count,
      rows: events
    } = await Event.findAndCountAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
      order: [
        [
          'start_date',
          type === 'upcoming'
            ? 'ASC'
            : 'DESC'
        ]
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
          attributes: ['id', 'name']
        }
      ],
      attributes: [
        'id',
        'title',
        'description',
        'start_date',
        'end_date',
        'location',
        'image_url',
        'event_type',
        'max_participants'
      ]
    });

    const eventIds =
      events.map(event => event.id);

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
          group: ['event_id']
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
          event.max_participants
            ? event.max_participants -
              (countsMap[event.id] || 0)
            : null
      }));

    const categories =
      await Event.findAll({
        where: {
          status: 'published'
        },
        attributes: ['event_type'],
        group: ['event_type']
      });

    return res.status(200).json({
      success: true,
      data: {
        events: formattedEvents,
        categories:
          categories
            .map(c => c.event_type)
            .filter(Boolean),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: count,
          totalPages:
            Math.ceil(count / limitNumber)
        }
      }
    });

  } catch (error) {
    console.error(
      'Error fetching events:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message
    });
  }
};

/**
 * Get event details by ID
 */
exports.getEventDetails = async (req, res) => {
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
              'name',
              'email'
            ]
          },
          {
            model: EventRegistration,
            as: 'registrations',
            include: [
              {
                model: Member,
                as: 'member',
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: [
                      'id',
                      'name',
                      'email'
                    ]
                  },
                  {
                    model: District,
                    as: 'districtInfo',
                    attributes: [
                      'id',
                      'name'
                    ]
                  }
                ]
              }
            ],
            attributes: [
              'id',
              'member_id',
              'registration_date',
              'status'
            ]
          }
        ]
      });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const similarEvents =
      await Event.findAll({
        where: {
          status: 'published',
          event_type: event.event_type,
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
          'location',
          'image_url'
        ]
      });

    return res.status(200).json({
      success: true,
      data: {
        event,
        similarEvents
      }
    });

  } catch (error) {
    console.error(
      'Error fetching event details:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch event details',
      error: error.message
    });
  }
};

/**
 * Register for an event
 */
exports.registerForEvent = async (req, res) => {
  try {
    const {
      event_id,
      member_id,
      notes
    } = req.body;

    const event =
      await Event.findByPk(event_id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const registrationCount =
      await EventRegistration.count({
        where: {
          event_id
        }
      });

    if (
      event.max_participants &&
      registrationCount >=
        event.max_participants
    ) {
      return res.status(400).json({
        success: false,
        message: 'Event is fully booked'
      });
    }

    const existingRegistration =
      await EventRegistration.findOne({
        where: {
          event_id,
          member_id
        }
      });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message:
          'You are already registered for this event'
      });
    }

    const registration =
      await EventRegistration.create({
        event_id,
        member_id,
        registration_date: new Date(),
        status: 'pending',
        notes
      });

    await Notification.create({
      title: 'New Event Registration',
      message:
        `A member has registered for ${event.title}`,
      type: 'event_registration',
      priority: 'medium'
    });

    return res.status(201).json({
      success: true,
      message:
        'Successfully registered for event',
      data: registration
    });

  } catch (error) {
    console.error(
      'Error registering for event:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to register for event',
      error: error.message
    });
  }
};

/**
 * Get marketplace products
 */
exports.getProducts = async (req, res) => {
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

    const pageNumber =
      Math.max(parseInt(page, 10) || 1, 1);

    const limitNumber =
      Math.max(parseInt(limit, 10) || 12, 1);

    const offset =
      (pageNumber - 1) * limitNumber;

    const whereCondition = {
      is_active: true
    };

    if (category) {
      whereCondition.category = category;
    }

    if (minPrice || maxPrice) {
      whereCondition.price = {};

      if (minPrice) {
        whereCondition.price[Op.gte] =
          parseFloat(minPrice);
      }

      if (maxPrice) {
        whereCondition.price[Op.lte] =
          parseFloat(maxPrice);
      }
    }

    if (search) {
      whereCondition[Op.or] = [
        {
          name: {
            [Op.iLike]: `%${search}%`
          }
        },
        {
          description: {
            [Op.iLike]: `%${search}%`
          }
        }
      ];
    }

    if (inStock === 'true') {
      whereCondition.stock = {
        [Op.gt]: 0
      };
    }

    let orderBy = [
      [sort, order]
    ];

    if (sort === 'price_order') {
      orderBy = [
        ['price', order]
      ];
    } else if (sort === 'name') {
      orderBy = [
        ['name', order]
      ];
    }

    const {
      count,
      rows: products
    } = await Product.findAndCountAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
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

    const categoryCounts =
      await Product.findAll({
        where: {
          is_active: true
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
        group: ['category']
      });

    return res.status(200).json({
      success: true,
      data: {
        products,
        categories: categoryCounts,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: count,
          totalPages:
            Math.ceil(count / limitNumber)
        }
      }
    });

  } catch (error) {
    console.error(
      'Error fetching products:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

/**
 * Get product details
 */
exports.getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const product =
      await Product.findByPk(id, {
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

    await product.increment('views');

    const relatedProducts =
      await Product.findAll({
        where: {
          category: product.category,
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

    return res.status(200).json({
      success: true,
      data: {
        product,
        relatedProducts
      }
    });

  } catch (error) {
    console.error(
      'Error fetching product details:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product details',
      error: error.message
    });
  }
};

/**
 * Get product categories
 */
exports.getProductCategories = async (req, res) => {
  try {
    const categories =
      await Product.findAll({
        where: {
          is_active: true
        },
        attributes: [
          'category',
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'count'
          ],
          [
            sequelize.fn(
              'MIN',
              sequelize.col('price')
            ),
            'min_price'
          ],
          [
            sequelize.fn(
              'MAX',
              sequelize.col('price')
            ),
            'max_price'
          ]
        ],
        group: ['category'],
        order: [
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'DESC'
          ]
        ]
      });

    return res.status(200).json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error(
      'Error fetching product categories:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch product categories',
      error: error.message
    });
  }
};

/**
 * Submit contact form
 */
exports.submitContactForm = async (req, res) => {
  try {
    const {
      name,
      email,
      subject,
      message,
      phone,
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
        message: 'All fields are required'
      });
    }

    const submission =
      await ContactSubmission.create({
        name,
        email,
        phone: phone || null,
        subject,
        message,
        category: category || 'general',
        status: 'new',
        ip_address:
          req.ip ||
          req.connection.remoteAddress,
        user_agent:
          req.headers['user-agent']
      });

    await Notification.create({
      title:
        `New Contact Form: ${subject}`,
      message: `
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Category: ${category || 'General'}
Message: ${message}
      `,
      type: 'contact_form',
      priority: 'high'
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
      'Error submitting contact form:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to submit contact form',
      error: error.message
    });
  }
};

/**
 * ============================================================
 * GET NEWS
 * ============================================================
 *
 * IMPORTANT:
 * This function uses ONLY the `news` table.
 *
 * It does NOT use:
 * - Announcement
 * - announcements
 * - is_public
 *
 */
exports.getNews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category
    } = req.query;

    const pageNumber =
      Math.max(parseInt(page, 10) || 1, 1);

    const limitNumber =
      Math.min(
        Math.max(
          parseInt(limit, 10) || 20,
          1
        ),
        100
      );

    const offset =
      (pageNumber - 1) * limitNumber;

    const whereCondition = {
      status: 'published'
    };

    if (category) {
      whereCondition.category = category;
    }

    // ========================================================
    // NEWS TABLE ONLY
    // ========================================================

    const {
      count,
      rows: news
    } = await News.findAndCountAll({
      where: whereCondition,

      attributes: [
        'id',
        'title',
        'category',
        'excerpt',
        'content',
        'image_url',
        'status',
        'author_id',
        'published_at',
        'created_at',
        'updated_at'
      ],

      limit: limitNumber,
      offset,

      order: [
        ['published_at', 'DESC'],
        ['created_at', 'DESC']
      ]
    });

    // ========================================================
    // CATEGORIES FROM NEWS TABLE ONLY
    // ========================================================

    const categoryRows =
      await News.findAll({
        where: {
          status: 'published'
        },

        attributes: ['category'],

        group: ['category'],

        order: [
          ['category', 'ASC']
        ]
      });

    const categories =
      categoryRows
        .map(item => item.category)
        .filter(Boolean);

    return res.status(200).json({
      success: true,

      data: {
        news,

        categories,

        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: count,
          totalPages:
            Math.ceil(
              count / limitNumber
            )
        }
      }
    });

  } catch (error) {
    console.error(
      'Error fetching news:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch news',
      error: error.message,

      data: {
        news: [],
        categories: [],

        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      }
    });
  }
};

/**
 * Get partners and donors
 */
exports.getPartnersAndDonors = async (req, res) => {
  try {
    const [
      partners,
      topDonors,
      donationStats,
      recentDonations
    ] = await Promise.all([
      Partner.findAll({
        where: {
          status: 'active',
          is_active: true
        },
        order: [
          ['type', 'ASC'],
          ['order', 'ASC']
        ],
        attributes: [
          'id',
          'name',
          'type',
          'description',
          'website',
          'logo_url',
          'partnership_type'
        ]
      }),

      Donation.findAll({
        where: {
          status: 'completed'
        },
        attributes: [
          'donor_name',
          'donor_email',
          [
            sequelize.fn(
              'SUM',
              sequelize.col('amount')
            ),
            'total_amount'
          ],
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'donation_count'
          ]
        ],
        group: [
          'donor_name',
          'donor_email'
        ],
        order: [
          [
            sequelize.fn(
              'SUM',
              sequelize.col('amount')
            ),
            'DESC'
          ]
        ],
        limit: 10
      }),

      Donation.findAll({
        where: {
          status: 'completed'
        },
        attributes: [
          'donation_type',
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'count'
          ],
          [
            sequelize.fn(
              'SUM',
              sequelize.col('amount')
            ),
            'total'
          ]
        ],
        group: ['donation_type']
      }),

      Donation.findAll({
        where: {
          status: 'completed'
        },
        limit: 10,
        order: [
          ['created_at', 'DESC']
        ],
        attributes: [
          'id',
          'donor_name',
          'amount',
          'message',
          'created_at'
        ]
      })
    ]);

    const groupedPartners = {};

    partners.forEach(partner => {
      if (!groupedPartners[partner.type]) {
        groupedPartners[partner.type] = [];
      }

      groupedPartners[partner.type].push(
        partner
      );
    });

    const totalDonated =
      donationStats.reduce(
        (sum, stat) =>
          sum +
          parseFloat(
            stat.get('total') || 0
          ),
        0
      );

    return res.status(200).json({
      success: true,
      data: {
        partners: groupedPartners,
        topDonors,
        donationStats,
        recentDonations,
        totalDonated
      }
    });

  } catch (error) {
    console.error(
      'Error fetching partners:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch partners',
      error: error.message
    });
  }
};

/**
 * Get membership information
 */
exports.getMembershipInfo = async (req, res) => {
  try {
    const [
      totalMembers,
      membersByAge,
      membersByDistrict,
      recentMembers,
      pageContent
    ] = await Promise.all([
      Member.count({
        where: {
          status: 'active'
        }
      }),

      Member.findAll({
        where: {
          status: 'active'
        },
        attributes: [
          'age_group',
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'count'
          ]
        ],
        group: ['age_group']
      }),

      Member.findAll({
        where: {
          status: 'active'
        },
        attributes: [
          'district_id',
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'count'
          ]
        ],
        group: ['district_id'],
        include: [
          {
            model: District,
            as: 'districtInfo',
            attributes: [
              'id',
              'name',
              'province'
            ]
          }
        ],
        limit: 10,
        order: [
          [
            sequelize.fn(
              'COUNT',
              sequelize.col('id')
            ),
            'DESC'
          ]
        ]
      }),

      Member.findAll({
        where: {
          status: 'active'
        },
        limit: 5,
        order: [
          ['created_at', 'DESC']
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: [
              'id',
              'name',
              'email'
            ]
          },
          {
            model: District,
            as: 'districtInfo',
            attributes: [
              'id',
              'name'
            ]
          }
        ]
      }),

      PageContent.findAll({
        where: {
          page: 'membership',
          is_active: true
        },
        order: [
          ['order', 'ASC']
        ]
      })
    ]);

    const contentMap = {};

    pageContent.forEach(item => {
      contentMap[item.section] = {
        title: item.title,
        content: item.content,
        metadata: item.metadata
      };
    });

    const sections =
      contentMap['sections']
        ?.metadata
        ?.sections || [];

    const benefits =
      contentMap['benefits']
        ?.metadata
        ?.benefits || [];

    const requirements =
      contentMap['requirements']
        ?.metadata
        ?.requirements || [];

    const feeStructure =
      contentMap['fee_structure']
        ?.metadata
        ?.feeStructure || {};

    return res.status(200).json({
      success: true,
      data: {
        totalMembers,

        ageGroups:
          membersByAge.map(item => ({
            group:
              item.age_group ||
              'Not specified',
            count:
              parseInt(
                item.get('count'),
                10
              )
          })),

        districtDistribution:
          membersByDistrict.map(item => ({
            district:
              item.districtInfo?.name ||
              'Unknown',
            count:
              parseInt(
                item.get('count'),
                10
              )
          })),

        recentMembers,
        sections,
        benefits,
        requirements,
        feeStructure
      }
    });

  } catch (error) {
    console.error(
      'Error fetching membership info:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch membership information',
      error: error.message
    });
  }
};

/**
 * Get MSR Development Team
 */
exports.getMSRDevelopmentTeam = async (
  req,
  res
) => {
  try {
    const teamMembers =
      await TeamMember.findAll({
        where: {
          is_active: true
        },
        order: [
          ['category', 'ASC'],
          ['order', 'ASC']
        ],
        attributes: [
          'id',
          'name',
          'role',
          'department',
          'bio',
          'email',
          'phone',
          'avatar_url',
          'category',
          'social_links'
        ]
      });

    const groupedTeam = {};

    teamMembers.forEach(member => {
      if (!groupedTeam[member.category]) {
        groupedTeam[member.category] = [];
      }

      groupedTeam[
        member.category
      ].push(member);
    });

    return res.status(200).json({
      success: true,
      data: {
        leadership:
          groupedTeam['leadership'] || [],

        developmentTeam:
          groupedTeam['development'] || [],

        supportStaff:
          groupedTeam['support'] || [],

        volunteers:
          groupedTeam['volunteer'] || []
      }
    });

  } catch (error) {
    console.error(
      'Error fetching team:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch team information',
      error: error.message
    });
  }
};