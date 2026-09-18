// backend/src/controllers/chatController.js
const { User, Member, ChatMessage, Notification } = require('../models');
const { Op, Sequelize } = require('sequelize');

// ============================================
// HELPER: Check if ChatMessage is available
// ============================================
const isChatAvailable = () => {
  return ChatMessage && typeof ChatMessage.count === 'function';
};

// ============================================
// HELPER: Get role display name
// ============================================
const getRoleDisplay = (role) => {
  const roles = {
    'national_commissioner': 'National Commissioner',
    'national-commissioner': 'National Commissioner',
    'district_commissioner': 'District Commissioner',
    'district-commissioner': 'District Commissioner',
    'unit_leader': 'Unit Leader',
    'unit-leader': 'Unit Leader',
    'scout': 'Scout',
    'donor': 'Donor',
    'admin': 'Admin',
    'super_admin': 'Super Admin',
    'super-admin': 'Super Admin'
  };
  return roles[role] || role || 'Member';
};

// ============================================
// GET ALL CHAT MEMBERS
// ============================================
exports.getMembers = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`👥 Fetching chat members for user: ${userId}`);
    console.log(`📌 ChatMessage available: ${!!ChatMessage}`);
    console.log(`📌 ChatMessage.count: ${typeof ChatMessage?.count}`);

    const users = await User.findAll({
      where: {
        status: 'active',
        id: { [Op.ne]: userId }
      },
      attributes: ['id', 'full_name', 'email', 'role', 'status', 'last_login'],
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'sin', 'first_name', 'last_name', 'district', 'profile_image']
        }
      ],
      order: [['full_name', 'ASC']]
    });

    const chatAvailable = isChatAvailable();

    const membersWithUnread = await Promise.all(users.map(async (user) => {
      let unreadCount = 0;
      let lastMessage = null;

      if (chatAvailable) {
        try {
          unreadCount = await ChatMessage.count({
            where: {
              sender_id: user.id,
              receiver_id: userId,
              is_read: false
            }
          });

          lastMessage = await ChatMessage.findOne({
            where: {
              [Op.or]: [
                { sender_id: userId, receiver_id: user.id },
                { sender_id: user.id, receiver_id: userId }
              ]
            },
            order: [['created_at', 'DESC']]
          });
        } catch (chatError) {
          console.warn(`⚠️ Chat query failed for user ${user.id}:`, chatError.message);
        }
      }

      const isOnline = user.last_login && 
        (new Date() - new Date(user.last_login)) < 5 * 60 * 1000;

      return {
        id: user.id,
        name: user.full_name || user.member?.first_name + ' ' + user.member?.last_name || 'Unknown',
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        roleDisplay: getRoleDisplay(user.role),
        district: user.member?.district || 'N/A',
        online: isOnline,
        last_seen: user.last_login,
        avatar: user.member?.profile_image || null,
        unread: unreadCount || 0,
        lastMessage: lastMessage?.message || null,
        lastMessageTime: lastMessage?.created_at || null
      };
    }));

    membersWithUnread.sort((a, b) => {
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return a.name.localeCompare(b.name);
    });

    console.log(`✅ Found ${membersWithUnread.length} chat members`);

    res.json({
      success: true,
      members: membersWithUnread,
      total: membersWithUnread.length,
      online: membersWithUnread.filter(m => m.online).length,
      chatAvailable: chatAvailable
    });

  } catch (error) {
    console.error('❌ Get chat members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load chat members',
      error: error.message
    });
  }
};

// ============================================
// GET MESSAGES WITH A SPECIFIC USER - FIXED (No Attachments)
// ============================================
// backend/src/controllers/chatController.js - getMessages

exports.getMessages = async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = parseInt(req.user.id);
    const otherId = parseInt(otherUserId);

    console.log(`💬 Fetching messages between ${currentUserId} and ${otherId}`);

    if (isNaN(currentUserId) || isNaN(otherId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!isChatAvailable()) {
      return res.json({
        success: true,
        messages: [],
        total: 0,
        message: 'Chat not available yet'
      });
    }

    // ✅ Remove is_deleted filter for now
    const messages = await ChatMessage.findAll({
      where: {
        [Op.or]: [
          { sender_id: currentUserId, receiver_id: otherId },
          { sender_id: otherId, receiver_id: currentUserId }
        ]
        // ❌ REMOVE: is_deleted: false
      },
      attributes: ['id', 'sender_id', 'receiver_id', 'message', 'is_read', 'read_at', 'created_at', 'updated_at'],
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'full_name', 'email']
        }
      ],
      order: [['created_at', 'ASC']],
      limit: 100
    });

    if (messages.length > 0) {
      await ChatMessage.update(
        { is_read: true, read_at: new Date() },
        {
          where: {
            sender_id: otherId,
            receiver_id: currentUserId,
            is_read: false
          }
        }
      );
    }

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      sender_id: msg.sender_id,
      receiver_id: msg.receiver_id,
      sender_name: msg.sender?.full_name || 'Unknown',
      receiver_name: msg.receiver?.full_name || 'Unknown',
      message: msg.message,
      is_read: msg.is_read,
      read_at: msg.read_at,
      created_at: msg.created_at,
      updated_at: msg.updated_at
    }));

    res.json({
      success: true,
      messages: formattedMessages,
      total: formattedMessages.length
    });

  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load messages',
      error: error.message
    });
  }
};
// ============================================
// DELETE A MESSAGE - ONLY THE SENDER CAN DELETE
// ============================================
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = parseInt(req.user.id);

    console.log(`🗑️ Deleting message ${messageId} by user ${userId}`);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!isChatAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Chat service not available'
      });
    }

    const message = await ChatMessage.findByPk(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    if (message.is_deleted) {
      return res.status(400).json({
        success: false,
        message: 'Message already deleted'
      });
    }

    await message.update({
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: userId,
      message: 'This message was deleted'
    });

    console.log(`✅ Message ${messageId} deleted successfully`);

    res.json({
      success: true,
      message: 'Message deleted successfully',
      messageData: {
        id: message.id,
        is_deleted: true,
        deleted_at: message.deleted_at
      }
    });

  } catch (error) {
    console.error('❌ Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};
// backend/src/controllers/chatController.js - sendMessage

exports.sendMessage = async (req, res) => {
  try {
    const { userId: receiverId } = req.params;
    const { message } = req.body;
    const senderId = parseInt(req.user.id);
    const receiverIdInt = parseInt(receiverId);

    console.log(`📤 Sending message from ${senderId} to ${receiverIdInt}`);
    console.log(`📝 Message: ${message}`);

    if (isNaN(senderId) || isNaN(receiverIdInt)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    if (!isChatAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Chat service not available'
      });
    }

    const receiver = await User.findByPk(receiverIdInt);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // ✅ Remove is_deleted from create (default will handle it)
    const newMessage = await ChatMessage.create({
      sender_id: senderId,
      receiver_id: receiverIdInt,
      message: message.trim(),
      is_read: false,
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log(`✅ Message ${newMessage.id} sent successfully`);

    // Create notification
    try {
      if (Notification && typeof Notification.create === 'function') {
        const sender = await User.findByPk(senderId, {
          attributes: ['id', 'full_name']
        });

        await Notification.create({
          user_id: receiverIdInt,
          type: 'chat_message',
          title: `💬 New message from ${sender?.full_name || 'Someone'}`,
          message: message.trim().substring(0, 100) + (message.length > 100 ? '...' : ''),
          link: `/chat`,
          icon: '💬',
          color: '#6A1B9A',
          is_read: false,
          metadata: {
            sender_id: senderId,
            message_preview: message.trim().substring(0, 50)
          }
        });
      }
    } catch (notifError) {
      console.error('⚠️ Failed to create notification:', notifError.message);
    }

    const createdMessage = await ChatMessage.findByPk(newMessage.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      messageData: {
        id: createdMessage.id,
        sender_id: createdMessage.sender_id,
        receiver_id: createdMessage.receiver_id,
        sender_name: createdMessage.sender?.full_name || 'Unknown',
        message: createdMessage.message,
        is_read: createdMessage.is_read,
        created_at: createdMessage.created_at,
        updated_at: createdMessage.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};
// ============================================
// MARK MESSAGES AS READ
// ============================================
exports.markAsRead = async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = parseInt(req.user.id);
    const otherId = parseInt(otherUserId);

    console.log(`📖 Marking messages from ${otherId} as read for ${currentUserId}`);

    if (isNaN(currentUserId) || isNaN(otherId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!isChatAvailable()) {
      return res.json({
        success: true,
        message: 'Chat not available',
        updated: 0
      });
    }

    const result = await ChatMessage.update(
      { is_read: true, read_at: new Date() },
      {
        where: {
          sender_id: otherId,
          receiver_id: currentUserId,
          is_read: false
        }
      }
    );

    console.log(`✅ Marked ${result[0]} messages as read`);

    res.json({
      success: true,
      message: `Marked ${result[0]} messages as read`,
      updated: result[0]
    });

  } catch (error) {
    console.error('❌ Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
};

// ============================================
// GET UNREAD MESSAGE COUNT
// ============================================
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = parseInt(req.user.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!isChatAvailable()) {
      return res.json({
        success: true,
        unreadCount: 0
      });
    }

    const unreadCount = await ChatMessage.count({
      where: {
        receiver_id: userId,
        is_read: false,
        is_deleted: false
      }
    });

    res.json({
      success: true,
      unreadCount: unreadCount || 0
    });

  } catch (error) {
    console.error('❌ Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
};

// ============================================
// GET RECENT CHATS - FIXED (No Attachments)
// ============================================
exports.getRecentChats = async (req, res) => {
  try {
    const userId = parseInt(req.user.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!isChatAvailable()) {
      return res.json({
        success: true,
        chats: [],
        total: 0
      });
    }

    // ✅ Use raw query without attachments
    const [chats] = await sequelize.query(`
      SELECT 
        CASE 
          WHEN sender_id = ${userId} THEN receiver_id 
          ELSE sender_id 
        END as other_user_id,
        MAX(created_at) as last_message_time
      FROM chat_messages
      WHERE (sender_id = ${userId} OR receiver_id = ${userId})
        AND is_deleted = false
      GROUP BY other_user_id
      ORDER BY last_message_time DESC
      LIMIT 20
    `);

    const result = await Promise.all(chats.map(async (chat) => {
      const otherUserId = chat.other_user_id;

      const lastMessage = await ChatMessage.findOne({
        where: {
          [Op.or]: [
            { sender_id: userId, receiver_id: otherUserId },
            { sender_id: otherUserId, receiver_id: userId }
          ],
          is_deleted: false
        },
        order: [['created_at', 'DESC']]
      });

      const unreadCount = await ChatMessage.count({
        where: {
          sender_id: otherUserId,
          receiver_id: userId,
          is_read: false,
          is_deleted: false
        }
      });

      const otherUser = await User.findByPk(otherUserId, {
        attributes: ['id', 'full_name', 'email', 'role', 'last_login']
      });

      return {
        user_id: otherUserId,
        user_name: otherUser?.full_name || 'Unknown',
        role: otherUser?.role || 'unknown',
        last_message: lastMessage?.message || null,
        last_message_time: lastMessage?.created_at || null,
        unread_count: unreadCount || 0,
        online: otherUser?.last_login && (new Date() - new Date(otherUser.last_login)) < 5 * 60 * 1000
      };
    }));

    res.json({
      success: true,
      chats: result,
      total: result.length
    });

  } catch (error) {
    console.error('❌ Get recent chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent chats',
      error: error.message
    });
  }
};