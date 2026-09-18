const { Project, Member, User, AuditLog } = require('../models');

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
        { model: Member, as: 'submitter', attributes: ['id', 'first_name', 'last_name'] },
        { model: User, as: 'reviewer', attributes: ['id', 'full_name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, projects });
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
        { model: Member, as: 'submitter', attributes: ['id', 'first_name', 'last_name'] },
        { model: User, as: 'reviewer', attributes: ['id', 'full_name'] }
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

exports.createProject = async (req, res) => {
  try {
    const projectData = req.body;
    const member = req.user.member;

    const project = await Project.create({
      ...projectData,
      submitted_by: member.id,
      district: member.district,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Project submitted successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit project', error: error.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const projectData = req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await project.update(projectData);

    res.json({
      success: true,
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: 'Failed to update project', error: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await project.update({ status: 'archived' });
    res.json({ success: true, message: 'Project archived successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, message: 'Failed to archive project', error: error.message });
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

    res.json({
      success: true,
      message: 'Project approved successfully',
      project
    });
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

    res.json({
      success: true,
      message: 'Project rejected',
      project
    });
  } catch (error) {
    console.error('Reject project error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject project', error: error.message });
  }
};