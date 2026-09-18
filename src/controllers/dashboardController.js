const { Member, Event, EventRegistration, Project, Report, Donation, User, Idea, Notification, District } = require('../models');
const { Op } = require('sequelize');

// ============================================
// SCOUT DASHBOARD
// ============================================

exports.getScoutStats = async (req, res) => {
  try {
    const user = req.user;
    const member = await Member.findOne({ where: { user_id: user.id } });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const events = await EventRegistration.count({
      where: { member_id: member.id, status: 'approved' }
    });

    const courses = 0;
    const projects = await Project.count({
      where: { submitted_by: member.id }
    });
    const ideas = await Idea.count({
      where: { user_id: user.id }
    });

    res.json({
      success: true,
      events,
      courses,
      projects,
      ideas,
      notifications: 0
    });
  } catch (error) {
    console.error('Get scout stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats', error: error.message });
  }
};

exports.getScoutRecentActivities = async (req, res) => {
  try {
    const user = req.user;
    const member = await Member.findOne({ where: { user_id: user.id } });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const registrations = await EventRegistration.findAll({
      where: { member_id: member.id },
      include: [{ model: Event, as: 'event' }],
      limit: 5,
      order: [['created_at', 'DESC']]
    });

    const activities = registrations.map(reg => ({
      id: reg.id,
      title: reg.event?.title || 'Event',
      status: reg.status,
      date: reg.created_at
    }));

    res.json(activities);
  } catch (error) {
    console.error('Get scout activities error:', error);
    res.status(500).json({ success: false, message: 'Failed to get activities', error: error.message });
  }
};

exports.getScoutUpcomingEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      where: { status: 'upcoming' },
      limit: 5,
      order: [['start_date', 'ASC']]
    });

    res.json(events);
  } catch (error) {
    console.error('Get scout events error:', error);
    res.status(500).json({ success: false, message: 'Failed to get events', error: error.message });
  }
};

// ============================================
// DISTRICT DASHBOARD
// ============================================

exports.getDistrictStats = async (req, res) => {
  try {
    const user = req.user;
    const member = await Member.findOne({ where: { user_id: user.id } });
    const district = member?.district;

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const totalScouts = await Member.count({ where: { district } });
    const totalLeaders = await User.count({
      where: { role: 'unit_leader' },
      include: [{ model: Member, as: 'member', where: { district } }]
    });

    res.json({
      totalScouts,
      totalLeaders,
      activeMembers: totalScouts,
      inactiveMembers: 0,
      upcomingEvents: 0,
      ongoingEvents: 0,
      pendingRegistrations: 0,
      pendingFeeApprovals: 0,
      reportsAwaiting: 0,
      projectSubmissions: 0
    });
  } catch (error) {
    console.error('Get district stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats', error: error.message });
  }
};

exports.getDistrictRecentActivities = async (req, res) => {
  try {
    const user = req.user;
    const member = await Member.findOne({ where: { user_id: user.id } });
    const district = member?.district;

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const reports = await Report.findAll({
      where: { district },
      limit: 5,
      order: [['created_at', 'DESC']]
    });

    res.json(reports.map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      date: r.created_at
    })));
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ success: false, message: 'Failed to get activities', error: error.message });
  }
};

exports.getDistrictUpcomingEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      where: { status: 'upcoming' },
      limit: 5,
      order: [['start_date', 'ASC']]
    });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, message: 'Failed to get events', error: error.message });
  }
};

exports.getDistrictAnnouncements = async (req, res) => {
  try {
    // Placeholder - will be implemented with Announcement model
    res.json([]);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to get announcements', error: error.message });
  }
};

exports.getDistrictNotifications = async (req, res) => {
  try {
    // Placeholder - will be implemented with Notification model
    res.json([]);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to get notifications', error: error.message });
  }
};

exports.getDistrictChartData = async (req, res) => {
  try {
    const user = req.user;
    const member = await Member.findOne({ where: { user_id: user.id } });
    const district = member?.district;

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const members = await Member.findAll({
      where: { district },
      attributes: ['unit']
    });

    const unitCount = {};
    members.forEach(m => {
      const unit = m.unit || 'Unassigned';
      unitCount[unit] = (unitCount[unit] || 0) + 1;
    });

    const chartData = Object.keys(unitCount).map(name => ({
      name,
      members: unitCount[name]
    }));

    res.json(chartData);
  } catch (error) {
    console.error('Get chart data error:', error);
    res.status(500).json({ success: false, message: 'Failed to get chart data', error: error.message });
  }
};

exports.getDistrictGenderData = async (req, res) => {
  try {
    const user = req.user;
    const member = await Member.findOne({ where: { user_id: user.id } });
    const district = member?.district;

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const males = await Member.count({ where: { district, gender: 'male' } });
    const females = await Member.count({ where: { district, gender: 'female' } });

    res.json([
      { name: 'Male', value: males },
      { name: 'Female', value: females }
    ]);
  } catch (error) {
    console.error('Get gender data error:', error);
    res.status(500).json({ success: false, message: 'Failed to get gender data', error: error.message });
  }
};

// ============================================
// NATIONAL DASHBOARD
// ============================================

exports.getNationalStats = async (req, res) => {
  try {
    const totalMembers = await Member.count();
    const activeMembers = await Member.count({ where: { membership_status: 'active' } });
    const totalLeaders = await User.count({ where: { role: 'unit_leader' } });
    const totalEvents = await Event.count();

    res.json({
      totalMembers,
      activeMembers,
      totalLeaders,
      totalEvents,
      upcomingEvents: 0,
      pendingRegistrations: 0,
      pendingReports: 0,
      pendingProjects: 0,
      totalDonations: 0
    });
  } catch (error) {
    console.error('Get national stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats', error: error.message });
  }
};

exports.getNationalRecentActivities = async (req, res) => {
  try {
    const reports = await Report.findAll({
      limit: 5,
      order: [['created_at', 'DESC']]
    });

    res.json(reports.map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      date: r.created_at
    })));
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ success: false, message: 'Failed to get activities', error: error.message });
  }
};

exports.getNationalUpcomingEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      where: { status: 'upcoming' },
      limit: 5,
      order: [['start_date', 'ASC']]
    });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, message: 'Failed to get events', error: error.message });
  }
};

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

exports.getNationalGenderData = async (req, res) => {
  try {
    const males = await Member.count({ where: { gender: 'male' } });
    const females = await Member.count({ where: { gender: 'female' } });
    const others = await Member.count({ where: { gender: 'other' } });

    res.json([
      { name: 'Male', value: males },
      { name: 'Female', value: females },
      { name: 'Other', value: others }
    ]);
  } catch (error) {
    console.error('Get gender data error:', error);
    res.status(500).json({ success: false, message: 'Failed to get gender data', error: error.message });
  }
};

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
        if (age <= 12) groups['6-12']++;
        else if (age <= 18) groups['13-18']++;
        else if (age <= 25) groups['19-25']++;
        else groups['25+']++;
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

exports.getNationalNotifications = async (req, res) => {
  try {
    // Placeholder - will be implemented with Notification model
    res.json([]);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to get notifications', error: error.message });
  }
};

// ============================================
// DONOR DASHBOARD - COMPLETE
// ============================================

exports.getDonorStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get total donations
    const totalDonations = await Donation.sum('amount', {
      where: { donor_id: userId, status: 'completed' }
    });

    // Get donation count
    const donationCount = await Donation.count({
      where: { donor_id: userId, status: 'completed' }
    });

    // Get active projects supported
    const activeProjects = await Project.count({
      where: { status: 'active' }
    });

    // Get events supported
    const supportedEvents = await Event.count({
      where: { status: 'upcoming' }
    });

    // Get updates
    const updates = await Notification.count({
      where: { user_id: userId, is_read: false }
    });

    res.json({
      success: true,
      totalDonations: totalDonations || 0,
      donationCount: donationCount || 0,
      activeProjects: activeProjects || 0,
      supportedEvents: supportedEvents || 0,
      updates: updates || 0
    });
  } catch (error) {
    console.error('Get donor stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats', error: error.message });
  }
};

exports.getDonorRecentDonations = async (req, res) => {
  try {
    const donations = await Donation.findAll({
      where: { donor_id: req.user.id },
      include: [
        { model: Project, as: 'project', attributes: ['id', 'title'] },
        { model: Event, as: 'event', attributes: ['id', 'title'] }
      ],
      limit: 10,
      order: [['created_at', 'DESC']]
    });

    const formattedDonations = donations.map(d => ({
      id: d.id,
      amount: d.amount,
      status: d.status || 'completed',
      project: d.project?.title || d.project_name || 'General',
      type: d.type || 'donation',
      date: d.created_at,
      created_at: d.created_at
    }));

    res.json(formattedDonations);
  } catch (error) {
    console.error('Get recent donations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get donations', error: error.message });
  }
};

exports.getDonorActiveProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      where: { 
        status: 'active',
        [Op.or]: [
          { goal: { [Op.gt]: 0 } },
          { status: 'active' }
        ]
      },
      limit: 10,
      order: [['created_at', 'DESC']]
    });

    const formattedProjects = projects.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description || 'No description available',
      goal: p.goal || 0,
      raised: p.raised || 0,
      status: p.status || 'active',
      created_at: p.created_at
    }));

    res.json(formattedProjects);
  } catch (error) {
    console.error('Get active projects error:', error);
    res.status(500).json({ success: false, message: 'Failed to get projects', error: error.message });
  }
};

exports.getDonorUpdates = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      limit: 10,
      order: [['created_at', 'DESC']]
    });

    const formattedUpdates = notifications.map(n => ({
      id: n.id,
      title: n.title || 'Update',
      message: n.message || n.content,
      icon: n.icon || 'fa-info-circle',
      date: n.created_at,
      is_read: n.is_read || false,
      created_at: n.created_at
    }));

    res.json(formattedUpdates);
  } catch (error) {
    console.error('Get updates error:', error);
    res.status(500).json({ success: false, message: 'Failed to get updates', error: error.message });
  }
};

exports.getDonorChartData = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get monthly donation data
    const donations = await Donation.findAll({
      where: { 
        donor_id: userId,
        status: 'completed'
      },
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'month'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: ['month'],
      order: [['month', 'ASC']],
      limit: 6
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const chartData = months.map((month, index) => {
      const donation = donations.find(d => {
        const dMonth = new Date(d.get('month')).getMonth();
        return dMonth === index;
      });
      return {
        month,
        amount: donation ? donation.get('total') : 0
      };
    });

    res.json(chartData);
  } catch (error) {
    console.error('Get chart data error:', error);
    // Return sample data if error
    res.json([
      { month: 'Jan', amount: 0 },
      { month: 'Feb', amount: 0 },
      { month: 'Mar', amount: 0 },
      { month: 'Apr', amount: 0 },
      { month: 'May', amount: 0 },
      { month: 'Jun', amount: 0 }
    ]);
  }
};

exports.getDonorIdeals = async (req, res) => {
  try {
    const ideas = await Idea.findAll({
      where: { 
        [Op.or]: [
          { status: 'published' },
          { status: 'approved' }
        ]
      },
      limit: 10,
      order: [['created_at', 'DESC']]
    });

    const formattedIdeas = ideas.map(i => ({
      id: i.id,
      title: i.title,
      description: i.description,
      category: i.category || 'general',
      status: i.status,
      created_at: i.created_at
    }));

    res.json(formattedIdeas);
  } catch (error) {
    console.error('Get donor ideals error:', error);
    res.status(500).json({ success: false, message: 'Failed to get ideals', error: error.message });
  }
};

exports.getDonorEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      where: { 
        status: 'upcoming',
        [Op.or]: [
          { scope: 'national' },
          { is_national: true }
        ]
      },
      limit: 10,
      order: [['start_date', 'ASC']]
    });

    const formattedEvents = events.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description || 'No description available',
      location: e.location || e.venue || 'TBD',
      start_date: e.start_date,
      end_date: e.end_date,
      status: e.status,
      created_at: e.created_at
    }));

    res.json(formattedEvents);
  } catch (error) {
    console.error('Get donor events error:', error);
    res.status(500).json({ success: false, message: 'Failed to get events', error: error.message });
  }
};

// Make donation
exports.makeDonation = async (req, res) => {
  try {
    const { amount, project_id, event_id, message } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid donation amount'
      });
    }

    const donation = await Donation.create({
      donor_id: userId,
      amount: amount,
      project_id: project_id || null,
      event_id: event_id || null,
      message: message || '',
      status: 'pending',
      type: 'donation'
    });

    res.json({
      success: true,
      message: 'Donation created successfully',
      donation: donation
    });
  } catch (error) {
    console.error('Make donation error:', error);
    res.status(500).json({ success: false, message: 'Failed to make donation', error: error.message });
  }
};