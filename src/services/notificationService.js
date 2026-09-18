// src/services/notificationService.js

const { Notification, User, sequelize } = require('../models');
const { Op } = require('sequelize');

class NotificationService {
  
  /**
   * Create notifications for announcement
   */
  static async createAnnouncementNotifications(announcement, targetUserIds) {
    try {
      if (!announcement.create_notification) {
        console.log('⚠️ Notifications disabled for this announcement');
        return [];
      }

      let priority = 'normal';
      if (announcement.announcement_type === 'urgent') priority = 'urgent';
      else if (announcement.announcement_type === 'important') priority = 'high';

      const shortMessage = announcement.content.length > 100 
        ? announcement.content.substring(0, 100) + '...' 
        : announcement.content;

      const notifications = [];
      for (const userId of targetUserIds) {
        const notification = await Notification.create({
          user_id: userId,
          announcement_id: announcement.id,
          title: `📢 ${announcement.title}`,
          message: shortMessage,
          type: 'announcement',
          link: `/announcements/${announcement.id}`,
          priority: priority,
          is_read: false,
          created_at: new Date(),
          updated_at: new Date()
        });
        notifications.push(notification);
      }

      console.log(`📬 Created ${notifications.length} notifications for announcement ${announcement.id}`);
      return notifications;

    } catch (error) {
      console.error('❌ Failed to create announcement notifications:', error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Create notification for a single user
   */
  static async createForUser(userId, notificationData) {
    try {
      if (!userId) {
        console.warn('⚠️ No userId provided for notification');
        return null;
      }

      console.log('📬 Creating notification for user:', userId, notificationData.title);

      const notification = await Notification.create({
        user_id: userId,
        title: notificationData.title || 'Notification',
        message: notificationData.message || '',
        type: notificationData.type || 'system',
        priority: notificationData.priority || 'normal',
        link: notificationData.link || null,
        is_read: false,
        created_at: new Date(),
        updated_at: new Date()
      });

      console.log('✅ Notification created:', notification.id);
      return notification;
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
      // Don't throw - just log the error so the main operation doesn't fail
      return null;
    }
  }

  /**
   * ✅ NEW: Create course enrollment notifications
   */
  static async createCourseEnrollmentNotifications(course, user) {
    try {
      if (!user || !course) {
        console.warn('⚠️ Missing user or course for enrollment notification');
        return null;
      }

      return await this.createForUser(user.id, {
        title: `📚 Enrolled in Course: ${course.title}`,
        message: `You have successfully enrolled in "${course.title}". Start learning now!`,
        type: 'course',
        priority: 'normal',
        link: `/courses/${course.id}`
      });
    } catch (error) {
      console.error('❌ Failed to create enrollment notification:', error);
      return null;
    }
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId) {
    try {
      const count = await Notification.count({
        where: { user_id: userId, is_read: false }
      });
      return count;
    } catch (error) {
      console.error('❌ Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Get notifications for user
   */
  static async getNotifications(userId, limit = 50, offset = 0) {
    try {
      const { count, rows } = await Notification.findAndCountAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: require('../models').Announcement,
            as: 'announcement',
            attributes: ['id', 'title', 'content', 'announcement_type']
          }
        ]
      });

      return {
        notifications: rows,
        total: count,
        unread: await this.getUnreadCount(userId)
      };
    } catch (error) {
      console.error('❌ Failed to get notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, user_id: userId }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.update({
        is_read: true,
        read_at: new Date()
      });

      return notification;
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    try {
      const [updatedCount] = await Notification.update(
        {
          is_read: true,
          read_at: new Date()
        },
        {
          where: { user_id: userId, is_read: false }
        }
      );
      return updatedCount;
    } catch (error) {
      console.error('❌ Failed to mark all as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, user_id: userId }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.destroy();
      return true;
    } catch (error) {
      console.error('❌ Failed to delete notification:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;