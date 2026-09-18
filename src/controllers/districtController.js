const { Member, User, Event, EventRegistration, Report, Idea, Announcement, Unit, Notification, District } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

// ============================================
// GET ALL DISTRICTS
// ============================================
exports.getAllDistricts = async (req, res) => {
  try {
    const districts = await District.findAll({
      attributes: ['id', 'name', 'code', 'province', 'status'],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      districts: districts.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        province: d.province,
        status: d.status
      }))
    });
  } catch (error) {
    console.error('Get all districts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get districts',
      error: error.message
    });
  }
};

// ============================================
// GET DISTRICT INFO (Only for logged-in user's district)
// ============================================
exports.getDistrictInfo = async (req, res) => {
  try {
    const member = req.user?.member;
    const district = member?.district || req.user?.district;

    if (!district) {
      return res.status(404).json({
        success: false,
        message: 'District not found for user'
      });
    }

    let districtDetails = null;
    if (member?.district_id) {
      const districtRecord = await District.findByPk(member.district_id);
      if (districtRecord) {
        districtDetails = districtRecord.toJSON();
      }
    }

    res.json({
      success: true,
      district: {
        name: district,
        id: member?.district_id || req.user?.district_id || null,
        details: districtDetails
      }
    });
  } catch (error) {
    console.error('Get district info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get district info',
      error: error.message
    });
  }
};

// ============================================
// DASHBOARD STATS
// ============================================
exports.getStats = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    if (!district) {
      return res.status(400).json({ 
        success: false, 
        message: 'District not found for user',
        stats: {
          totalScouts: 0,
          totalLeaders: 0,
          activeMembers: 0,
          inactiveMembers: 0,
          upcomingEvents: 0,
          ongoingEvents: 0,
          pendingRegistrations: 0,
          pendingFeeApprovals: 0,
          reportsAwaiting: 0,
          projectSubmissions: 0
        }
      });
    }

    const totalScouts = await Member.count({ where: { district } });
    const totalLeaders = await User.count({
      where: { role: 'unit_leader' },
      include: [{ model: Member, as: 'member', where: { district } }]
    });

    const activeMembers = await Member.count({ 
      where: { district, membership_status: 'active' } 
    });
    const pendingRegistrations = await Member.count({ 
      where: { district, membership_status: 'pending' } 
    });
    const upcomingEvents = await Event.count({
      where: { location: district, status: 'upcoming' }
    });

    res.json({
      totalScouts,
      totalLeaders,
      activeMembers,
      inactiveMembers: totalScouts - activeMembers,
      upcomingEvents,
      ongoingEvents: await Event.count({ 
        where: { location: district, status: 'ongoing' } 
      }),
      pendingRegistrations,
      pendingFeeApprovals: await Member.count({ 
        where: { district, fee_status: 'pending' } 
      }),
      reportsAwaiting: await Report.count({ 
        where: { district, status: 'pending' } 
      }),
      projectSubmissions: 0
    });
  } catch (error) {
    console.error('Get district stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get stats', 
      error: error.message 
    });
  }
};

// ============================================
// RECENT ACTIVITIES
// ============================================
exports.getRecentActivities = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    const reports = await Report.findAll({
      where: { district },
      limit: 5,
      order: [['created_at', 'DESC']]
    });

    const registrations = await EventRegistration.findAll({
      where: { district },
      limit: 5,
      order: [['created_at', 'DESC']]
    });

    const activities = [...reports, ...registrations].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    ).slice(0, 5);

    res.json(activities.map(a => ({
      id: a.id,
      title: a.title || 'Registration',
      status: a.status || 'pending',
      date: a.created_at
    })));
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get activities', 
      error: error.message 
    });
  }
};

// ============================================
// UPCOMING EVENTS
// ============================================
exports.getUpcomingEvents = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    const events = await Event.findAll({
      where: { 
        location: district, 
        status: 'upcoming',
        start_date: { [Op.gte]: new Date() }
      },
      limit: 5,
      order: [['start_date', 'ASC']]
    });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get events', 
      error: error.message 
    });
  }
};

// ============================================
// ANNOUNCEMENTS
// ============================================
exports.getAnnouncements = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    console.log(`📢 District fetching announcements for district: ${district}`);

    let whereClause = { 
      status: 'published'
    };

    if (!district) {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { district: 'all' },
          { district: null }
        ]
      };
    } else {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { district: 'all' },
          { district: district },
          { district: null }
        ]
      };
    }

    console.log(`📊 Where clause: ${JSON.stringify(whereClause)}`);

    const announcements = await Announcement.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      attributes: [
        'id', 'title', 'content', 'announcement_type', 'district',
        'audience', 'send_email', 'status', 'author_id', 'signature',
        'schedule_date', 'published_date', 'created_at', 'updated_at'
      ],
      include: [
        { 
          model: User, 
          as: 'author',
          attributes: ['id', 'full_name', 'email'] 
        }
      ]
    });

    console.log(`✅ Found ${announcements.length} announcements`);

    const formattedAnnouncements = announcements.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      message: item.content,
      announcement_type: item.announcement_type,
      type: item.announcement_type,
      district: item.district,
      audience: item.audience || ['all'],
      send_email: item.send_email,
      status: item.status,
      author_id: item.author_id,
      signature: item.signature,
      schedule_date: item.schedule_date,
      published_date: item.published_date,
      created_at: item.created_at,
      updated_at: item.updated_at,
      author: item.author || { full_name: 'Commissioner' },
      is_read: false,
      read: false
    }));

    res.json({
      success: true,
      announcements: formattedAnnouncements
    });
  } catch (error) {
    console.error('❌ Get district announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get announcements',
      error: error.message,
      announcements: []
    });
  }
};

// ============================================
// CREATE ANNOUNCEMENT
// ============================================
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, type, district, audience, send_email, signature } = req.body;
    const user = req.user;
    const userDistrict = user?.district || user?.member?.district;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    console.log(`📢 Creating announcement: "${title}" for district: ${userDistrict}`);

    const announcement = await Announcement.create({
      title,
      content,
      announcement_type: type || 'general',
      district: district || userDistrict || 'all',
      audience: audience || ['all'],
      send_email: send_email || false,
      status: 'published',
      author_id: user.id,
      signature: signature || null,
      published_date: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log(`✅ Announcement created with ID: ${announcement.id}`);

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      announcement: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        announcement_type: announcement.announcement_type,
        district: announcement.district,
        audience: announcement.audience,
        send_email: announcement.send_email,
        status: announcement.status,
        author_id: announcement.author_id,
        signature: announcement.signature,
        published_date: announcement.published_date,
        created_at: announcement.created_at
      }
    });
  } catch (error) {
    console.error('❌ Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement',
      error: error.message
    });
  }
};

// ============================================
// UPDATE ANNOUNCEMENT
// ============================================
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, audience, status, send_email, signature } = req.body;
    const userId = req.user.id;

    const announcement = await Announcement.findOne({
      where: {
        id,
        [Op.or]: [
          { author_id: userId },
          { district: req.user?.district || req.user?.member?.district }
        ]
      }
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found or you do not have permission to update it'
      });
    }

    await announcement.update({
      title: title || announcement.title,
      content: content || announcement.content,
      announcement_type: type || announcement.announcement_type,
      audience: audience || announcement.audience,
      status: status || announcement.status,
      send_email: send_email !== undefined ? send_email : announcement.send_email,
      signature: signature || announcement.signature,
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      announcement
    });
  } catch (error) {
    console.error('❌ Update announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement',
      error: error.message
    });
  }
};

// ============================================
// DELETE ANNOUNCEMENT
// ============================================
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const announcement = await Announcement.findOne({
      where: {
        id,
        [Op.or]: [
          { author_id: userId },
          { district: req.user?.district || req.user?.member?.district }
        ]
      }
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found or you do not have permission to delete it'
      });
    }

    await announcement.destroy();

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement',
      error: error.message
    });
  }
};

// ============================================
// NOTIFICATIONS
// ============================================
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { filter = 'all', limit = 50, offset = 0 } = req.query;

    console.log(`🔔 Getting notifications for user: ${userId}`);
    console.log(`📊 Filter: ${filter}, Limit: ${limit}, Offset: ${offset}`);

    let whereClause = { user_id: userId };
    if (filter === 'unread') {
      whereClause.is_read = false;
    }

    const notifications = await Notification.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`✅ Found ${notifications.length} notifications`);

    const unreadCount = await Notification.count({
      where: { user_id: userId, is_read: false }
    });

    console.log(`✅ Unread count: ${unreadCount}`);

    res.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      pagination: {
        total: notifications.length,
        unread: unreadCount || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: error.message,
      notifications: []
    });
  }
};

// ============================================
// CHART DATA - Troop Name Distribution (Only for logged-in user's district)
// ============================================
exports.getChartData = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    if (!district) {
      return res.status(400).json({ 
        success: false, 
        message: 'District not found',
        data: []
      });
    }

    console.log(`📊 Getting troop data for district: ${district}`);

    const members = await Member.findAll({
      where: { district: district },
      attributes: ['troop_name']
    });

    console.log(`✅ Found ${members.length} members in district: ${district}`);

    const troopCount = {};
    members.forEach(m => {
      const troop = m.troop_name || 'Unassigned';
      troopCount[troop] = (troopCount[troop] || 0) + 1;
    });

    const chartData = Object.keys(troopCount).map(name => ({
      name: name,
      members: troopCount[name]
    }));

    console.log(`📊 Troop data for ${district}:`, chartData);

    res.json(chartData);
  } catch (error) {
    console.error('Get chart data error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get chart data', 
      error: error.message,
      data: []
    });
  }
};

// ============================================
// STATUS DATA - Membership by Status (Only for logged-in user's district)
// ============================================
exports.getStatusData = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    if (!district) {
      return res.status(400).json({ 
        success: false, 
        message: 'District not found',
        data: []
      });
    }

    console.log(`📊 Getting status data for district: ${district}`);

    const active = await Member.count({ 
      where: { district: district, membership_status: 'active' } 
    });
    const pending = await Member.count({ 
      where: { district: district, membership_status: 'pending' } 
    });
    const inactive = await Member.count({ 
      where: { district: district, membership_status: 'inactive' } 
    });

    const statusData = [
      { name: 'Active', value: active },
      { name: 'Pending', value: pending },
      { name: 'Inactive', value: inactive }
    ].filter(item => item.value > 0);

    console.log(`📊 Status data for ${district}:`, statusData);

    res.json(statusData);
  } catch (error) {
    console.error('Get status data error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get status data', 
      error: error.message 
    });
  }
};

// ============================================
// GENDER DATA - Only ONE version (filters by district)
// ============================================
exports.getGenderData = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    if (!district) {
      return res.status(400).json({ 
        success: false, 
        message: 'District not found',
        data: []
      });
    }

    console.log(`📊 Getting gender data for district: ${district}`);

    const males = await Member.count({ 
      where: { district: district, gender: 'male' } 
    });
    const females = await Member.count({ 
      where: { district: district, gender: 'female' } 
    });
    const others = await Member.count({ 
      where: { district: district, gender: 'other' } 
    });

    const genderData = [
      { name: 'Male', value: males },
      { name: 'Female', value: females }
    ];

    if (others > 0) {
      genderData.push({ name: 'Other', value: others });
    }

    console.log(`📊 Gender data for ${district}:`, genderData);

    res.json(genderData);
  } catch (error) {
    console.error('Get gender data error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get gender data', 
      error: error.message 
    });
  }
};

// ============================================
// LEADERS
// ============================================
exports.getLeaders = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    if (!district) {
      return res.status(400).json({ 
        success: false, 
        message: 'District not assigned',
        leaders: []
      });
    }

    const leaders = await User.findAll({
      where: { role: 'unit_leader' },
      include: [{ model: Member, as: 'member', where: { district } }],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, leaders });
  } catch (error) {
    console.error('Get leaders error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get leaders', 
      error: error.message 
    });
  }
};

exports.createLeader = async (req, res) => {
  try {
    const { email, password, fullName, phone, ...memberData } = req.body;
    const member = req.user.member;
    const district = member?.district || req.user.district;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already exists' 
      });
    }

    const user = await User.create({
      email,
      password_hash: password,
      full_name: fullName,
      phone,
      role: 'unit_leader',
      status: 'active'
    });

    const newMember = await Member.create({
      user_id: user.id,
      first_name: fullName.split(' ')[0],
      last_name: fullName.split(' ').slice(1).join(' ') || fullName,
      district: district,
      ...memberData,
      membership_status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'Unit Leader created successfully',
      user,
      member: newMember
    });
  } catch (error) {
    console.error('Create leader error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create leader', 
      error: error.message 
    });
  }
};

exports.updateLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, ...memberData } = req.body;

    const user = await User.findByPk(id, {
      include: [{ model: Member, as: 'member' }]
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Leader not found' 
      });
    }

    await user.update({ full_name: fullName, phone });
    if (user.member) {
      await user.member.update(memberData);
    }

    res.json({ 
      success: true, 
      message: 'Leader updated successfully' 
    });
  } catch (error) {
    console.error('Update leader error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update leader', 
      error: error.message 
    });
  }
};

exports.toggleLeaderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await User.findByPk(id, {
      include: [{ model: Member, as: 'member' }]
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Leader not found' 
      });
    }

    await user.update({ status });
    if (user.member) {
      await user.member.update({ membership_status: status });
    }

    res.json({
      success: true,
      message: `Leader ${status === 'active' ? 'activated' : 'deactivated'}`
    });
  } catch (error) {
    console.error('Toggle leader status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update status', 
      error: error.message 
    });
  }
};

// ============================================
// MEMBERS - ALL CRUD OPERATIONS
// ============================================

// ✅ GET ALL MEMBERS
exports.getMembers = async (req, res) => {
  try {
    const { search } = req.query;
    const member = req.user.member;
    const district = member?.district || req.user.district;

    if (!district) {
      return res.status(400).json({ 
        success: false, 
        message: 'District not assigned',
        members: []
      });
    }

    const where = { district };
    const include = [{ model: User, as: 'user' }];

    let members;
    if (search) {
      const searchLower = search.toLowerCase();
      members = await Member.findAll({
        where,
        include,
        order: [['created_at', 'DESC']]
      });
      
      members = members.filter(m =>
        m.user?.full_name?.toLowerCase().includes(searchLower) ||
        m.user?.email?.toLowerCase().includes(searchLower) ||
        m.sin?.toLowerCase().includes(searchLower) ||
        m.first_name?.toLowerCase().includes(searchLower) ||
        m.last_name?.toLowerCase().includes(searchLower)
      );
    } else {
      members = await Member.findAll({
        where,
        include,
        order: [['created_at', 'DESC']]
      });
    }

    res.json({ success: true, members });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get members', 
      error: error.message 
    });
  }
};

// ✅ GET MEMBER BY ID
exports.getMemberById = async (req, res) => {
  try {
    const { id } = req.params;
    const member = req.user.member;
    const district = member?.district || req.user.district;

    const foundMember = await Member.findOne({
      where: { id, district },
      include: [{ model: User, as: 'user' }]
    });

    if (!foundMember) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }

    res.json({ success: true, member: foundMember });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get member', 
      error: error.message 
    });
  }
};

// ✅ UPDATE MEMBER
exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, fullName, phone, ...memberData } = req.body;
    const member = req.user.member;
    const district = member?.district || req.user.district;

    const foundMember = await Member.findOne({
      where: { id, district },
      include: [{ model: User, as: 'user' }]
    });

    if (!foundMember) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }

    if (email || fullName || phone) {
      await foundMember.user.update({
        email: email || foundMember.user.email,
        full_name: fullName || foundMember.user.full_name,
        phone: phone || foundMember.user.phone
      });
    }

    await foundMember.update(memberData);
    res.json({ 
      success: true, 
      message: 'Member updated successfully' 
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update member', 
      error: error.message 
    });
  }
};

// ✅ PROMOTE MEMBER TO UNIT LEADER
exports.promoteToLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { unit } = req.body;
    const adminUser = req.user;

    const adminMember = await Member.findOne({
      where: { user_id: adminUser.id }
    });

    if (!adminMember) {
      return res.status(404).json({
        success: false,
        message: 'Admin member profile not found'
      });
    }

    const district = adminMember.district;

    if (!district) {
      return res.status(400).json({
        success: false,
        message: 'District not assigned to admin'
      });
    }

    const member = await Member.findOne({
      where: { id, district },
      include: [{ model: User, as: 'user' }]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in your district'
      });
    }

    if (member.membership_type === 'unit_leader' || member.user?.role === 'unit_leader') {
      return res.status(400).json({
        success: false,
        message: 'This member is already a Unit Leader'
      });
    }

    if (member.user) {
      await member.user.update({
        role: 'unit_leader'
      });
    }

    await member.update({
      unit: unit || member.unit,
      membership_type: 'unit_leader'
    });

    console.log(`Member ${member.id} promoted to Unit Leader in district ${district}`);

    res.json({
      success: true,
      message: 'Member promoted to Unit Leader successfully',
      member: {
        id: member.id,
        sin: member.sin,
        full_name: member.user?.full_name || member.first_name + ' ' + member.last_name,
        unit: member.unit,
        role: 'unit_leader'
      }
    });
  } catch (error) {
    console.error('Promote to leader error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to promote member to Unit Leader',
      error: error.message
    });
  }
};

// ============================================
// EVENT FUNCTIONS
// ============================================
exports.getEvents = async (req, res) => {
  try {
    const member = req.user.member;
    const userDistrictId = member?.district_id || req.user.district_id;
    const userDistrictName = member?.district || req.user.district;

    console.log(`📊 Getting events for district: ${userDistrictName} (ID: ${userDistrictId})`);

    const events = await Event.findAll({
      where: {
        [Op.or]: [
          { 
            district_id: userDistrictId,
            scope: 'district'
          },
          {
            location: userDistrictName,
            scope: 'district'
          },
          {
            scope: 'national',
            is_national: true
          }
        ]
      },
      include: [
        { model: District, as: 'district' },
        { model: User, as: 'creator' }
      ],
      order: [['start_date', 'DESC']]
    });

    console.log(`✅ Found ${events.length} events`);

    const processedEvents = events.map(event => {
      const isNational = event.is_national || event.scope === 'national';
      const isUsersDistrict = event.district_id === userDistrictId || 
                             event.location === userDistrictName;
      
      return {
        ...event.toJSON(),
        permissions: {
          canView: true,
          canCreate: isUsersDistrict || false,
          canEdit: isUsersDistrict && !isNational,
          canDelete: isUsersDistrict && !isNational,
          canCancel: isUsersDistrict && !isNational,
          canManageRegistrations: isUsersDistrict && !isNational,
          canApproveReject: isUsersDistrict && !isNational,
          canMarkAttendance: isUsersDistrict && !isNational,
          canRegister: true,
          isNational: isNational,
          isDistrict: !isNational,
          isUsersDistrict: isUsersDistrict,
          reason: isNational ? '🌍 National Event - Available to all members' : 
                  !isUsersDistrict ? 'This event belongs to another district' : null
        }
      };
    });

    res.json({ success: true, events: processedEvents });
  } catch (error) {
    console.error('❌ Get events error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get events', 
      error: error.message 
    });
  }
};

exports.getEventDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, event });
  } catch (error) {
    console.error('Get event details error:', error);
    res.status(500).json({ success: false, message: 'Failed to get event details', error: error.message });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ success: true, message: 'Event created', event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, message: 'Failed to create event', error: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    await event.update(req.body);
    res.json({ success: true, message: 'Event updated', event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ success: false, message: 'Failed to update event', error: error.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    await event.destroy();
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event', error: error.message });
  }
};

exports.cancelEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    await event.update({ status: 'cancelled' });
    res.json({ success: true, message: 'Event cancelled', event });
  } catch (error) {
    console.error('Cancel event error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel event', error: error.message });
  }
};

// ============================================
// REGISTRATION FUNCTIONS
// ============================================
exports.getEventRegistrations = async (req, res) => {
  try {
    const { id } = req.params;
    
    const registrations = await EventRegistration.findAll({
      where: { event_id: id },
      include: [
        { 
          model: Member, 
          as: 'member',
          include: [{ model: User, as: 'user' }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const stats = {
      total: registrations.length,
      pending: registrations.filter(r => r.status === 'pending').length,
      approved: registrations.filter(r => r.status === 'approved').length,
      rejected: registrations.filter(r => r.status === 'rejected').length,
      cancelled: registrations.filter(r => r.status === 'cancelled').length,
      present: registrations.filter(r => r.attendance_status === 'present').length,
      absent: registrations.filter(r => r.attendance_status === 'absent').length
    };

    res.json({ 
      success: true, 
      registrations,
      stats
    });
  } catch (error) {
    console.error('❌ Get registrations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get registrations', 
      error: error.message 
    });
  }
};

exports.approveRegistration = async (req, res) => {
  try {
    const { id, registrationId } = req.params;
    const registration = await EventRegistration.findByPk(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    await registration.update({ status: 'approved' });
    res.json({ success: true, message: 'Registration approved' });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve registration', error: error.message });
  }
};

exports.rejectRegistration = async (req, res) => {
  try {
    const { id, registrationId } = req.params;
    const registration = await EventRegistration.findByPk(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    await registration.update({ status: 'rejected' });
    res.json({ success: true, message: 'Registration rejected' });
  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject registration', error: error.message });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const { id, registrationId } = req.params;
    const { status } = req.body;
    const registration = await EventRegistration.findByPk(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    await registration.update({
      attendance_status: status || 'present',
      attended_at: status === 'present' ? new Date() : null
    });
    res.json({ success: true, message: 'Attendance marked' });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark attendance', error: error.message });
  }
};

exports.registerForEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.user.member?.id;
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Member not found' });
    }
    const registration = await EventRegistration.create({
      event_id: id,
      member_id: memberId,
      status: 'pending'
    });
    res.status(201).json({ success: true, message: 'Registered successfully', registration });
  } catch (error) {
    console.error('Register for event error:', error);
    res.status(500).json({ success: false, message: 'Failed to register', error: error.message });
  }
};

exports.getRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.user.member?.id;
    const registration = await EventRegistration.findOne({
      where: { event_id: id, member_id: memberId }
    });
    res.json({ success: true, registered: !!registration, registration });
  } catch (error) {
    console.error('Get registration status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get status', error: error.message });
  }
};

exports.cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.user.member?.id;
    const registration = await EventRegistration.findOne({
      where: { event_id: id, member_id: memberId }
    });
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    await registration.update({ status: 'cancelled' });
    res.json({ success: true, message: 'Registration cancelled' });
  } catch (error) {
    console.error('Cancel registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel registration', error: error.message });
  }
};

// ============================================
// GENERATE ATTENDANCE LINK WITH NOTIFICATIONS
// ============================================
exports.generateAttendanceLink = async (req, res) => {
  try {
    const { id } = req.params;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const attendanceLink = `${baseUrl}/attendance/${token}`;

    const event = await Event.findByPk(id, {
      attributes: ['id', 'title', 'start_date', 'end_date', 'location']
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await Event.update(
      {
        attendance_token: token,
        attendance_link: attendanceLink,
        attendance_link_expires: expiresAt,
        attendance_link_generated: true,
        attendance_link_generated_at: new Date()
      },
      { where: { id } }
    );

    const registrations = await EventRegistration.findAll({
      where: { 
        event_id: id, 
        status: 'approved' 
      },
      include: [
        { 
          model: Member, 
          as: 'member',
          include: [{ model: User, as: 'user' }]
        }
      ]
    });

    console.log(`📤 Sending attendance link to ${registrations.length} registered users`);

    const notificationPromises = registrations.map(async (registration) => {
      const user = registration.member?.user;
      if (!user) return;

      try {
        await Notification.create({
          user_id: user.id,
          type: 'attendance_link',
          title: '📋 Attendance Link Available',
          message: `Attendance link for "${event.title}" is now available. Click to mark your attendance. Link expires in 30 minutes.`,
          link: attendanceLink,
          icon: '📋',
          color: '#4299e1',
          is_read: false,
          metadata: {
            event_id: event.id,
            event_title: event.title,
            attendance_link: attendanceLink,
            expires_at: expiresAt,
            token: token
          }
        });
        console.log(`✅ Notification sent to user: ${user.email} with link: ${attendanceLink}`);
      } catch (err) {
        console.error(`❌ Failed to send notification to user ${user.id}:`, err.message);
      }
    });

    await Promise.all(notificationPromises);

    console.log(`✅ Attendance link generated and notifications sent to ${registrations.length} users`);

    res.json({
      success: true,
      message: `Attendance link generated and sent to ${registrations.length} registered users!`,
      data: {
        attendance_link: attendanceLink,
        expires_at: expiresAt,
        notifications_sent: registrations.length,
        event_title: event.title
      }
    });
  } catch (error) {
    console.error('❌ Generate attendance link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate attendance link',
      error: error.message
    });
  }
};

exports.getAttendanceLinkStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, data: { attendance_link: event.attendance_link, expires_at: event.attendance_link_expires } });
  } catch (error) {
    console.error('Get attendance link status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get status', error: error.message });
  }
};

exports.regenerateAttendanceLink = async (req, res) => {
  try {
    const { id } = req.params;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const attendanceLink = `${baseUrl}/attendance/${token}`;

    const event = await Event.findByPk(id, {
      attributes: ['id', 'title']
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await Event.update(
      {
        attendance_token: token,
        attendance_link: attendanceLink,
        attendance_link_expires: expiresAt,
        attendance_link_generated: true,
        attendance_link_generated_at: new Date()
      },
      { where: { id } }
    );

    const registrations = await EventRegistration.findAll({
      where: { 
        event_id: id, 
        status: 'approved' 
      },
      include: [
        { 
          model: Member, 
          as: 'member',
          include: [{ model: User, as: 'user' }]
        }
      ]
    });

    const notificationPromises = registrations.map(async (registration) => {
      const user = registration.member?.user;
      if (!user) return;

      try {
        await Notification.create({
          user_id: user.id,
          type: 'attendance_link',
          title: '🔄 New Attendance Link Generated',
          message: `A new attendance link for "${event.title}" has been generated. Previous link is no longer valid. Link expires in 30 minutes.`,
          link: attendanceLink,
          icon: '🔄',
          color: '#ed8936',
          is_read: false,
          metadata: {
            event_id: event.id,
            event_title: event.title,
            attendance_link: attendanceLink,
            expires_at: expiresAt,
            token: token
          }
        });
      } catch (err) {
        console.error(`❌ Failed to send notification:`, err.message);
      }
    });

    await Promise.all(notificationPromises);

    res.json({
      success: true,
      message: `Attendance link regenerated and sent to ${registrations.length} registered users!`,
      data: {
        attendance_link: attendanceLink,
        expires_at: expiresAt,
        notifications_sent: registrations.length
      }
    });
  } catch (error) {
    console.error('❌ Regenerate attendance link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate attendance link',
      error: error.message
    });
  }
};

exports.deleteAttendanceLink = async (req, res) => {
  try {
    const { id } = req.params;
    await Event.update(
      {
        attendance_token: null,
        attendance_link: null,
        attendance_link_expires: null,
        attendance_link_generated: false,
        attendance_link_generated_at: null
      },
      { where: { id } }
    );
    res.json({ success: true, message: 'Attendance link deleted' });
  } catch (error) {
    console.error('Delete attendance link error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete link', error: error.message });
  }
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const registrations = await EventRegistration.findAll({
      where: { event_id: id }
    });
    const summary = {
      total: registrations.length,
      present: registrations.filter(r => r.attendance_status === 'present').length,
      absent: registrations.filter(r => r.attendance_status === 'absent').length,
      pending: registrations.filter(r => r.status === 'pending').length,
      approved: registrations.filter(r => r.status === 'approved').length
    };
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get summary', error: error.message });
  }
};

exports.exportAttendanceList = async (req, res) => {
  try {
    const { id } = req.params;
    const registrations = await EventRegistration.findAll({
      where: { event_id: id },
      include: [{ model: Member, as: 'member' }]
    });
    const data = registrations.map(r => ({
      name: r.member?.full_name || 'Unknown',
      email: r.member?.user?.email || 'N/A',
      status: r.attendance_status || 'Not marked'
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to export', error: error.message });
  }
};

// ============================================
// REPORTS
// ============================================
exports.getReports = async (req, res) => {
  try {
    const member = req.user.member;
    const district = member?.district || req.user.district;

    if (!district) {
      return res.status(400).json({ 
        success: false, 
        message: 'District not assigned',
        reports: []
      });
    }

    const reports = await Report.findAll({
      where: { district },
      attributes: [
        'id', 'title', 'description', 'content', 'activity_type',
        'activity_date', 'location', 'participants_count',
        'achievements', 'challenges', 'recommendations',
        'status', 'feedback', 'file_urls', 'created_by', 'submitted_by',
        'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
        'district', 'unit_id', 'type', 
        'published_to_public', 'published_to_donors',
        'forwarded_to_national',
        'forwarded_to_national_at',
        'forwarded_to_national_by'
      ],
      include: [
        { 
          model: Member, 
          as: 'submitter',
          attributes: ['id', 'first_name', 'last_name', 'district']
        },
        { 
          model: User, 
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        },
        { 
          model: User, 
          as: 'reviewer',
          attributes: ['id', 'full_name', 'email']
        },
        { 
          model: Unit, 
          as: 'unit',
          attributes: ['id', 'name']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    console.log(`✅ Found ${reports.length} reports for district: ${district}`);
    
    res.json({ 
      success: true, 
      reports 
    });
  } catch (error) {
    console.error('❌ Get reports error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get reports', 
      error: error.message 
    });
  }
};

// ✅ APPROVE ONLY
exports.approveOnly = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Report not found' 
      });
    }

    if (!['district_commissioner', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only District Commissioner can approve reports'
      });
    }

    report.status = 'approved';
    report.feedback = feedback || report.feedback;
    report.reviewed_by = req.user.id;
    report.reviewed_at = new Date();

    await report.save();

    console.log(`✅ Report ${id} approved by District Commissioner (NOT forwarded)`);

    res.json({
      success: true,
      message: 'Report approved successfully! (Not forwarded to National)',
      report: report
    });

  } catch (error) {
    console.error('❌ Error approving report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve report',
      error: error.message
    });
  }
};

// ✅ APPROVE & FORWARD
exports.approveAndForward = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    console.log(`📤 Approving and forwarding report ${id} to National Commissioner`);

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Report not found' 
      });
    }

    if (!['district_commissioner', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only District Commissioner can approve and forward reports'
      });
    }

    await report.update({
      status: 'approved',
      feedback: feedback || report.feedback,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      forwarded_to_national: true,
      forwarded_to_national_at: new Date(),
      forwarded_to_national_by: req.user.id
    });

    await report.reload();

    console.log(`✅ Report ${id} approved and forwarded to National Commissioner`);
    console.log(`📊 forwarded_to_national: ${report.forwarded_to_national}`);

    res.json({
      success: true,
      message: 'Report approved and forwarded to National Commissioner!',
      report: report
    });

  } catch (error) {
    console.error('❌ Error approving and forwarding report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve and forward report',
      error: error.message
    });
  }
};

// ✅ FORWARD TO NATIONAL
exports.forwardToNational = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await report.update({
      forwarded_to_national: true,
      forwarded_to_national_at: new Date(),
      forwarded_to_national_by: req.user.id,
      feedback: feedback || report.feedback
    });

    console.log(`✅ Report ${id} forwarded to National Commissioner`);
    console.log(`📊 forwarded_to_national: ${report.forwarded_to_national}`);

    res.json({
      success: true,
      message: 'Report forwarded to National Commissioner successfully!',
      report: report
    });

  } catch (error) {
    console.error('❌ Error forwarding report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to forward report',
      error: error.message
    });
  }
};

// ✅ REJECT REPORT
exports.rejectReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Feedback is required for rejection'
      });
    }

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Report not found' 
      });
    }

    if (!['district_commissioner', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only District Commissioner can reject reports'
      });
    }

    report.status = 'rejected';
    report.feedback = feedback.trim();
    report.reviewed_by = req.user.id;
    report.reviewed_at = new Date();

    await report.save();

    console.log(`❌ Report ${id} rejected by District Commissioner`);

    res.json({ 
      success: true, 
      message: 'Report rejected', 
      report 
    });
  } catch (error) {
    console.error('Reject report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reject report', 
      error: error.message 
    });
  }
};

// ✅ ARCHIVE REPORT
exports.archiveReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Report not found' 
      });
    }

    await report.update({ status: 'archived' });
    res.json({ 
      success: true, 
      message: 'Report archived' 
    });
  } catch (error) {
    console.error('Archive report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to archive report', 
      error: error.message 
    });
  }
};

// ============================================
// IDEA FUNCTIONS - District Commissioner
// ============================================
exports.getDistrictIdeas = async (req, res) => {
  try {
    const { category, status } = req.query;
    const user = req.user;
    
    console.log(`🏛️ District Commissioner fetching ideas for user: ${user.id}`);
    
    const member = await Member.findOne({
      where: { user_id: user.id },
      attributes: ['district']
    });
    
    const userDistrict = member?.district || user.district_id;
    
    if (!userDistrict) {
      return res.status(400).json({
        success: false,
        message: 'District not found for this user'
      });
    }
    
    console.log(`📍 District: ${userDistrict}`);
    
    const whereClause = {
      recipient: 'district-commissioner',
      district: userDistrict
    };
    
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    
    console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));
    
    const ideas = await Idea.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });
    
    console.log(`✅ Found ${ideas.length} ideas for District Commissioner of ${userDistrict}`);
    
    const formattedIdeas = ideas.map(idea => ({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      recipient: idea.recipient,
      status: idea.status,
      feedback: idea.feedback,
      response: idea.response,
      suggestion: idea.suggestion,
      district: idea.district,
      submittedBy: idea.creator?.full_name || 'Unknown',
      date: idea.created_at ? new Date(idea.created_at).toISOString().split('T')[0] : null,
      created_at: idea.created_at,
      creator: idea.creator
    }));
    
    res.json({
      success: true,
      total: formattedIdeas.length,
      ideas: formattedIdeas
    });
    
  } catch (error) {
    console.error('❌ Error fetching district ideas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ideas',
      error: error.message
    });
  }
};

// ✅ REVIEW IDEA
exports.reviewIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback, response } = req.body;
    const user = req.user;
    
    const member = await Member.findOne({
      where: { user_id: user.id },
      attributes: ['district']
    });
    
    const userDistrict = member?.district || user.district_id;
    
    const idea = await Idea.findByPk(id);
    
    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }
    
    if (idea.recipient !== 'district-commissioner') {
      return res.status(403).json({
        success: false,
        message: 'This idea was not sent to District Commissioner'
      });
    }
    
    if (idea.district !== userDistrict) {
      return res.status(403).json({
        success: false,
        message: 'You can only review ideas from your district'
      });
    }
    
    await idea.update({
      status: status || idea.status,
      feedback: feedback || idea.feedback,
      response: response || idea.response
    });
    
    if (idea.user_id) {
      await Notification.create({
        user_id: idea.user_id,
        type: 'idea_reviewed',
        title: 'Idea Reviewed by District Commissioner',
        message: `Your idea "${idea.title}" has been reviewed by District Commissioner ${user.full_name}`,
        related_id: idea.id,
        related_type: 'idea',
        is_read: false
      });
    }
    
    console.log(`✅ Idea ${id} reviewed by District Commissioner ${user.full_name}`);
    
    res.json({
      success: true,
      message: 'Idea reviewed successfully',
      idea: idea
    });
    
  } catch (error) {
    console.error('❌ Error reviewing idea:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review idea',
      error: error.message
    });
  }
};

// ✅ DELETE IDEA
exports.deleteIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    const member = await Member.findOne({
      where: { user_id: user.id },
      attributes: ['district']
    });
    
    const userDistrict = member?.district || user.district_id;
    
    const idea = await Idea.findByPk(id);
    
    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }
    
    if (idea.recipient !== 'district-commissioner') {
      return res.status(403).json({
        success: false,
        message: 'This idea was not sent to District Commissioner'
      });
    }
    
    if (idea.district !== userDistrict) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete ideas from your district'
      });
    }
    
    await idea.destroy();
    
    console.log(`🗑️ Idea ${id} deleted by District Commissioner ${user.full_name}`);
    
    res.json({
      success: true,
      message: 'Idea deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting idea:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete idea',
      error: error.message
    });
  }
};

// ✅ FORWARD IDEA (District Commissioner)
exports.forwardIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const user = req.user;
    
    console.log(`📤 Forwarding idea ${id} to National Commissioner by ${user.id}`);
    
    const member = await Member.findOne({
      where: { user_id: user.id },
      attributes: ['district']
    });
    
    const userDistrict = member?.district || user.district_id;
    
    const idea = await Idea.findByPk(id);
    
    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }
    
    if (idea.recipient !== 'district-commissioner') {
      return res.status(403).json({
        success: false,
        message: 'This idea was not sent to District Commissioner'
      });
    }
    
    if (idea.district !== userDistrict) {
      return res.status(403).json({
        success: false,
        message: 'You can only forward ideas from your district'
      });
    }
    
    await idea.update({
      status: 'forwarded',
      feedback: remarks || idea.feedback
    });
    
    console.log(`✅ Idea ${id} forwarded to National Commissioner by ${user.full_name}`);
    
    res.json({
      success: true,
      message: 'Idea forwarded to National Commissioner successfully',
      idea: idea
    });
    
  } catch (error) {
    console.error('❌ Error forwarding idea:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to forward idea',
      error: error.message
    });
  }
};

// ============================================
// PUBLIC ATTENDANCE FUNCTIONS
// ============================================
exports.getAttendanceViaLink = async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`🔍 getAttendanceViaLink called with token: ${token}`);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const event = await Event.findOne({
      where: { attendance_token: token },
      attributes: [
        'id', 'title', 'description', 'start_date', 'end_date',
        'location', 'venue', 'attendance_token', 'attendance_link',
        'attendance_link_expires', 'attendance_link_generated',
        'status'
      ]
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Invalid attendance link'
      });
    }

    const isExpired = event.attendance_link_expires && 
      new Date(event.attendance_link_expires) < new Date();

    if (isExpired) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: 'This attendance link has expired.'
      });
    }

    res.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location || event.venue,
        status: event.status,
        expires_at: event.attendance_link_expires,
        is_expired: false,
        is_active: true
      }
    });
  } catch (error) {
    console.error('❌ getAttendanceViaLink error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify attendance link',
      error: error.message
    });
  }
};

exports.markAttendanceViaLink = async (req, res) => {
  try {
    const { token } = req.params;
    const { email, sin, name } = req.body;

    console.log(`📝 markAttendanceViaLink called with token: ${token}`);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    if (!email && !sin) {
      return res.status(400).json({
        success: false,
        message: 'Either email or SIN is required'
      });
    }

    const event = await Event.findOne({
      where: { attendance_token: token }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Invalid attendance link'
      });
    }

    if (event.attendance_link_expires && new Date(event.attendance_link_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: 'This attendance link has expired.'
      });
    }

    let member = null;
    let user = null;

    if (email) {
      user = await User.findOne({ where: { email: email.toLowerCase() } });
      if (user) {
        member = await Member.findOne({ where: { user_id: user.id } });
      }
    }

    if (!member && sin) {
      member = await Member.findOne({ where: { sin: sin.toUpperCase() } });
      if (member) {
        user = await User.findByPk(member.user_id);
      }
    }

    let registration = null;

    if (member) {
      registration = await EventRegistration.findOne({
        where: { event_id: event.id, member_id: member.id }
      });
    }

    if (!registration) {
      registration = await EventRegistration.create({
        event_id: event.id,
        member_id: member?.id || null,
        status: 'approved',
        attendance_status: 'present',
        attended_at: new Date(),
        guest_name: name || (member ? `${member.first_name} ${member.last_name}` : 'Guest'),
        guest_email: email || null,
        marked_attendance_via_link: true
      });
    } else {
      await registration.update({
        attendance_status: 'present',
        attended_at: new Date(),
        marked_attendance_via_link: true
      });
    }

    res.json({
      success: true,
      message: '✅ Attendance marked successfully!',
      member: {
        id: member?.id || null,
        fullName: member ? `${member.first_name} ${member.last_name}` : registration.guest_name,
        email: user?.email || email || null,
        sin: member?.sin || null
      },
      event: {
        id: event.id,
        title: event.title,
        start_date: event.start_date
      },
      registration: {
        id: registration.id,
        status: registration.status,
        attendance_status: registration.attendance_status,
        attended_at: registration.attended_at
      }
    });
  } catch (error) {
    console.error('❌ markAttendanceViaLink error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
      error: error.message
    });
  }
};

exports.publicVerifyAttendance = async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`🔍 publicVerifyAttendance called with token: ${token}`);

    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Token is required'
      });
    }

    const event = await Event.findOne({
      where: { attendance_token: token },
      attributes: [
        'id', 'title', 'description', 'start_date', 'end_date',
        'location', 'venue', 'attendance_link_expires', 'status'
      ]
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Invalid attendance link'
      });
    }

    const isExpired = event.attendance_link_expires && 
      new Date(event.attendance_link_expires) < new Date();

    res.json({
      success: true,
      valid: true,
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location || event.venue,
        status: event.status,
        is_expired: isExpired,
        is_active: !isExpired && (event.status === 'ongoing' || event.status === 'upcoming'),
        expires_at: event.attendance_link_expires
      },
      message: isExpired ? 'This attendance link has expired.' : 'Valid attendance link.'
    });
  } catch (error) {
    console.error('❌ publicVerifyAttendance error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Failed to verify attendance link',
      error: error.message
    });
  }
};

exports.publicCheckInAttendance = async (req, res) => {
  try {
    const { token } = req.params;
    const { email, sin, name } = req.body;

    console.log(`📝 publicCheckInAttendance called with token: ${token}`);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    if (!email && !sin) {
      return res.status(400).json({
        success: false,
        message: 'Either email or SIN is required'
      });
    }

    const event = await Event.findOne({
      where: { attendance_token: token }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Invalid attendance link'
      });
    }

    if (event.attendance_link_expires && new Date(event.attendance_link_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: 'This attendance link has expired.'
      });
    }

    let member = null;
    let user = null;

    if (email) {
      user = await User.findOne({ where: { email: email.toLowerCase() } });
      if (user) {
        member = await Member.findOne({ where: { user_id: user.id } });
      }
    }

    if (!member && sin) {
      member = await Member.findOne({ where: { sin: sin.toUpperCase() } });
      if (member) {
        user = await User.findByPk(member.user_id);
      }
    }

    let registration = null;

    if (member) {
      registration = await EventRegistration.findOne({
        where: { event_id: event.id, member_id: member.id }
      });
    }

    if (!registration) {
      registration = await EventRegistration.create({
        event_id: event.id,
        member_id: member?.id || null,
        status: 'approved',
        attendance_status: 'present',
        attended_at: new Date(),
        guest_name: name || (member ? `${member.first_name} ${member.last_name}` : 'Guest'),
        guest_email: email || null,
        marked_attendance_via_link: true
      });
    } else {
      await registration.update({
        attendance_status: 'present',
        attended_at: new Date(),
        marked_attendance_via_link: true
      });
    }

    res.json({
      success: true,
      message: '✅ Attendance marked successfully!',
      member: {
        id: member?.id || null,
        fullName: member ? `${member.first_name} ${member.last_name}` : registration.guest_name,
        email: user?.email || email || null,
        sin: member?.sin || null
      },
      event: {
        id: event.id,
        title: event.title,
        start_date: event.start_date
      },
      registration: {
        id: registration.id,
        status: registration.status,
        attendance_status: registration.attendance_status,
        attended_at: registration.attended_at
      }
    });
  } catch (error) {
    console.error('❌ publicCheckInAttendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in',
      error: error.message
    });
  }
};