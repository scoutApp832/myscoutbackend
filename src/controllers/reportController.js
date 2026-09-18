const { Report, Member, Unit, User, AuditLog } = require('../models');

exports.getReports = async (req, res) => {
  try {
    const { district, status } = req.query;
    const where = {};

    if (district && district !== 'all') where.district = district;
    if (status && status !== 'all') where.status = status;

    const reports = await Report.findAll({
      where,
      include: [
        { model: Member, as: 'submitter', attributes: ['id', 'first_name', 'last_name'] },
        { model: Unit, as: 'unit', attributes: ['id', 'name'] },
        { model: User, as: 'reviewer', attributes: ['id', 'full_name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, reports });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to get reports', error: error.message });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findByPk(id, {
      include: [
        { model: Member, as: 'submitter', attributes: ['id', 'first_name', 'last_name'] },
        { model: Unit, as: 'unit', attributes: ['id', 'name'] },
        { model: User, as: 'reviewer', attributes: ['id', 'full_name'] }
      ]
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ success: false, message: 'Failed to get report', error: error.message });
  }
};

exports.createReport = async (req, res) => {
  try {
    const reportData = req.body;
    const member = req.user.member;

    const report = await Report.create({
      ...reportData,
      submitted_by: member.id,
      district: member.district,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit report', error: error.message });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const reportData = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await report.update(reportData);

    res.json({
      success: true,
      message: 'Report updated successfully',
      report
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ success: false, message: 'Failed to update report', error: error.message });
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
      reviewed_at: new Date()   // ✅ FIXED
    });

    res.json({
      success: true,
      message: 'Report approved successfully',
      report
    });
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
      reviewed_at: new Date()   // ✅ FIXED
    });

    res.json({
      success: true,
      message: 'Report rejected',
      report
    });
  } catch (error) {
    console.error('Reject report error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject report', error: error.message });
  }
};