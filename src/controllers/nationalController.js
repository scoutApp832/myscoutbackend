const { Member, User, Event, EventRegistration, Report, Idea, Project, Course, CourseEnrollment, Announcement, Notification, District,Unit, Donation } = require('../models');
const { generateSIN } = require('../services/sinGenerator');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { sendBulkEmails } = require('../services/emailService');

// ============================================
// DASHBOARD STATS
// ============================================

exports.getStats = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats...');

    const totalMembers = await Member.count() || 0;
    const activeMembers = await Member.count({ 
      where: { membership_status: 'active' } 
    }) || 0;
    
    const totalLeaders = await User.count({ 
      where: { 
        role: ['unit_leader', 'district_commissioner', 'national_commissioner', 'super_admin'] 
      } 
    }) || 0;
    
    const totalEvents = await Event.count() || 0;
    
    const now = new Date();
    const upcomingEvents = await Event.count({ 
      where: { 
        status: ['upcoming', 'published'],
        start_date: { [Op.gte]: now }
      } 
    }) || 0;
    
    const pendingRegistrations = await Member.count({ 
      where: { membership_status: 'pending' } 
    }) || 0;
    
    const pendingReports = await Report.count({ 
      where: { status: 'pending' } 
    }) || 0;
    
    const pendingProjects = await Project.count({ 
      where: { status: 'pending' } 
    }) || 0;
    
    const totalDonations = await Donation.sum('amount', { 
      where: { status: 'completed' } 
    }) || 0;

    res.json({
      totalMembers: Number(totalMembers) || 0,
      activeMembers: Number(activeMembers) || 0,
      totalLeaders: Number(totalLeaders) || 0,
      totalEvents: Number(totalEvents) || 0,
      upcomingEvents: Number(upcomingEvents) || 0,
      pendingRegistrations: Number(pendingRegistrations) || 0,
      pendingReports: Number(pendingReports) || 0,
      pendingProjects: Number(pendingProjects) || 0,
      totalDonations: Number(totalDonations) || 0
    });

  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.json({
      totalMembers: 0,
      activeMembers: 0,
      totalLeaders: 0,
      totalEvents: 0,
      upcomingEvents: 0,
      pendingRegistrations: 0,
      pendingReports: 0,
      pendingProjects: 0,
      totalDonations: 0
    });
  }
};
// backend/src/controllers/nationalController.js

exports.forwardToDonors = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📤 Forwarding report ${id} to donors by ${userId} (${userRole})`);

    const report = await Report.findByPk(id, {
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
        }
      ]
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // ✅ Only approved reports can be forwarded
    if (report.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Only approved reports can be forwarded to donors. Current status: ${report.status}`
      });
    }

    // ✅ Check if already forwarded to donors using existing column
    if (report.published_to_donors === true) {
      return res.status(400).json({
        success: false,
        message: 'This report has already been forwarded to donors'
      });
    }

    // ✅ Update report using existing columns
    await report.update({
      status: 'forwarded',
      published_to_donors: true,  // ✅ Using existing column
      forwarded_to_national: true, // ✅ Mark as forwarded to national
      forwarded_to_national_at: new Date(),
      forwarded_to_national_by: userId
    });

    console.log(`✅ Report ${id} forwarded to donors successfully`);
    console.log(`📊 Status: ${report.status}, published_to_donors: true`);

    // Get all active donors
    const donors = await User.findAll({
      where: {
        role: 'donor',
        status: 'active'
      },
      attributes: ['id', 'full_name', 'email', 'phone']
    });

    console.log(`📧 Found ${donors.length} active donors to notify`);

    // Create notifications for each donor
    const notificationPromises = donors.map(async (donor) => {
      try {
        return await Notification.create({
          user_id: donor.id,
          type: 'report_forwarded',
          title: `📄 New Report: ${report.title}`,
          message: `A new report "${report.title}" has been forwarded to you by ${req.user.full_name}.\n\n${message || 'Please review this report for your reference.'}\n\n📅 Date: ${new Date(report.created_at).toLocaleDateString()}\n📍 District: ${report.district || 'National'}`,
          link: `/national-reports/${report.id}`,
          icon: '📄',
          color: '#6A1B9A',
          is_read: false,
          metadata: {
            report_id: report.id,
            report_title: report.title,
            forwarded_by: req.user.full_name,
            forwarded_at: new Date()
          }
        });
      } catch (err) {
        console.error(`❌ Failed to notify donor ${donor.id}:`, err.message);
        return null;
      }
    });

    const notificationResults = await Promise.all(notificationPromises);
    const sentCount = notificationResults.filter(r => r !== null).length;

    // Fetch updated report
    const updatedReport = await Report.findByPk(id, {
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
        }
      ]
    });

    res.json({
      success: true,
      message: `Report forwarded to ${sentCount} donors successfully!`,
      report: updatedReport,
      donors_notified: sentCount,
      total_donors: donors.length
    });

  } catch (error) {
    console.error('❌ Error forwarding report to donors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to forward report to donors',
      error: error.message
    });
  }
};
// ============================================
// RECENT ACTIVITIES
// ============================================

exports.getRecentActivities = async (req, res) => {
  try {
    const activities = [];

    const newMembers = await Member.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['full_name'] }]
    });

    newMembers.forEach(m => {
      activities.push({
        id: `member-${m.id}`,
        title: `${m.user?.full_name || 'New member'} registered as a scout`,
        status: m.membership_status || 'pending',
        date: m.created_at,
        type: 'member'
      });
    });

    const reports = await Report.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [
        { model: Member, as: 'submitter', attributes: ['first_name', 'last_name'] }
      ]
    });

    reports.forEach(r => {
      const name = r.submitter ? `${r.submitter.first_name} ${r.submitter.last_name}` : 'Someone';
      activities.push({
        id: `report-${r.id}`,
        title: `${name} submitted a report: ${r.title}`,
        status: r.status || 'pending',
        date: r.created_at,
        type: 'report'
      });
    });

    const registrations = await EventRegistration.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['full_name'] },
        { model: Event, as: 'event', attributes: ['title'] }
      ]
    });

    registrations.forEach(r => {
      activities.push({
        id: `reg-${r.id}`,
        title: `${r.user?.full_name || 'Someone'} registered for ${r.event?.title || 'an event'}`,
        status: r.status || 'pending',
        date: r.created_at,
        type: 'registration'
      });
    });

    const projects = await Project.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [
        { model: Member, as: 'submitter', attributes: ['first_name', 'last_name'] }
      ]
    });

    projects.forEach(p => {
      const name = p.submitter ? `${p.submitter.first_name} ${p.submitter.last_name}` : 'Someone';
      activities.push({
        id: `project-${p.id}`,
        title: `${name} submitted a project: ${p.title}`,
        status: p.status || 'pending',
        date: p.created_at,
        type: 'project'
      });
    });

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limited = activities.slice(0, 10);

    res.json(limited.map(a => ({
      ...a,
      date: new Date(a.date).toLocaleDateString()
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
    const events = await Event.findAll({
      where: {
        start_date: { [Op.gte]: new Date() },
        status: ['upcoming', 'published']
      },
      limit: 10,
      order: [['start_date', 'ASC']],
      include: [{ model: User, as: 'creator', attributes: ['full_name'] }]
    });

    res.json(events.map(e => ({
      id: e.id,
      title: e.title,
      start_date: e.start_date,
      end_date: e.end_date,
      location: e.location || 'TBD',
      venue: e.venue || e.location || 'TBD',
      status: e.status,
      creator: e.creator?.full_name || 'Admin'
    })));
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get events', 
      error: error.message 
    });
  }
};

// ============================================
// MEMBERSHIP BY DISTRICT
// ============================================

exports.getMembershipByDistrict = async (req, res) => {
  try {
    const members = await Member.findAll();
    const districtCount = {};
    members.forEach(m => {
      const d = m.district || 'Unknown';
      districtCount[d] = (districtCount[d] || 0) + 1;
    });

    const result = Object.keys(districtCount).map(name => ({
      name,
      members: districtCount[name]
    }));

    res.json(result);
  } catch (error) {
    console.error('Get membership by district error:', error);
    res.status(500).json({ success: false, message: 'Failed to get data', error: error.message });
  }
};

// ============================================
// GENDER DATA
// ============================================

exports.getGenderData = async (req, res) => {
  try {
    const males = await Member.count({ where: { gender: 'male' } });
    const females = await Member.count({ where: { gender: 'female' } });
    const others = await Member.count({ 
      where: { 
        [Op.or]: [
          { gender: { [Op.notIn]: ['male', 'female'] } },
          { gender: null }
        ]
      } 
    });

    const result = [];
    if (males > 0 || males === 0) result.push({ name: 'Male', value: males });
    if (females > 0 || females === 0) result.push({ name: 'Female', value: females });
    if (others > 0 || others === 0) result.push({ name: 'Other', value: others });

    res.json(result);
  } catch (error) {
    console.error('Get gender data error:', error);
    res.status(500).json({ success: false, message: 'Failed to get gender data', error: error.message });
  }
};

// ============================================
// AGE GROUPS
// ============================================

exports.getAgeGroups = async (req, res) => {
  try {
    const members = await Member.findAll();
    const groups = {
      '6-12': 0,
      '13-18': 0,
      '19-25': 0,
      '25+': 0
    };

    const now = new Date();
    members.forEach(m => {
      if (m.date_of_birth) {
        const age = now.getFullYear() - new Date(m.date_of_birth).getFullYear();
        if (age >= 6 && age <= 12) groups['6-12']++;
        else if (age >= 13 && age <= 18) groups['13-18']++;
        else if (age >= 19 && age <= 25) groups['19-25']++;
        else if (age > 25) groups['25+']++;
      }
    });

    res.json(Object.keys(groups).map(key => ({
      group: key,
      count: groups[key]
    })));
  } catch (error) {
    console.error('Get age groups error:', error);
    res.status(500).json({ success: false, message: 'Failed to get age groups', error: error.message });
  }
};

// ============================================
// NOTIFICATIONS
// ============================================

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.findAll({
      where: {
        [Op.or]: [
          { user_id: userId },
          { type: 'national' },
          { audience: 'national' }
        ]
      },
      limit: 10,
      order: [['created_at', 'DESC']]
    });

    const unreadCount = await Notification.count({
      where: {
        [Op.or]: [
          { user_id: userId },
          { type: 'national' },
          { audience: 'national' }
        ],
        read: false
      }
    });

    const formatted = notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type || 'info',
      icon: n.type === 'urgent' ? 'fa-exclamation-triangle' : 'fa-bell',
      read: n.read || false,
      time: new Date(n.created_at).toLocaleDateString(),
      created_at: n.created_at
    }));

    res.json({ 
      success: true,
      notifications: formatted,
      unreadCount: unreadCount || 0
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get notifications', 
      error: error.message,
      notifications: [],
      unreadCount: 0
    });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByPk(id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.update({ read: true, read_at: new Date() });
    res.json({ 
      success: true, 
      message: 'Notification marked as read' 
    });
  } catch (error) {
    console.error('Mark notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification',
      error: error.message
    });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.update(
      { read: true, read_at: new Date() },
      { 
        where: {
          [Op.or]: [
            { user_id: userId },
            { type: 'national' },
            { audience: 'national' }
          ],
          read: false
        }
      }
    );
    res.json({ 
      success: true, 
      message: 'All notifications marked as read' 
    });
  } catch (error) {
    console.error('Mark all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications',
      error: error.message
    });
  }
};

// ============================================
// DISTRICTS
// ============================================

exports.getDistricts = async (req, res) => {
  try {
    const districts = await District.findAll({
      order: [['name', 'ASC']]
    });
    res.json({ success: true, districts });
  } catch (error) {
    console.error('Get districts error:', error);
    res.status(500).json({ success: false, message: 'Failed to get districts', error: error.message });
  }
};

// ============================================
// GET MEMBERS - COMPLETE WITH ALL FIELDS
// ============================================

exports.getMembers = async (req, res) => {
  try {
    const { search, district, status } = req.query;
    const where = {};

    if (district && district !== 'all') where.district = district;
    if (status && status !== 'all') where.membership_status = status;

    const members = await Member.findAll({
      where,
      attributes: [
        'id',
        'user_id',
        'sin',
        'first_name',
        'last_name',
        'middle_name',
        'troop_name',
        'province',
        'district',
        'sector',
        'cell',
        'village',
        'gender',
        'date_of_birth',
        'membership_status',
        'membership_type',
        'joined_date',
        'expiry_date',
        'profile_image',
        'bio',
        'skills',
        'interests',
        'fee_status',
        'payment_status',
        'payment_approved',
        'payment_approved_at',
        'payment_approved_by',
        'payment_amount',
        'payment_date',
        'payment_method',
        'payment_reference',
        'fee_paid_date',
        'fee_expiry_date',
        'scout_id_generated',
        'scout_id_generated_date',
        'scout_id_generated_by',
        'created_at',
        'updated_at'
      ],
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'email', 'full_name', 'phone', 'status', 'role'] 
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedMembers = members.map(member => {
      const memberData = member.toJSON ? member.toJSON() : member;
      const userData = memberData.user || {};
      
      return {
        id: memberData.id,
        user_id: memberData.user_id,
        sin: memberData.sin || null,
        firstName: memberData.first_name || '',
        lastName: memberData.last_name || '',
        middleName: memberData.middle_name || '',
        fullName: userData.full_name || `${memberData.first_name || ''} ${memberData.last_name || ''}`.trim() || 'N/A',
        troopName: memberData.troop_name || null,
        email: userData.email || 'N/A',
        phone: userData.phone || 'N/A',
        province: memberData.province || 'N/A',
        district: memberData.district || 'N/A',
        sector: memberData.sector || 'N/A',
        cell: memberData.cell || 'N/A',
        village: memberData.village || 'N/A',
        gender: memberData.gender || 'N/A',
        birthDate: memberData.date_of_birth || 'N/A',
        date_of_birth: memberData.date_of_birth || null,
        status: memberData.membership_status || 'pending',
        membershipStatus: memberData.membership_status || 'pending',
        membership_type: memberData.membership_type || 'regular',
        joined_date: memberData.joined_date || null,
        expiry_date: memberData.expiry_date || null,
        profile_image: memberData.profile_image || null,
        bio: memberData.bio || '',
        skills: memberData.skills || [],
        interests: memberData.interests || [],
        
        fee_status: memberData.fee_status || 'unpaid',
        paymentStatus: memberData.payment_status || memberData.fee_status || 'unpaid',
        payment_status: memberData.payment_status || memberData.fee_status || 'unpaid',
        payment_approved: memberData.payment_approved || false,
        payment_approved_at: memberData.payment_approved_at || null,
        payment_approved_by: memberData.payment_approved_by || null,
        payment_amount: memberData.payment_amount || null,
        payment_date: memberData.payment_date || null,
        payment_method: memberData.payment_method || null,
        payment_reference: memberData.payment_reference || null,
        fee_paid_date: memberData.fee_paid_date || null,
        fee_expiry_date: memberData.fee_expiry_date || null,
        
        scout_id_generated: memberData.scout_id_generated || false,
        scout_id_generated_date: memberData.scout_id_generated_date || null,
        scout_id_generated_by: memberData.scout_id_generated_by || null,
        
        user: {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          phone: userData.phone,
          status: userData.status,
          role: userData.role
        },
        
        createdAt: memberData.created_at,
        updatedAt: memberData.updated_at,
        created_at: memberData.created_at,
        updated_at: memberData.updated_at
      };
    });

    let filteredMembers = formattedMembers;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMembers = formattedMembers.filter(m => 
        (m.sin?.toLowerCase() || '').includes(searchLower) ||
        (m.fullName?.toLowerCase() || '').includes(searchLower) ||
        (m.firstName?.toLowerCase() || '').includes(searchLower) ||
        (m.lastName?.toLowerCase() || '').includes(searchLower) ||
        (m.troopName?.toLowerCase() || '').includes(searchLower) ||
        (m.email?.toLowerCase() || '').includes(searchLower) ||
        (m.phone?.toLowerCase() || '').includes(searchLower) ||
        (m.district?.toLowerCase() || '').includes(searchLower)
      );
    }

    console.log(`✅ Found ${members.length} members, returning ${filteredMembers.length} after search`);

    res.json({ 
      success: true, 
      members: filteredMembers,
      total: members.length,
      filtered: filteredMembers.length
    });

  } catch (error) {
    console.error('❌ Get members error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get members', 
      error: error.message 
    });
  }
};

// ============================================
// CREATE MEMBER
// ============================================

exports.createMember = async (req, res) => {
  try {
    const { email, password, fullName, phone, role, ...memberData } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const user = await User.create({
      email,
      password_hash: password,
      full_name: fullName,
      phone,
      role: role || 'scout',
      status: 'active'
    });

    const sin = await generateSIN(user.id);

    const member = await Member.create({
      user_id: user.id,
      sin,
      first_name: fullName.split(' ')[0],
      last_name: fullName.split(' ').slice(1).join(' ') || fullName,
      ...memberData,
      membership_status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      member
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ success: false, message: 'Failed to create member', error: error.message });
  }
};

// ============================================
// GET MEMBER BY ID
// ============================================

exports.getMemberById = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json({ success: true, member });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ success: false, message: 'Failed to get member', error: error.message });
  }
};

// ============================================
// UPDATE MEMBER
// ============================================

exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, fullName, phone, ...memberData } = req.body;

    const member = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (email || fullName || phone) {
      await member.user.update({
        email: email || member.user.email,
        full_name: fullName || member.user.full_name,
        phone: phone || member.user.phone
      });
    }

    await member.update(memberData);
    res.json({ success: true, message: 'Member updated successfully', member });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ success: false, message: 'Failed to update member', error: error.message });
  }
};

// ============================================
// DELETE MEMBER
// ============================================

exports.deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findByPk(id);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    await User.destroy({ where: { id: member.user_id } });
    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete member', error: error.message });
  }
};

// ============================================
// TOGGLE MEMBER STATUS
// ============================================

exports.toggleMemberStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status is required' 
      });
    }

    const member = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }

    await member.update({ membership_status: status });

    if (member.user) {
      await member.user.update({ status: status });
    }

    res.json({
      success: true,
      message: `Member ${status === 'active' ? 'activated' : status === 'inactive' ? 'deactivated' : 'suspended'} successfully`
    });

  } catch (error) {
    console.error('Toggle member status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update status', 
      error: error.message 
    });
  }
};

// ============================================
// APPROVE FEE
// ============================================

exports.approveFee = async (req, res) => {
  try {
    const { id } = req.params;
    
    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }

    console.log(`💰 Approving fee for member ${id}`);

    const feeExpiryDate = new Date();
    feeExpiryDate.setFullYear(feeExpiryDate.getFullYear() + 1);

    await member.update({
      fee_status: 'paid',
      fee_paid_date: new Date(),
      fee_expiry_date: feeExpiryDate,
      membership_status: 'active'
    });

    if (!member.sin) {
      const sin = await generateSIN(id);
      await member.update({ 
        sin, 
        scout_id_generated: true 
      });
    }

    res.json({ 
      success: true, 
      message: 'Membership fee approved successfully!',
      member
    });

  } catch (error) {
    console.error('❌ Approve fee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to approve fee', 
      error: error.message 
    });
  }
};

// ============================================
// GENERATE SIN
// ============================================

exports.generateSIN = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findByPk(id);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (member.sin) {
      return res.status(400).json({ success: false, message: 'SIN already generated' });
    }

    if (member.fee_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Membership fee must be paid first' });
    }

    const sin = await generateSIN(id);
    await member.update({ sin, scout_id_generated: true });

    res.json({ success: true, message: 'SIN generated successfully', sin });
  } catch (error) {
    console.error('Generate SIN error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate SIN', error: error.message });
  }
};

// ============================================
// APPROVE PAYMENT
// ============================================

exports.approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`💰 Approving payment for member ${id}`);
    
    const member = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });
    
    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }
    
    console.log(`📊 Current fee_status: ${member.fee_status}`);
    console.log(`📊 Current sin: ${member.sin}`);
    console.log(`📊 Current scout_id_generated: ${member.scout_id_generated}`);
    
    const updates = {
      fee_status: 'paid',
      payment_status: 'paid',
      payment_approved: true,
      payment_approved_at: new Date(),
      payment_approved_by: req.user?.id || null,
      membership_status: 'active',
      scout_id_generated: true
    };
    
    if (!member.sin) {
      const newSin = await generateSIN(member.user_id);
      updates.sin = newSin;
      console.log(`🆕 Generated new SIN: ${newSin}`);
    }
    
    await member.update(updates);
    await member.reload();
    
    console.log(`✅ Payment approved for member ${id}`);
    console.log(`📊 New fee_status: ${member.fee_status}`);
    console.log(`📊 New sin: ${member.sin}`);
    console.log(`📊 New scout_id_generated: ${member.scout_id_generated}`);
    
    const updatedMember = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });
    
    return res.status(200).json({
      success: true,
      message: 'Payment approved successfully! Scout ID Card is now available.',
      member: updatedMember,
      sinGenerated: !!member.sin
    });
    
  } catch (error) {
    console.error('❌ Payment approval error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to approve payment: ' + error.message 
    });
  }
};

// ============================================
// LEADERS
// ============================================

exports.getLeaders = async (req, res) => {
  try {
    const leaders = await User.findAll({
      where: { 
        role: ['national_commissioner', 'district_commissioner']
      },
      include: [{ model: Member, as: 'member' }],
      order: [['created_at', 'DESC']]
    });

    const formattedLeaders = leaders.map(leader => ({
      id: leader.id,
      sin: leader.member?.sin || null,
      fullName: leader.full_name,
      email: leader.email,
      phone: leader.phone,
      district: leader.member?.district || 'N/A',
      role: leader.role,
      status: leader.status,
      permissions: leader.permissions || {}
    }));

    res.json({ success: true, leaders: formattedLeaders });
  } catch (error) {
    console.error('Get leaders error:', error);
    res.status(500).json({ success: false, message: 'Failed to get leaders', error: error.message });
  }
};

exports.createLeader = async (req, res) => {
  try {
    const { email, password, fullName, phone, district, permissions } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const user = await User.create({
      email,
      password_hash: password,
      full_name: fullName,
      phone,
      role: 'national_commissioner',
      status: 'active',
      permissions: permissions || {}
    });

    const sin = await generateSIN(user.id);

    const member = await Member.create({
      user_id: user.id,
      sin,
      first_name: fullName.split(' ')[0],
      last_name: fullName.split(' ').slice(1).join(' ') || fullName,
      district: district || 'N/A',
      membership_status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'National Commissioner added successfully',
      user,
      member
    });
  } catch (error) {
    console.error('Create leader error:', error);
    res.status(500).json({ success: false, message: 'Failed to add National Commissioner', error: error.message });
  }
};

exports.updateLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, district } = req.body;

    const user = await User.findByPk(id, {
      include: [{ model: Member, as: 'member' }]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Leader not found' });
    }

    await user.update({ 
      full_name: fullName, 
      phone,
      role: 'national_commissioner'
    });

    if (user.member && district) {
      await user.member.update({ district });
    }

    res.json({ 
      success: true, 
      message: 'National Commissioner updated successfully',
      user
    });
  } catch (error) {
    console.error('Update leader error:', error);
    res.status(500).json({ success: false, message: 'Failed to update leader', error: error.message });
  }
};

exports.deleteLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Leader not found' });
    }

    if (user.email === 'national@msr.rw') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete the primary National Commissioner account' 
      });
    }

    await User.destroy({ where: { id } });
    res.json({ success: true, message: 'National Commissioner removed successfully' });
  } catch (error) {
    console.error('Delete leader error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove leader', error: error.message });
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
      return res.status(404).json({ success: false, message: 'Leader not found' });
    }

    await user.update({ status });
    if (user.member) {
      await user.member.update({ membership_status: status });
    }

    res.json({
      success: true,
      message: `National Commissioner ${status === 'active' ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Toggle leader status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
  }
};

exports.updatePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (parseInt(id) === parseInt(userId)) {
      console.log(`❌ User ${userId} attempted to update their own permissions`);
      return res.status(403).json({
        success: false,
        message: 'You cannot modify your own permissions. Please contact another Super Admin.'
      });
    }

    const isSuperAdmin = userRole === 'super_admin' || 
                         userRole === 'super-admin' || 
                         userRole === 'admin';

    if (!isSuperAdmin) {
      console.log(`❌ User ${userId} with role ${userRole} denied permission update`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Super Admin can manage permissions.'
      });
    }

    if (user.role === 'super_admin' || user.role === 'super-admin' || user.role === 'admin') {
      const isRemovingSuperAdmin = permissions?.isSuperAdmin === false || 
                                   permissions?.canManageSuperAdmins === false;
      
      if (isRemovingSuperAdmin) {
        const superAdminCount = await User.count({
          where: {
            role: ['super_admin', 'super-admin', 'admin'],
            id: { [Op.ne]: parseInt(id) }
          }
        });

        if (superAdminCount === 0) {
          console.log(`❌ Cannot remove Super Admin status from the last Super Admin (${id})`);
          return res.status(400).json({
            success: false,
            message: 'Cannot remove Super Admin status from the last Super Admin. Please create another Super Admin first.'
          });
        }
      }
    }

    const updateData = {
      permissions: permissions || {}
    };

    if (permissions?.isSuperAdmin === true || permissions?.canManageSuperAdmins === true) {
      updateData.role = 'super_admin';
    } else if (user.role === 'super_admin' || user.role === 'super-admin' || user.role === 'admin') {
      if (permissions?.isSuperAdmin === false && permissions?.canManageSuperAdmins === false) {
        updateData.role = 'national_commissioner';
      }
    }

    await user.update(updateData);

    console.log(`✅ Permissions updated for user ${id} by ${userId}`);

    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expiry'] },
      include: [
        { 
          model: Member, 
          as: 'member',
          attributes: ['id', 'sin', 'first_name', 'last_name', 'district', 'province', 'sector', 'cell', 'village', 'gender', 'date_of_birth', 'membership_status', 'membership_type', 'joined_date', 'expiry_date', 'profile_image', 'bio', 'skills', 'interests']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Permissions updated successfully',
      permissions: updatedUser.permissions,
      user: {
        id: updatedUser.id,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status
      }
    });

  } catch (error) {
    console.error('❌ Update permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update permissions',
      error: error.message
    });
  }
};

// ============================================
// EVENTS
// ============================================

exports.getEvents = async (req, res) => {
  try {
    const { category, status, search, limit = 50, offset = 0 } = req.query;
    const where = {};

    if (category && category !== 'all') where.category = category;
    if (status && status !== 'all') where.status = status;

    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: events } = await Event.findAndCountAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] }],
      order: [['start_date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const registrationCount = await EventRegistration.count({
        where: { event_id: event.id, status: 'approved' }
      });
      return {
        ...event.toJSON(),
        registrationCount
      };
    }));

    res.json({
      success: true,
      events: eventsWithCounts,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get events',
      error: error.message,
      events: []
    });
  }
};

// ============================================
// EVENT BY ID
// ============================================

exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id, {
      include: [
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'full_name', 'email'] 
        },
        {
          model: EventRegistration,
          as: 'registrations',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'full_name', 'email', 'phone'],
              include: [
                {
                  model: Member,
                  as: 'member',
                  attributes: ['id', 'sin', 'first_name', 'last_name', 'district', 'membership_status']
                }
              ]
            }
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

    const approvedCount = await EventRegistration.count({
      where: { event_id: id, status: 'approved' }
    });
    
    const pendingCount = await EventRegistration.count({
      where: { event_id: id, status: 'pending' }
    });
    
    const cancelledCount = await EventRegistration.count({
      where: { event_id: id, status: 'cancelled' }
    });

    res.json({
      success: true,
      event: {
        ...event.toJSON(),
        stats: {
          approved: approvedCount,
          pending: pendingCount,
          cancelled: cancelledCount,
          total: approvedCount + pendingCount + cancelledCount
        }
      }
    });
  } catch (error) {
    console.error('Get event by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get event',
      error: error.message
    });
  }
};
// ============================================
// CREATE EVENT - NATIONAL
// ============================================

exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      start_date,
      end_date,
      location,
      capacity,
      price,
      registration_deadline,
      status = 'draft',
      event_type,
      category,
      venue,
      audiences = [],
      resources = [],
      scope,        // ✅ ADD THIS
      is_national   // ✅ ADD THIS
    } = req.body;

    if (!title || !start_date || !location) {
      return res.status(400).json({
        success: false,
        message: 'Title, start date and location are required'
      });
    }

    if (new Date(start_date) >= new Date(end_date || start_date)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const event = await Event.create({
      title,
      description: description || '',
      start_date,
      end_date: end_date || start_date,
      location,
      venue: venue || location,
      capacity: capacity || null,
      price: parseFloat(price) || 0,
      registration_deadline: registration_deadline || null,
      status,
      event_type: event_type || 'general',
      category: category || 'general',
      created_by: req.user.id,
      // ✅ THESE ARE THE IMPORTANT FIELDS
      scope: scope || 'national',        // Default to 'national'
      is_national: is_national !== undefined ? is_national : true  // Default to true
    });

    console.log(`✅ National event created: "${title}" by ${req.user.full_name}`);
    console.log(`📊 Scope: ${event.scope}, is_national: ${event.is_national}`);

    res.status(201).json({
      success: true,
      message: 'National event created successfully',
      event
    });
  } catch (error) {
    console.error('❌ Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: error.message
    });
  }
};

// ============================================
// UPDATE EVENT
// ============================================

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      start_date,
      end_date,
      location,
      venue,
      capacity,
      price,
      registration_deadline,
      status,
      event_type,
      category,
      audiences,
      resources
    } = req.body;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (start_date) event.start_date = start_date;
    if (end_date) event.end_date = end_date;
    if (location) event.location = location;
    if (venue) event.venue = venue;
    if (capacity !== undefined) event.capacity = capacity;
    if (price !== undefined) event.price = parseFloat(price);
    if (registration_deadline !== undefined) event.registration_deadline = registration_deadline;
    if (status) event.status = status;
    if (event_type) event.event_type = event_type;
    if (category) event.category = category;

    await event.save();

    console.log(`Event updated: "${event.title}"`);

    res.json({
      success: true,
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: error.message
    });
  }
};

// ============================================
// DELETE EVENT
// ============================================

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const approvedCount = await EventRegistration.count({
      where: { event_id: id, status: 'approved' }
    });

    if (approvedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel event with ${approvedCount} approved registrations. Please contact attendees first.`
      });
    }

    await event.update({ status: 'cancelled' });

    console.log(`Event cancelled: "${event.title}"`);

    res.json({
      success: true,
      message: 'Event cancelled successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel event',
      error: error.message
    });
  }
};

// ============================================
// GET EVENT REGISTRATIONS
// ============================================

exports.getEventRegistrations = async (req, res) => {
  try {
    const { id } = req.params;
    const registrations = await EventRegistration.findAll({
      where: { event_id: id },
      include: [{ model: Member, as: 'member', include: [{ model: User, as: 'user' }] }]
    });

    res.json({ success: true, registrations });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get registrations', error: error.message });
  }
};

// ============================================
// REGISTRATIONS
// ============================================

exports.getAllRegistrations = async (req, res) => {
  try {
    const { type, status } = req.query;
    const where = {};

    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;

    const registrations = await EventRegistration.findAll({
      where,
      include: [
        { 
          model: Event, 
          as: 'event',
          attributes: ['id', 'title', 'start_date', 'end_date', 'location']
        },
        { 
          model: Member, 
          as: 'member',
          include: [
            { 
              model: User, 
              as: 'user',
              attributes: ['id', 'full_name', 'email', 'phone']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedRegistrations = registrations.map(reg => ({
      id: reg.id,
      eventName: reg.event?.title || 'N/A',
      type: reg.event?.event_type || reg.type || 'event',
      memberName: reg.member?.user?.full_name || reg.member?.first_name + ' ' + reg.member?.last_name || 'N/A',
      fullName: reg.member?.user?.full_name || reg.member?.first_name + ' ' + reg.member?.last_name || 'N/A',
      sin: reg.member?.sin || 'N/A',
      email: reg.member?.user?.email || 'N/A',
      phone: reg.member?.user?.phone || 'N/A',
      district: reg.member?.district || 'N/A',
      status: reg.status || 'pending',
      paymentStatus: reg.payment_status || 'unpaid',
      registrationDate: reg.created_at,
      createdAt: reg.created_at,
      notes: reg.notes || '',
      attendanceStatus: reg.attendance_status || 'pending',
      attendanceTime: reg.attendance_time || null
    }));

    res.json({ 
      success: true, 
      registrations: formattedRegistrations 
    });
  } catch (error) {
    console.error('Get all registrations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get registrations', 
      error: error.message,
      registrations: []
    });
  }
};

exports.getPendingRegistrations = async (req, res) => {
  try {
    const pending = await Member.findAll({
      where: { membership_status: 'pending' },
      include: [{ model: User, as: 'user' }],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, registrations: pending });
  } catch (error) {
    console.error('Get pending registrations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get pending registrations', error: error.message });
  }
};

exports.approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await EventRegistration.findByPk(id);

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    await registration.update({ status: 'approved' });
    res.json({ success: true, message: 'Registration approved successfully' });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve registration', error: error.message });
  }
};

exports.rejectRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await EventRegistration.findByPk(id);

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

exports.markAttended = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await EventRegistration.findByPk(id);

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    await registration.update({ 
      status: 'attended',
      attendance_status: 'present',
      attendance_time: new Date()
    });
    res.json({ success: true, message: 'Marked as attended' });
  } catch (error) {
    console.error('Mark attended error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as attended', error: error.message });
  }
};

exports.cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await EventRegistration.findByPk(id);

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

exports.issueCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await EventRegistration.findByPk(id);

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    await registration.update({ 
      certificate_issued: true,
      certificate_url: `/uploads/certificates/registration-${id}.pdf`
    });
    res.json({ success: true, message: 'Certificate issued successfully' });
  } catch (error) {
    console.error('Issue certificate error:', error);
    res.status(500).json({ success: false, message: 'Failed to issue certificate', error: error.message });
  }
};

// ============================================
// DONATION MANAGEMENT
// ============================================

exports.getDonations = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;

    const donations = await Donation.findAll({
      where,
      include: [
        { model: Project, as: 'project', attributes: ['id', 'title'] },
        { model: User, as: 'donor', attributes: ['id', 'full_name', 'email', 'phone'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const formatted = donations.map(d => ({
      id: d.id,
      donorName: d.donor?.full_name || d.donor_name || 'Anonymous',
      donorEmail: d.donor?.email || d.donor_email || null,
      donorPhone: d.donor?.phone || d.donor_phone || null,
      projectName: d.project?.title || null,
      projectId: d.project_id,
      amount: d.amount,
      paymentMethod: d.payment_method,
      message: d.message,
      isAnonymous: d.is_anonymous,
      status: d.status,
      createdAt: d.created_at
    }));

    res.json({ success: true, donations: formatted });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({ success: false, message: error.message, donations: [] });
  }
};

exports.createDonation = async (req, res) => {
  try {
    const { projectId, amount, paymentMethod, donorName, donorEmail, donorPhone, message, isAnonymous, status } = req.body;

    if (!projectId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Project and valid amount are required' });
    }

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const donation = await Donation.create({
      project_id: projectId,
      amount: parseFloat(amount),
      payment_method: paymentMethod || 'mobile_money',
      donor_name: donorName || 'Anonymous',
      donor_email: donorEmail || null,
      donor_phone: donorPhone || null,
      message: message || '',
      is_anonymous: isAnonymous || false,
      status: status || 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Donation created successfully',
      donation
    });
  } catch (error) {
    console.error('Create donation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDonationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const donation = await Donation.findByPk(id);
    if (!donation) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }

    await donation.update({ status });
    res.json({ success: true, message: 'Donation status updated', donation });
  } catch (error) {
    console.error('Update donation status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const donation = await Donation.findByPk(id);
    if (!donation) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }
    await donation.destroy();
    res.json({ success: true, message: 'Donation deleted' });
  } catch (error) {
    console.error('Delete donation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// ATTENDANCE MANAGEMENT
// ============================================

exports.getAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    const registrations = await EventRegistration.findAll({
      where: { event_id: eventId },
      include: [
        { 
          model: Member, 
          as: 'member',
          include: [{ model: User, as: 'user' }]
        }
      ],
      order: [['attendance_time', 'DESC']]
    });

    const attendance = registrations.map(reg => ({
      id: reg.id,
      memberId: reg.member_id,
      memberName: reg.member?.user?.full_name || reg.member?.first_name + ' ' + reg.member?.last_name || 'N/A',
      sin: reg.member?.sin || 'N/A',
      email: reg.member?.user?.email || 'N/A',
      phone: reg.member?.user?.phone || 'N/A',
      district: reg.member?.district || 'N/A',
      status: reg.attendance_status || 'pending',
      attendanceTime: reg.attendance_time || null,
      checkedInBy: reg.checked_in_by || 'system',
      registrationStatus: reg.status
    }));

    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const pending = attendance.filter(a => a.status === 'pending').length;
    const excused = attendance.filter(a => a.status === 'excused').length;

    res.json({ 
      success: true, 
      attendance,
      stats: {
        total,
        present,
        absent,
        pending,
        excused,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message, 
      attendance: [],
      stats: { total: 0, present: 0, absent: 0, pending: 0, excused: 0, attendanceRate: 0 }
    });
  }
};

// ============================================
// MARK ATTENDANCE (Admin)
// ============================================

exports.markAttendance = async (req, res) => {
  try {
    const { eventId, memberId } = req.params;
    const { status = 'present' } = req.body;
    
    const registration = await EventRegistration.findOne({
      where: { event_id: eventId, member_id: memberId }
    });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    if (registration.attendance_status === 'present') {
      return res.status(400).json({ success: false, message: 'Attendance already marked' });
    }

    await registration.update({
      attendance_status: status,
      attendance_time: new Date(),
      checked_in_by: req.user?.id ? 'admin' : 'system'
    });

    res.json({ 
      success: true, 
      message: 'Attendance marked successfully',
      registration
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// VERIFY ATTENDANCE LINK (Public)
// ============================================

exports.verifyAttendanceLink = async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('🔍 Verifying attendance link for token:', token);

    let event = await Event.findOne({
      where: { 
        attendance_link: token
      },
      attributes: ['id', 'title', 'start_date', 'end_date', 'location', 'venue', 'status', 'attendance_link', 'attendance_link_expires']
    });

    if (!event && !isNaN(token)) {
      console.log('🔍 Trying to find by ID:', token);
      event = await Event.findByPk(parseInt(token), {
        attributes: ['id', 'title', 'start_date', 'end_date', 'location', 'venue', 'status', 'attendance_link', 'attendance_link_expires']
      });
    }

    if (!event) {
      console.log('❌ Event not found for token:', token);
      return res.status(404).json({
        success: false,
        message: 'Invalid attendance link. Event not found.',
        valid: false
      });
    }

    console.log('✅ Found event:', event.id, event.title);

    if (event.attendance_link_expires) {
      const now = new Date();
      const expires = new Date(event.attendance_link_expires);
      
      if (expires < now) {
        console.log('❌ Link expired at:', expires);
        return res.status(400).json({
          success: false,
          message: 'This attendance link has expired. Please contact the event organizer for a new link.',
          valid: false
        });
      }
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This event has been cancelled',
        valid: false
      });
    }

    console.log('✅ Attendance link verified successfully');

    res.json({
      success: true,
      valid: true,
      event: {
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location || event.venue || 'TBD',
        venue: event.venue || event.location || 'TBD',
        status: event.status
      }
    });

  } catch (error) {
    console.error('❌ Verify attendance link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify attendance link',
      error: error.message,
      valid: false
    });
  }
};

// ============================================
// CHECK-IN VIA ATTENDANCE LINK (Public)
// ============================================

exports.checkInByLink = async (req, res) => {
  try {
    const { token } = req.params;
    const { email, sin } = req.body;

    console.log('📝 Check-in request for token:', token);

    if (!email && !sin) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either your registered email address or Scout Identification Number (SIN).'
      });
    }

    let event = await Event.findOne({
      where: { 
        attendance_link: token
      }
    });

    if (!event && !isNaN(token)) {
      event = await Event.findByPk(parseInt(token));
    }

    if (!event) {
      console.log('❌ Event not found for token:', token);
      return res.status(404).json({
        success: false,
        message: 'Event not found. The attendance link may have expired or been cancelled.'
      });
    }

    if (event.attendance_link_expires) {
      const now = new Date();
      const expires = new Date(event.attendance_link_expires);
      
      if (expires < now) {
        console.log('❌ Link expired at:', expires);
        return res.status(400).json({
          success: false,
          message: 'This attendance link has expired. Please contact the event organizer for a new link.'
        });
      }
    }

    let member;
    if (email) {
      const user = await User.findOne({ where: { email: email.toLowerCase() } });
      if (user) {
        member = await Member.findOne({ where: { user_id: user.id } });
      }
    } else if (sin) {
      member = await Member.findOne({ where: { sin: sin.toUpperCase() } });
    }

    if (!member) {
      console.log('❌ Member not found');
      return res.status(404).json({
        success: false,
        message: 'Member not found. Please check your email or SIN and try again.'
      });
    }

    const registration = await EventRegistration.findOne({
      where: { 
        event_id: event.id, 
        member_id: member.id 
      }
    });

    if (!registration) {
      console.log('❌ Member not registered for this event');
      return res.status(404).json({
        success: false,
        message: 'You are not registered for this event. Please contact the event organizer.'
      });
    }

    if (registration.attendance_status === 'present' || registration.attendance_status === 'attended') {
      console.log('⚠️ Member already checked in');
      return res.status(400).json({
        success: false,
        message: 'You have already checked in for this event.'
      });
    }

    const now = new Date();
    if (event.start_date && new Date(event.start_date) > now) {
      const startTime = new Date(event.start_date).toLocaleString();
      return res.status(400).json({
        success: false,
        message: `Check-in will open at ${startTime}`
      });
    }

    await registration.update({
      attendance_status: 'present',
      attendance_time: now,
      checked_in_by: 'self'
    });

    console.log('✅ Check-in successful for member:', member.id, 'Event:', event.id);

    const user = await User.findByPk(member.user_id);
    const memberName = user?.full_name || `${member.first_name} ${member.last_name}`;

    res.json({
      success: true,
      message: `✅ Check-in successful! You are now marked as present for "${event.title}"`,
      member: {
        id: member.id,
        fullName: memberName,
        sin: member.sin,
        email: user?.email
      },
      event: {
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        location: event.location || event.venue
      }
    });

  } catch (error) {
    console.error('❌ Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in. Please try again or contact support.',
      error: error.message
    });
  }
};
// backend/src/controllers/nationalController.js

exports.getReports = async (req, res) => {
  try {
    const { district, status, limit = 100, offset = 0 } = req.query;
    const { Op } = require('sequelize');
    
    const userRole = req.user.role;
    const userId = req.user.id;

    console.log(`📊 Fetching reports for user: ${userId} (${userRole})`);
    console.log(`📊 Query params:`, { district, status, limit, offset });
    
    let where = {};

    // ✅ ROLE-BASED FILTERING
    if (userRole === 'donor') {
      // ✅ Donors can ONLY see forwarded reports (status = 'forwarded')
      // Or use published_to_donors = true
      where = {
        status: 'forwarded'
      };
      console.log('🔍 Donor - showing only forwarded reports');
    } else if (userRole === 'super_admin' || 
               userRole === 'super-admin' || 
               userRole === 'admin' || 
               userRole === 'national_commissioner' || 
               userRole === 'national-commissioner') {
      
      // ✅ Super Admin and National Commissioner see ALL reports
      where = {};
      console.log('🔍 Super Admin/National - showing ALL reports');
      
    } else {
      // District Commissioner or other roles
      where = {
        [Op.or]: [
          { forwarded_to_national: true },
          { created_by: userId }
        ]
      };
      console.log('🔍 Other role - showing own + forwarded reports');
    }

    // ✅ Apply filters ONLY if provided and NOT donor
    if (district && district !== 'all') {
      where.district = district;
    }

    if (status && status !== 'all' && userRole !== 'donor') {
      where.status = status;
    }

    console.log('🔍 Final Where clause:', JSON.stringify(where));

    const reports = await Report.findAndCountAll({
      where: where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: [
        'id', 'title', 'description', 'activity_type',
        'activity_date', 'location', 'participants_count',
        'achievements', 'challenges', 'recommendations',
        'status', 'feedback', 'file_urls', 'created_by', 
        'submitted_by', 'reviewed_by', 'reviewed_at', 
        'created_at', 'updated_at', 'district', 'unit_id', 
        'type', 'published_to_public', 'published_to_donors',
        'forwarded_to_national', 'forwarded_to_national_at',
        'forwarded_to_national_by'
      ],
      include: [
        {
          model: Member,
          as: 'submitter',
          attributes: ['id', 'first_name', 'last_name', 'district', 'troop_name']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email', 'role']
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
      ]
    });

    console.log(`✅ Found ${reports.count} reports for user role: ${userRole}`);

    res.json({
      success: true,
      total: reports.count,
      reports: reports.rows
    });

  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
};
exports.approveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await report.update({
      status: 'approved',
      feedback: remarks,
      reviewed_by: req.user.id,
      reviewed_date: new Date()
    });

    res.json({ success: true, message: 'Report approved', report });
  } catch (error) {
    console.error('Approve report error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve report', error: error.message });
  }
};

exports.rejectReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await report.update({
      status: 'rejected',
      feedback: remarks,
      reviewed_by: req.user.id,
      reviewed_date: new Date()
    });

    res.json({ success: true, message: 'Report rejected', report });
  } catch (error) {
    console.error('Reject report error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject report', error: error.message });
  }
};

exports.publishReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { destination } = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const updates = { status: 'published' };
    if (destination === 'public-website') updates.published_to_public = true;
    if (destination === 'donor-portal') updates.published_to_donors = true;

    await report.update(updates);
    res.json({ success: true, message: `Report published to ${destination}` });
  } catch (error) {
    console.error('Publish report error:', error);
    res.status(500).json({ success: false, message: 'Failed to publish report', error: error.message });
  }
};

exports.archiveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findByPk(id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await report.update({ status: 'archived' });
    res.json({ success: true, message: 'Report archived' });
  } catch (error) {
    console.error('Archive report error:', error);
    res.status(500).json({ success: false, message: 'Failed to archive report', error: error.message });
  }
};

// ============================================
// DELETE REPORT - Super Admin only
// ============================================

exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    console.log(`🗑️ User ${req.user.id} (${req.user.role}) deleting report ${id}`);

    await report.destroy();

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete report',
      error: error.message
    });
  }
};

// ============================================
// PROJECTS
// ============================================

exports.getProjects = async (req, res) => {
  try {
    const { district, category, status } = req.query;
    const where = {};

    if (district && district !== 'all') where.district = district;
    if (category && category !== 'all') where.category = category;
    if (status && status !== 'all') where.status = status;

    const projects = await Project.findAll({
      where,
      include: [
        { 
          model: Member, 
          as: 'submitter',
          include: [
            { 
              model: User, 
              as: 'user',
              attributes: ['id', 'full_name', 'email']
            }
          ]
        },
        { model: User, as: 'reviewer' }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedProjects = projects.map(project => {
      const projectData = project.toJSON();
      
      let submitterName = 'Unknown';
      if (projectData.submitter?.user?.full_name) {
        submitterName = projectData.submitter.user.full_name;
      } else if (projectData.submitter?.first_name && projectData.submitter?.last_name) {
        submitterName = `${projectData.submitter.first_name} ${projectData.submitter.last_name}`;
      } else if (projectData.submitted_by) {
        submitterName = projectData.submitted_by;
      }

      return {
        ...projectData,
        submitterName: submitterName,
        submittedBy: submitterName,
        fullName: submitterName
      };
    });

    res.json({ 
      success: true, 
      projects: formattedProjects 
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Failed to get projects', error: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id, {
      include: [
        { model: Member, as: 'submitter' },
        { model: User, as: 'reviewer' }
      ]
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ success: false, message: 'Failed to get project', error: error.message });
  }
};

exports.approveProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await project.update({
      status: 'approved',
      feedback: comment,
      reviewed_by: req.user.id,
      reviewed_date: new Date()
    });

    res.json({ success: true, message: 'Project approved', project });
  } catch (error) {
    console.error('Approve project error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve project', error: error.message });
  }
};

exports.rejectProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await project.update({
      status: 'rejected',
      feedback: comment,
      reviewed_by: req.user.id,
      reviewed_date: new Date()
    });

    res.json({ success: true, message: 'Project rejected', project });
  } catch (error) {
    console.error('Reject project error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject project', error: error.message });
  }
};

exports.archiveProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await project.update({ status: 'archived' });
    res.json({ success: true, message: 'Project archived' });
  } catch (error) {
    console.error('Archive project error:', error);
    res.status(500).json({ success: false, message: 'Failed to archive project', error: error.message });
  }
};

// ============================================
// DELETE PROJECT - Super Admin only
// ============================================

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    console.log(`🗑️ User ${req.user.id} (${req.user.role}) deleting project ${id}`);

    await project.destroy();

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete project',
      error: error.message
    });
  }
};
exports.getNationalIdeas = async (req, res) => {
  try {
    const { category, status } = req.query;
    const user = req.user;
    
    console.log(`🏛️ National Commissioner fetching all ideas sent to them`);
    console.log(`👤 User ID: ${user.id}, Role: ${user.role}`);
    
    // ✅ Build where clause - Include both 'national-commissioner' and 'both'
    const whereClause = {
      recipient: {
        [Op.in]: ['national-commissioner', 'both']
      }
    };
    
    // Add category filter if provided
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    // Add status filter if provided
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
    
    console.log(`✅ Found ${ideas.length} ideas for National Commissioner`);
    
    // Log the ideas found
    if (ideas.length > 0) {
      ideas.forEach(idea => {
        console.log(`📊 Idea ${idea.id}: ${idea.title} - Recipient: ${idea.recipient}`);
      });
    } else {
      console.log('📊 No ideas found for National Commissioner');
    }
    
    // Format response
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
    console.error('❌ Error fetching national ideas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ideas',
      error: error.message
    });
  }
};

// ============================================
// GET SINGLE IDEA (National Commissioner)
// ============================================

exports.getNationalIdea = async (req, res) => {
  try {
    const { id } = req.params;
    
    const idea = await Idea.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });
    
    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }
    
    // ✅ Check if idea is for National Commissioner
    if (idea.recipient !== 'national-commissioner' && idea.recipient !== 'both') {
      return res.status(403).json({
        success: false,
        message: 'This idea is not available for National Commissioner review'
      });
    }
    
    res.json({
      success: true,
      idea: idea
    });
    
  } catch (error) {
    console.error('❌ Error fetching national idea:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch idea',
      error: error.message
    });
  }
};

// ============================================
// REVIEW IDEA (National Commissioner)
// ============================================

exports.reviewNationalIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback, response } = req.body;
    const user = req.user;
    
    const idea = await Idea.findByPk(id);
    
    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }
    
    // ✅ Check if idea is for National Commissioner
    if (idea.recipient !== 'national-commissioner' && idea.recipient !== 'both') {
      return res.status(403).json({
        success: false,
        message: 'This idea is not available for National Commissioner review'
      });
    }
    
    await idea.update({
      status: status || idea.status,
      feedback: feedback || idea.feedback,
      response: response || idea.response
    });
    
    // Create notification for the creator
    if (idea.user_id) {
      await Notification.create({
        user_id: idea.user_id,
        type: 'idea_reviewed',
        title: 'Idea Reviewed by National Commissioner',
        message: `Your idea "${idea.title}" has been reviewed by National Commissioner ${user.full_name}`,
        related_id: idea.id,
        related_type: 'idea',
        is_read: false
      });
    }
    
    console.log(`✅ Idea ${id} reviewed by National Commissioner ${user.full_name}`);
    
    res.json({
      success: true,
      message: 'Idea reviewed successfully',
      idea: idea
    });
    
  } catch (error) {
    console.error('❌ Error reviewing national idea:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review idea',
      error: error.message
    });
  }
};

// ============================================
// DELETE IDEA (National Commissioner)
// ============================================

exports.deleteNationalIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    const idea = await Idea.findByPk(id);
    
    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }
    
    // ✅ Check if idea is for National Commissioner
    if (idea.recipient !== 'national-commissioner' && idea.recipient !== 'both') {
      return res.status(403).json({
        success: false,
        message: 'This idea is not available for National Commissioner deletion'
      });
    }
    
    await idea.destroy();
    
    console.log(`🗑️ Idea ${id} deleted by National Commissioner ${user.full_name}`);
    
    res.json({
      success: true,
      message: 'Idea deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting national idea:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete idea',
      error: error.message
    });
  }
};
exports.updateIdeaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📤 Updating idea ${id} to status: ${status}`);
    console.log(`👤 User: ${userId}, Role: ${userRole}`);

    const idea = await Idea.findByPk(id);
    
    if (!idea) {
      console.log(`❌ Idea ${id} not found`);
      return res.status(404).json({ 
        success: false, 
        message: 'Idea not found' 
      });
    }

    const allowedRoles = ['national_commissioner', 'national-commissioner', 'super_admin', 'super-admin', 'admin'];
    const isCommissioner = allowedRoles.includes(userRole);
    const isCreator = idea.user_id === userId;

    console.log(`🔍 Is Commissioner/Super Admin: ${isCommissioner}, Is Creator: ${isCreator}`);

    if (!isCommissioner && !isCreator) {
      console.log(`❌ User ${userId} (${userRole}) denied access`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this idea'
      });
    }

    const updateData = {
      status: status || idea.status,
      feedback: remarks || idea.feedback
    };

    if (isCommissioner) {
      updateData.reviewed_by = userId;
      updateData.reviewed_date = new Date();
    }

    await idea.update(updateData);

    console.log(`✅ Idea ${id} updated successfully`);

    const updatedIdea = await Idea.findByPk(id, {
      include: [
        { 
          model: User, 
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    res.json({
      success: true,
      message: `Idea status updated to ${status}`,
      idea: updatedIdea
    });

  } catch (error) {
    console.error('❌ Update idea status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update idea status',
      error: error.message
    });
  }
};

exports.forwardIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const { office } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📤 Forwarding idea ${id} to: ${office}`);
    console.log(`👤 User: ${userId}, Role: ${userRole}`);

    if (!office || office.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please specify an office to forward to'
      });
    }

    const idea = await Idea.findByPk(id);
    
    if (!idea) {
      console.log(`❌ Idea ${id} not found`);
      return res.status(404).json({ 
        success: false, 
        message: 'Idea not found' 
      });
    }

    const allowedRoles = ['national_commissioner', 'national-commissioner', 'super_admin', 'super-admin', 'admin'];
    const isCommissioner = allowedRoles.includes(userRole);

    if (!isCommissioner) {
      console.log(`❌ User ${userId} (${userRole}) denied access to forward`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to forward ideas'
      });
    }

    await idea.update({
      status: 'forwarded',
      forwarded_to: office.trim(),
      forwarded_by: userId,
      forwarded_date: new Date()
    });

    console.log(`✅ Idea ${id} forwarded to ${office} successfully`);

    const updatedIdea = await Idea.findByPk(id, {
      include: [
        { 
          model: User, 
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    res.json({ 
      success: true, 
      message: `Idea forwarded to ${office}`,
      idea: updatedIdea
    });

  } catch (error) {
    console.error('❌ Forward idea error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to forward idea', 
      error: error.message 
    });
  }
};

// ============================================
// DELETE IDEA - Super Admin only
// ============================================

exports.deleteIdea = async (req, res) => {
  try {
    const { id } = req.params;

    const idea = await Idea.findByPk(id);
    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }

    console.log(`🗑️ User ${req.user.id} (${req.user.role}) deleting idea ${id}`);

    await idea.destroy();

    res.json({
      success: true,
      message: 'Idea deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete idea error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete idea',
      error: error.message
    });
  }
};

// ============================================
// COURSES
// ============================================

exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.findAll({
      include: [{ model: User, as: 'creator' }],
      order: [['created_at', 'DESC']]
    });

    for (const course of courses) {
      const count = await CourseEnrollment.count({
        where: { course_id: course.id }
      });
      course.enrolledCount = count;
    }

    res.json({ success: true, courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to get courses', error: error.message });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const courseData = req.body;
    const user = req.user;

    const course = await Course.create({
      ...courseData,
      created_by: user.id
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ success: false, message: 'Failed to create course', error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const courseData = req.body;

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    await course.update(courseData);
    res.json({ success: true, message: 'Course updated successfully', course });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ success: false, message: 'Failed to update course', error: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const activeEnrollments = await CourseEnrollment.count({
      where: { course_id: id, status: ['approved', 'in_progress'] }
    });

    if (activeEnrollments > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course with ${activeEnrollments} active enrollments`
      });
    }

    console.log(`🗑️ User ${req.user.id} (${req.user.role}) deleting course ${id}`);

    await course.destroy();

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      error: error.message
    });
  }
};

exports.getCourseLearners = async (req, res) => {
  try {
    const { id } = req.params;
    const enrollments = await CourseEnrollment.findAll({
      where: { course_id: id },
      include: [{ model: Member, as: 'member', include: [{ model: User, as: 'user' }] }]
    });

    res.json({ success: true, learners: enrollments });
  } catch (error) {
    console.error('Get learners error:', error);
    res.status(500).json({ success: false, message: 'Failed to get learners', error: error.message });
  }
};

// ============================================
// ANNOUNCEMENTS
// ============================================

exports.createAnnouncement = async (req, res) => {
  try {
    const {
      title,
      content,
      announcement_type,
      district,
      audience,
      send_email,
      schedule_date
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    let audienceValue = audience || ['all'];
    
    if (typeof audienceValue === 'string') {
      if (audienceValue.includes(',')) {
        audienceValue = audienceValue.split(',').map(a => a.trim());
      } else {
        audienceValue = [audienceValue];
      }
    } else if (!Array.isArray(audienceValue)) {
      audienceValue = ['all'];
    }

    if (audienceValue.includes('all') && audienceValue.length > 1) {
      audienceValue = audienceValue.filter(a => a !== 'all');
    }

    if (audienceValue.length === 0) {
      audienceValue = ['all'];
    }

    console.log('📤 Creating announcement with audience:', audienceValue);

    const announcement = await Announcement.create({
      title,
      content,
      announcement_type: announcement_type || 'general',
      district: district || 'all',
      audience: audienceValue,
      send_email: send_email || false,
      schedule_date: schedule_date || null,
      author_id: req.user.id,
      status: 'published',
      published_date: new Date()
    });

    console.log(`📢 Announcement created: "${title}" by ${req.user.full_name}`);

    let emailResults = null;
    if (send_email) {
      try {
        console.log('📧 Sending email notifications...');
        
        const recipients = await getEmailRecipients(audienceValue, district);
        console.log(`📧 Found ${recipients.length} recipients for audience:`, audienceValue);
        
        if (recipients.length > 0) {
          const author = await User.findByPk(req.user.id);
          const result = await sendBulkEmails(recipients, announcement, author);
          emailResults = result.summary;
          console.log(`📧 ${emailResults.sent} emails sent successfully`);
        } else {
          console.log('📧 No recipients found for email notifications');
          emailResults = { sent: 0, failed: 0, total: 0 };
        }
      } catch (emailError) {
        console.error('❌ Email sending error:', emailError);
        emailResults = { sent: 0, failed: 0, total: 0, error: emailError.message };
      }
    }

    const createdAnnouncement = await Announcement.findByPk(announcement.id, {
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
      message: send_email ? 'Announcement created and emails sent!' : 'Announcement created successfully',
      announcement: createdAnnouncement,
      emailResults: emailResults
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
// GET EMAIL RECIPIENTS BASED ON AUDIENCE
// ============================================

const getEmailRecipients = async (audience, district) => {
  const recipients = [];
  const whereConditions = { status: 'active' };

  if (audience.includes('all')) {
    const users = await User.findAll({
      where: { status: 'active' },
      attributes: ['email']
    });
    return users.map(u => u.email).filter(e => e && e.includes('@'));
  }

  const roleConditions = [];
  
  if (audience.includes('scouts')) {
    roleConditions.push({ role: 'scout' });
  }
  if (audience.includes('unit_leaders')) {
    roleConditions.push({ role: 'unit_leader' });
  }
  if (audience.includes('district_commissioners')) {
    roleConditions.push({ role: 'district_commissioner' });
  }
  if (audience.includes('national_commissioners')) {
    roleConditions.push({ role: 'national_commissioner' });
  }
  if (audience.includes('donors')) {
    roleConditions.push({ role: 'donor' });
  }
  if (audience.includes('public')) {
    roleConditions.push(
      { role: 'scout' },
      { role: 'unit_leader' },
      { role: 'district_commissioner' },
      { role: 'national_commissioner' },
      { role: 'donor' }
    );
  }

  if (roleConditions.length === 0) {
    const users = await User.findAll({
      where: { status: 'active' },
      attributes: ['email']
    });
    return users.map(u => u.email).filter(e => e && e.includes('@'));
  }

  const users = await User.findAll({
    where: {
      status: 'active',
      [Op.or]: roleConditions
    },
    attributes: ['email']
  });

  if (district && district !== 'all') {
    const districtLeaders = await User.findAll({
      where: {
        role: 'district_commissioner',
        status: 'active'
      },
      include: [
        {
          model: Member,
          as: 'member',
          where: { district: district }
        }
      ],
      attributes: ['email']
    });
    users.push(...districtLeaders);
  }

  const emailSet = new Set();
  users.forEach(user => {
    if (user.email && user.email.includes('@')) {
      emailSet.add(user.email);
    }
  });

  return Array.from(emailSet);
};
// ============================================
// GET ANNOUNCEMENTS - WITH ALL COLUMNS
// ============================================
exports.getAnnouncements = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📢 National fetching announcements for user: ${userId} (${userRole})`);

    const announcements = await Announcement.findAll({
      where: { status: 'published' },
      order: [['created_at', 'DESC']],
      attributes: [
        'id',
        'title',
        'content',
        'author_id',
        'signature',
        'announcement_type',
        'audience',
        'district',
        'is_public',
        'is_pinned',
        'create_notification',
        'send_email',
        'schedule_date',
        'status',
        'published_date',
        'created_at',
        'updated_at'
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

    const formattedAnnouncements = announcements.map(item => {
      const plain = item.get({ plain: true });
      return {
        id: plain.id,
        title: plain.title,
        content: plain.content,
        message: plain.content,
        announcement_type: plain.announcement_type,
        type: plain.announcement_type,
        district: plain.district || 'all',
        audience: plain.audience || ['all'],
        is_public: plain.is_public || false,
        is_pinned: plain.is_pinned || false,
        create_notification: plain.create_notification !== undefined ? plain.create_notification : true,
        send_email: plain.send_email || false,
        status: plain.status,
        author_id: plain.author_id,
        signature: plain.signature,
        schedule_date: plain.schedule_date,
        published_date: plain.published_date,
        created_at: plain.created_at,
        updated_at: plain.updated_at,
        author: plain.author || { full_name: 'Commissioner' },
        is_read: false,
        read: false
      };
    });

    res.json({
      success: true,
      announcements: formattedAnnouncements
    });

  } catch (error) {
    console.error('❌ Get announcements error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      announcements: []
    });
  }
};
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcementData = req.body;

    const announcement = await Announcement.findByPk(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    await announcement.update(announcementData);
    res.json({ success: true, message: 'Announcement updated successfully' });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement', error: error.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    await announcement.destroy();
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete announcement', error: error.message });
  }
};

// ============================================
// STATISTICS
// ============================================

exports.getStatistics = async (req, res) => {
  try {
    console.log('📊 Fetching complete statistics...');

    const totalMembers = await Member.count() || 0;
    const activeMembers = await Member.count({ 
      where: { membership_status: 'active' } 
    }) || 0;
    const inactiveMembers = totalMembers - activeMembers || 0;
    
    const totalLeaders = await User.count({ 
      where: { 
        role: ['unit_leader', 'district_commissioner', 'national_commissioner', 'super_admin'] 
      } 
    }) || 0;
    
    const totalEvents = await Event.count() || 0;
    const totalProjects = await Project.count() || 0;
    const totalReports = await Report.count() || 0;
    const pendingRegistrations = await Member.count({ 
      where: { membership_status: 'pending' } 
    }) || 0;
    
    const totalDonations = await Donation.sum('amount', { 
      where: { status: 'completed' } 
    }) || 0;
    
    const pendingReports = await Report.count({ 
      where: { status: 'pending' } 
    }) || 0;
    
    const pendingProjects = await Project.count({ 
      where: { status: 'pending' } 
    }) || 0;

    const upcomingEvents = await Event.count({ 
      where: { 
        status: ['upcoming', 'published'],
        start_date: { [Op.gte]: new Date() }
      } 
    }) || 0;

    console.log('📊 Statistics result:', {
      totalMembers,
      activeMembers,
      totalLeaders,
      totalEvents,
      totalProjects,
      totalReports,
      pendingRegistrations,
      pendingReports,
      pendingProjects,
      totalDonations,
      upcomingEvents
    });

    res.json({
      success: true,
      statistics: {
        totalMembers,
        activeMembers,
        inactiveMembers,
        totalLeaders,
        totalEvents,
        totalProjects,
        totalReports,
        pendingRegistrations,
        pendingReports,
        pendingProjects,
        totalDonations,
        upcomingEvents
      }
    });

  } catch (error) {
    console.error('❌ Get statistics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get statistics', 
      error: error.message 
    });
  }
};

// ============================================
// EXPORT STATISTICS - PDF & EXCEL
// ============================================

exports.exportStatistics = async (req, res) => {
  try {
    const { format } = req.query;
    
    console.log(`📤 Exporting statistics in ${format} format...`);
    
    const statsData = {
      totalMembers: await Member.count() || 0,
      activeMembers: await Member.count({ where: { membership_status: 'active' } }) || 0,
      inactiveMembers: 0,
      totalLeaders: await User.count({ where: { role: ['unit_leader', 'district_commissioner', 'national_commissioner', 'super_admin'] } }) || 0,
      totalEvents: await Event.count() || 0,
      totalProjects: await Project.count() || 0,
      totalReports: await Report.count() || 0,
      pendingRegistrations: await Member.count({ where: { membership_status: 'pending' } }) || 0,
      pendingReports: await Report.count({ where: { status: 'pending' } }) || 0,
      pendingProjects: await Project.count({ where: { status: 'pending' } }) || 0,
      totalDonations: await Donation.sum('amount', { where: { status: 'completed' } }) || 0,
      upcomingEvents: await Event.count({ where: { status: ['upcoming', 'published'], start_date: { [Op.gte]: new Date() } } }) || 0,
      exportedAt: new Date().toISOString()
    };

    statsData.inactiveMembers = statsData.totalMembers - statsData.activeMembers;

    if (format === 'pdf') {
      return generatePDF(statsData, res);
    }
    
    if (format === 'excel' || format === 'xlsx') {
      return await generateExcel(statsData, res);
    }

    res.json({
      success: true,
      message: 'Statistics exported successfully',
      data: statsData
    });

  } catch (error) {
    console.error('❌ Export statistics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export statistics', 
      error: error.message 
    });
  }
};

// ============================================
// GENERATE PDF
// ============================================

const generatePDF = (data, res) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=statistics-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    doc.pipe(res);
    
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#FFD100')
       .text('MSR Rwanda', { align: 'center' })
       .moveDown(0.5);
    
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('#002B5C')
       .text('National Statistics Report', { align: 'center' })
       .moveDown(0.5);
    
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#6B7280')
       .text(`Generated: ${new Date(data.exportedAt).toLocaleString()}`, { align: 'center' })
       .moveDown(1.5);
    
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('#1a1a1a')
       .text('Executive Summary', { underline: true })
       .moveDown(0.5);
    
    const stats = [
      ['Metric', 'Value'],
      ['Total Members', data.totalMembers.toString()],
      ['Active Members', data.activeMembers.toString()],
      ['Inactive Members', data.inactiveMembers.toString()],
      ['Total Leaders', data.totalLeaders.toString()],
      ['Total Events', data.totalEvents.toString()],
      ['Upcoming Events', data.upcomingEvents.toString()],
      ['Total Projects', data.totalProjects.toString()],
      ['Total Reports', data.totalReports.toString()],
      ['Pending Registrations', data.pendingRegistrations.toString()],
      ['Pending Reports', data.pendingReports.toString()],
      ['Pending Projects', data.pendingProjects.toString()],
      ['Total Donations', `RWF ${data.totalDonations.toLocaleString()}`]
    ];
    
    let y = doc.y;
    const startX = 50;
    const col1Width = 200;
    const col2Width = 150;
    const rowHeight = 25;
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#FFFFFF');
    
    doc.rect(startX, y, col1Width, rowHeight)
       .fillAndStroke('#FFD100', '#FFD100');
    doc.rect(startX + col1Width, y, col2Width, rowHeight)
       .fillAndStroke('#FFD100', '#FFD100');
    
    doc.fillColor('#1a1a1a')
       .text('Metric', startX + 10, y + 7)
       .text('Value', startX + col1Width + 10, y + 7);
    
    y += rowHeight;
    
    for (let i = 1; i < stats.length; i++) {
      const isEven = i % 2 === 0;
      const fillColor = isEven ? '#F9FAFB' : '#FFFFFF';
      
      doc.rect(startX, y, col1Width, rowHeight)
         .fillAndStroke(fillColor, '#E5E7EB');
      doc.rect(startX + col1Width, y, col2Width, rowHeight)
         .fillAndStroke(fillColor, '#E5E7EB');
      
      doc.fillColor('#1a1a1a')
         .font('Helvetica')
         .fontSize(11)
         .text(stats[i][0], startX + 10, y + 7)
         .text(stats[i][1], startX + col1Width + 10, y + 7);
      
      y += rowHeight;
    }
    
    doc.moveDown(1);
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#6B7280')
       .text('This report was generated automatically by MSR Rwanda System.', { align: 'center' })
       .text(`© ${new Date().getFullYear()} MSR Rwanda. All rights reserved.`, { align: 'center' });
    
    doc.end();
    
  } catch (error) {
    console.error('❌ PDF generation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate PDF', 
      error: error.message 
    });
  }
};

// ============================================
// GENERATE EXCEL
// ============================================

const generateExcel = async (data, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MSR Rwanda';
    workbook.created = new Date();
    
    const sheet = workbook.addWorksheet('Statistics', {
      properties: { tabColor: { argb: 'FFD100' } }
    });
    
    sheet.mergeCells('A1:B1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'MSR Rwanda - National Statistics Report';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF002B5C' } };
    titleCell.alignment = { horizontal: 'center' };
    
    sheet.mergeCells('A2:B2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `Generated: ${new Date(data.exportedAt).toLocaleString()}`;
    dateCell.font = { size: 12, color: { argb: 'FF6B7280' } };
    dateCell.alignment = { horizontal: 'center' };
    
    sheet.addRow([]);
    
    const headers = ['Metric', 'Value'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD100' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 30;
    
    const rows = [
      ['Total Members', data.totalMembers],
      ['Active Members', data.activeMembers],
      ['Inactive Members', data.inactiveMembers],
      ['Total Leaders', data.totalLeaders],
      ['Total Events', data.totalEvents],
      ['Upcoming Events', data.upcomingEvents],
      ['Total Projects', data.totalProjects],
      ['Total Reports', data.totalReports],
      ['Pending Registrations', data.pendingRegistrations],
      ['Pending Reports', data.pendingReports],
      ['Pending Projects', data.pendingProjects],
      ['Total Donations', `RWF ${data.totalDonations.toLocaleString()}`]
    ];
    
    rows.forEach((row, index) => {
      const newRow = sheet.addRow(row);
      newRow.alignment = { vertical: 'middle' };
      newRow.height = 25;
      
      if (index % 2 === 0) {
        newRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }
    });
    
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 25;
    
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=statistics-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('❌ Excel generation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate Excel file', 
      error: error.message 
    });
  }
};

// ============================================
// PUBLISH PROJECT TO PUBLIC
// ============================================

exports.publishProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { publishToPublic } = req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved projects can be published to public'
      });
    }

    await project.update({
      status: 'published',
      published_to_public: true,
      published_at: new Date()
    });

    console.log(`📢 Project ${id} published to public by ${req.user.id}`);

    res.json({
      success: true,
      message: 'Project published to public page successfully',
      project
    });
  } catch (error) {
    console.error('❌ Publish project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish project',
      error: error.message
    });
  }
};
// ============================================
// UPDATE REPORT - National Commissioner edits a report
// ============================================
exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📝 Updating report ${id} by National Commissioner`);
    
    const {
      title,
      description,
      activity_type,
      activity_date,
      location,
      participants_count,
      achievements,
      challenges,
      recommendations,
      district
    } = req.body;

    // Find the report
    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if user has permission to edit this report
    if (!['national_commissioner', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this report'
      });
    }

    // Update fields - only update if provided
    if (title) report.title = title.trim();
    if (description) report.description = description.trim();
    if (activity_type) report.activity_type = activity_type;
    if (activity_date) report.activity_date = activity_date;
    if (location) report.location = location;
    if (participants_count) report.participants_count = parseInt(participants_count) || 0;
    if (achievements) report.achievements = achievements;
    if (challenges) report.challenges = challenges;
    if (recommendations) report.recommendations = recommendations;
    if (district) report.district = district;

    // Add note that this report was edited by National Commissioner
    report.edited_by = req.user.id;
    report.edited_at = new Date();
    report.edit_count = (report.edit_count || 0) + 1;

    await report.save();

    console.log(`✅ Report ${id} updated successfully`);

    // Fetch updated report with associations
    const updatedReport = await Report.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'submitter',
          attributes: ['id', 'first_name', 'last_name', 'district', 'troop_name']
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
        }
        // ✅ REMOVE Unit from here if it's not needed, or make sure it's imported
      ]
    });

    res.json({
      success: true,
      message: 'Report updated successfully',
      report: updatedReport
    });

  } catch (error) {
    console.error('❌ Error updating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report',
      error: error.message
    });
  }
};
// ============================================
// RESEND REPORT - Resend to donor or public
// ============================================
exports.resendReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { destination } = req.body;
    
    console.log(`📤 Resending report ${id} to ${destination} by National Commissioner`);

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if user has permission
    if (!['national_commissioner', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to resend this report'
      });
    }

    // Only published reports can be resent
    if (report.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Only published reports can be resent. Current status: ' + report.status
      });
    }

    // Update publication flags based on destination
    if (destination === 'donor-portal' || destination === 'both') {
      report.published_to_donors = true;
    }
    if (destination === 'public-website' || destination === 'both') {
      report.published_to_public = true;
    }

    // Add resend tracking
    report.resent_at = new Date();
    report.resent_by = req.user.id;
    report.resent_count = (report.resent_count || 0) + 1;
    report.last_resent_destination = destination;

    await report.save();

    console.log(`✅ Report ${id} resent to ${destination} successfully`);

    // Fetch updated report with associations
    const updatedReport = await Report.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'submitter',
          attributes: ['id', 'first_name', 'last_name', 'district', 'troop_name']
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
        }
      ]
    });

    res.json({
      success: true,
      message: `Report resent to ${destination} successfully`,
      report: updatedReport
    });

  } catch (error) {
    console.error('❌ Error resending report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend report',
      error: error.message
    });
  }
};
// ============================================
// GENERATE ATTENDANCE LINK WITH AUTO NOTIFICATIONS (NATIONAL)
// ============================================
exports.generateAttendanceLink = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log(`🔗 Generating attendance link for national event: ${eventId}`);
    
    // ✅ Find the event
    const event = await Event.findByPk(eventId, {
      attributes: [
        'id',
        'title',
        'start_date',
        'end_date',
        'location',
        'venue',
        'district_id',
        'scope',
        'is_national'
      ]
    });
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // ✅ Check if event is national
    if (event.scope !== 'national' && !event.is_national) {
      return res.status(400).json({
        success: false,
        message: 'This is not a national event. Use district attendance link instead.'
      });
    }

    // ✅ Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    console.log('🔑 Generated token:', token);
    
    // ✅ Set expiry to 30 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    console.log('⏰ Link expires at:', expiresAt);

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const attendanceLink = `${baseUrl}/attendance/${token}`;
    
    // ✅ Update event with attendance link
    await event.update({ 
      attendance_token: token,
      attendance_link: attendanceLink,
      attendance_link_expires: expiresAt,
      attendance_link_generated: true,
      attendance_link_generated_at: new Date()
    });

    // ✅ Get ALL approved registrations for this event
    const registrations = await EventRegistration.findAll({
      where: { 
        event_id: eventId, 
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

    console.log(`📤 Sending attendance link to ${registrations.length} registered users for national event: ${event.title}`);

    // ✅ Send notification to EACH registered user
    const notificationPromises = registrations.map(async (registration) => {
      const user = registration.member?.user;
      if (!user) return null;

      try {
        const notification = await Notification.create({
          user_id: user.id,
          type: 'attendance_link',
          title: `📋 Attendance Link Available - ${event.title}`,
          message: `The attendance link for national event "${event.title}" is now available. Click to mark your attendance. Link expires in 30 minutes.\n\n📅 Event: ${event.title}\n📍 Location: ${event.location || event.venue || 'TBD'}\n📆 Date: ${new Date(event.start_date).toLocaleDateString()}\n⏰ Time: ${new Date(event.start_date).toLocaleTimeString()}`,
          link: attendanceLink, // ✅ THE FULL LINK!
          icon: '📋',
          color: '#4299e1',
          is_read: false,
          metadata: {
            event_id: event.id,
            event_title: event.title,
            attendance_link: attendanceLink,
            expires_at: expiresAt,
            token: token,
            event_date: event.start_date,
            location: event.location || event.venue,
            scope: 'national'
          }
        });
        console.log(`✅ Notification sent to: ${user.email} (${user.full_name})`);
        return notification;
      } catch (err) {
        console.error(`❌ Failed to send notification to user ${user.id}:`, err.message);
        return null;
      }
    });

    const results = await Promise.all(notificationPromises);
    const sentCount = results.filter(r => r !== null).length;

    console.log(`✅ National attendance link generated and ${sentCount} notifications sent successfully!`);

    // ✅ Get updated event
    const updatedEvent = await Event.findByPk(eventId, {
      attributes: ['id', 'title', 'attendance_link', 'attendance_link_expires']
    });

    res.json({ 
      success: true, 
      message: `Attendance link generated and sent to ${sentCount} registered users!`,
      data: {
        attendance_link: attendanceLink,
        expires_at: expiresAt,
        notifications_sent: sentCount,
        total_registered: registrations.length,
        event_title: event.title,
        event_id: event.id,
        scope: 'national'
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
// backend/src/controllers/nationalController.js

// ============================================
// GET SINGLE REPORT BY ID
// ============================================
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    console.log(`📊 Fetching report ${id} for user: ${userId} (${userRole})`);

    const report = await Report.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'submitter',
          attributes: ['id', 'first_name', 'last_name', 'district', 'troop_name']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email', 'role']
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
      ]
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // ✅ Donors can only view forwarded reports
    if (userRole === 'donor' && report.status !== 'forwarded') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only forwarded reports are available to donors.'
      });
    }

    // ✅ National users can view all reports
    res.json({
      success: true,
      report: report
    });

  } catch (error) {
    console.error('❌ Get report by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report',
      error: error.message
    });
  }
};