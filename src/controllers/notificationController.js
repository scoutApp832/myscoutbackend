const { Notification } = require('../models');
const { Op } = require('sequelize');

// ============================================
// GET NOTIFICATIONS - UUID COMPATIBLE
// ============================================
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { filter = 'all', limit = 50, offset = 0 } = req.query;

    console.log(`🔔 Fetching notifications for user: ${userId}`);
    console.log(`📊 Filter: ${filter}`);

    let whereClause = { user_id: userId };
    if (filter === 'unread') {
      whereClause.is_read = false;
    }

    const { count, rows } = await Notification.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: [
        'id',
        'user_id',
        'title',
        'message',
        'type',
        'link',
        'icon',
        'color',
        'metadata',
        'is_read',
        'read_at',
        'created_at',
        'updated_at'
      ]
    });

    const unreadCount = await Notification.count({
      where: { user_id: userId, is_read: false }
    });

    console.log(`✅ Found ${rows.length} notifications`);
    console.log(`📊 ${unreadCount} unread out of ${count} total`);

    const formattedNotifications = rows.map(notification => {
      const plain = notification.get({ plain: true });
      return {
        id: plain.id,
        user_id: plain.user_id,
        title: plain.title,
        message: plain.message,
        type: plain.type || 'general',
        link: plain.link || null,
        icon: plain.icon || null,
        color: plain.color || null,
        metadata: plain.metadata || null,
        is_read: plain.is_read || false,
        read: plain.is_read || false,
        read_at: plain.read_at || null,
        created_at: plain.created_at,
        updated_at: plain.updated_at
      };
    });

    res.status(200).json({
      success: true,
      notifications: formattedNotifications,
      unreadCount: unreadCount || 0,
      pagination: {
        total: count || 0,
        unread: unreadCount || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('❌ Get notifications error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      notifications: [],
      unreadCount: 0
    });
  }
};

// ============================================
// GET UNREAD COUNT
// ============================================
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🔔 Getting unread count for user: ${userId}`);

    const count = await Notification.count({
      where: { user_id: userId, is_read: false }
    });

    res.status(200).json({
      success: true,
      unreadCount: count || 0
    });

  } catch (error) {
    console.error('❌ Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      unreadCount: 0
    });
  }
};

// ============================================
// MARK AS READ - UUID Compatible
// ============================================
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔔 Marking notification ${id} as read for user ${userId}`);

    const notification = await Notification.findOne({
      where: { id: id, user_id: userId }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.update({
      is_read: true,
      read_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('❌ Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

// ============================================
// MARK ALL AS READ
// ============================================
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🔔 Marking all notifications as read for user ${userId}`);

    const [updatedCount] = await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { user_id: userId, is_read: false } }
    );

    res.status(200).json({
      success: true,
      message: `All notifications marked as read`,
      updatedCount: updatedCount || 0
    });

  } catch (error) {
    console.error('❌ Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

// ============================================
// DELETE NOTIFICATION - UUID Compatible
// ============================================
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔔 Deleting notification ${id} for user ${userId}`);

    const deleted = await Notification.destroy({
      where: { id: id, user_id: userId }
    });

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};