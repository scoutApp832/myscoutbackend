const { Announcement, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const NotificationService = require('../services/notificationService');

// ============================================
// GET ALL ANNOUNCEMENTS - ALLOW ALL AUTHENTICATED USERS
// ============================================
exports.getAnnouncements = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📢 Fetching announcements for user: ${userId} (${userRole})`);

    // ✅ Allow ALL authenticated users to view announcements
    let whereClause = { is_published: true };

    // Filter based on role
    if (userRole === 'national_commissioner' || 
        userRole === 'national-commissioner' || 
        userRole === 'super_admin' || 
        userRole === 'admin') {
      // National Commissioners see ALL announcements
      console.log('👑 National Commissioner - showing all announcements');
    } else if (userRole === 'district_commissioner' || userRole === 'district_commissioner') {
      // District Commissioners see their district + national
      const user = await User.findByPk(userId);
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { district: 'all' },
          { district: user?.district || 'all' }
        ]
      };
      console.log(`🏛️ District Commissioner - filtering by district: ${user?.district}`);
    } else {
      // Scouts, Unit Leaders, and other users
      // See national announcements + their district
      const user = await User.findByPk(userId);
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { district: 'all' },
          { district: user?.district || 'all' }
        ]
      };
      console.log(`🎯 User - filtering by district: ${user?.district || 'all'}`);
    }

    const announcements = await Announcement.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    console.log(`✅ Found ${announcements.length} announcements`);

    res.json({
      success: true,
      announcements: announcements
    });

  } catch (error) {
    console.error('❌ Get announcements error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// GET ANNOUNCEMENT BY ID - ALLOW ALL AUTHENTICATED USERS
// ============================================
exports.getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📢 Fetching announcement ${id} for user: ${userId}`);

    const announcement = await Announcement.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // ✅ Check if user has permission to view this announcement
    let canView = false;

    if (userRole === 'national_commissioner' || 
        userRole === 'national-commissioner' || 
        userRole === 'super_admin' || 
        userRole === 'admin') {
      canView = true;
    } else if (announcement.district === 'all') {
      canView = true;
    } else {
      // Check if user belongs to the same district
      const user = await User.findByPk(userId);
      if (user && user.district === announcement.district) {
        canView = true;
      }
    }

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this announcement'
      });
    }

    res.json({
      success: true,
      announcement: announcement
    });

  } catch (error) {
    console.error('❌ Get announcement error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// CREATE ANNOUNCEMENT - Using Notification Service
// ============================================
exports.createAnnouncement = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { 
      title, 
      content, 
      announcement_type = 'general', 
      district = 'all', 
      audience = ['all'], 
      send_email = false,
      scheduled_at = null
    } = req.body;

    console.log(`📢 Creating announcement: "${title}"`);

    // Validate
    if (!title || !title.trim()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    if (!content || !content.trim()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    // ✅ Create announcement master record
    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      announcement_type: announcement_type,
      district: district,
      audience: audience,
      send_email: send_email,
      scheduled_at: scheduled_at,
      published_at: scheduled_at || new Date(),
      is_published: true,
      created_by: userId
    }, { transaction });

    // ✅ Determine target users based on audience
    let targetUserIds = [];

    if (audience.includes('all')) {
      const users = await User.findAll({
        where: { status: 'active' },
        attributes: ['id']
      }, { transaction });
      targetUserIds = users.map(u => u.id);
    } else {
      const userRoles = [];
      if (audience.includes('scouts')) userRoles.push('scout');
      if (audience.includes('unit_leaders')) userRoles.push('unit_leader');
      if (audience.includes('district_commissioners')) userRoles.push('district_commissioner');
      if (audience.includes('national_commissioners')) userRoles.push('national_commissioner');

      if (userRoles.length > 0) {
        const users = await User.findAll({
          where: { 
            role: { [Op.in]: userRoles },
            status: 'active'
          },
          attributes: ['id']
        }, { transaction });
        targetUserIds = users.map(u => u.id);
      }
    }

    targetUserIds = [...new Set(targetUserIds)];

    if (targetUserIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No recipients found for this announcement'
      });
    }

    await transaction.commit();

    // ✅ Create notifications using Notification Service
    const notifications = await NotificationService.createAnnouncementNotifications(
      announcement,
      targetUserIds
    );

    console.log(`✅ Created ${notifications.length} notifications`);

    res.status(201).json({
      success: true,
      message: `Announcement sent to ${notifications.length} recipients`,
      announcement: announcement,
      count: notifications.length
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// UPDATE ANNOUNCEMENT - Only National Commissioners
// ============================================
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { 
      title, 
      content, 
      announcement_type, 
      district, 
      audience, 
      send_email, 
      scheduled_at,
      is_published 
    } = req.body;

    // ✅ Check if user has permission
    const allowedRoles = ['national_commissioner', 'national-commissioner', 'super_admin', 'admin'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. National Commissioner or Super Admin role required.'
      });
    }

    const announcement = await Announcement.findByPk(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    await announcement.update({
      title: title || announcement.title,
      content: content || announcement.content,
      announcement_type: announcement_type || announcement.announcement_type,
      district: district || announcement.district,
      audience: audience || announcement.audience,
      send_email: send_email !== undefined ? send_email : announcement.send_email,
      scheduled_at: scheduled_at || announcement.scheduled_at,
      is_published: is_published !== undefined ? is_published : announcement.is_published,
      updated_at: new Date()
    });

    console.log(`✅ Announcement ${id} updated successfully`);

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      announcement: announcement
    });

  } catch (error) {
    console.error('❌ Update announcement error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// DELETE ANNOUNCEMENT - Only National Commissioners
// ============================================
exports.deleteAnnouncement = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // ✅ Check if user has permission
    const allowedRoles = ['national_commissioner', 'national-commissioner', 'super_admin', 'admin'];
    if (!allowedRoles.includes(userRole)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied. National Commissioner or Super Admin role required.'
      });
    }

    const announcement = await Announcement.findByPk(id, { transaction });
    if (!announcement) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // ✅ Delete all notifications linked to this announcement
    const { Notification } = require('../models');
    await Notification.destroy({
      where: { announcement_id: id },
      transaction
    });

    // ✅ Delete the announcement
    await announcement.destroy({ transaction });

    await transaction.commit();

    console.log(`✅ Announcement ${id} deleted successfully`);

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Delete announcement error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// GET ANNOUNCEMENT STATS - Only National Commissioners
// ============================================
exports.getAnnouncementStats = async (req, res) => {
  try {
    const userRole = req.user.role;

    // ✅ Check if user has permission
    const allowedRoles = ['national_commissioner', 'national-commissioner', 'super_admin', 'admin'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. National Commissioner or Super Admin role required.'
      });
    }

    const totalAnnouncements = await Announcement.count();
    const publishedAnnouncements = await Announcement.count({ where: { is_published: true } });
    const draftAnnouncements = await Announcement.count({ where: { is_published: false } });

    const { Notification } = require('../models');
    const totalNotifications = await Notification.count({ where: { type: 'announcement' } });
    const readNotifications = await Notification.count({ 
      where: { 
        type: 'announcement',
        is_read: true 
      } 
    });
    const unreadNotifications = await Notification.count({ 
      where: { 
        type: 'announcement',
        is_read: false 
      } 
    });

    res.json({
      success: true,
      stats: {
        announcements: {
          total: totalAnnouncements,
          published: publishedAnnouncements,
          draft: draftAnnouncements
        },
        notifications: {
          total: totalNotifications,
          read: readNotifications,
          unread: unreadNotifications
        }
      }
    });

  } catch (error) {
    console.error('❌ Get announcement stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};