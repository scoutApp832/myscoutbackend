// src/utils/notificationHelper.js
const { createNotification, createBulkNotifications } = require('../controllers/notificationController');
const { User, Member } = require('../models');

// Send notification to a single user
const sendNotification = async (userId, data) => {
  return await createNotification({
    userId,
    ...data
  });
};

// Send notification to all scouts
const sendToAllScouts = async (data) => {
  const scouts = await User.findAll({
    where: { role: 'scout' },
    attributes: ['id']
  });

  const userIds = scouts.map(s => s.id);
  return await createBulkNotifications(userIds, data);
};

// Send notification to all members
const sendToAllMembers = async (data) => {
  const members = await User.findAll({
    where: { 
      role: ['scout', 'unit_leader', 'district_commissioner', 'national_commissioner']
    },
    attributes: ['id']
  });

  const userIds = members.map(m => m.id);
  return await createBulkNotifications(userIds, data);
};

// Send notification to a district
const sendToDistrict = async (district, data) => {
  const members = await Member.findAll({
    where: { district: district },
    include: [{ model: User, as: 'user' }]
  });

  const userIds = members.map(m => m.user_id);
  return await createBulkNotifications(userIds, data);
};

module.exports = {
  sendNotification,
  sendToAllScouts,
  sendToAllMembers,
  sendToDistrict
};