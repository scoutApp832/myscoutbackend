const { Member, User, Event, EventRegistration, Project, Report, Donation } = require('../models');

exports.getStatistics = async (req, res) => {
  try {
    const totalMembers = await Member.count();
    const activeMembers = await Member.count({ where: { membership_status: 'active' } });
    const totalLeaders = await User.count({ where: { role: 'unit_leader' } });
    const totalEvents = await Event.count();
    const totalProjects = await Project.count();
    const totalReports = await Report.count();
    const totalDonations = await Donation.sum('amount', { where: { status: 'completed' } });

    res.json({
      totalMembers,
      activeMembers,
      inactiveMembers: totalMembers - activeMembers,
      totalLeaders,
      totalEvents,
      totalProjects,
      totalReports,
      totalDonations: totalDonations || 0,
      pendingProjects: await Project.count({ where: { status: 'pending' } }),
      pendingReports: await Report.count({ where: { status: 'pending' } })
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to get statistics', error: error.message });
  }
};

exports.exportStatistics = async (req, res) => {
  try {
    const stats = await exports.getStatistics(req, res);
    // In a real app, generate CSV/PDF here
    res.json({
      success: true,
      message: 'Statistics exported',
      data: stats
    });
  } catch (error) {
    console.error('Export statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to export statistics', error: error.message });
  }
};