const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Report, User, Member, Unit } = require('../models');
const { protect } = require('../middleware/auth');

console.log('🔄 Loading report routes...');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/reports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'report-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = function (req, file, cb) {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 
    'application/pdf',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, Word, and Excel files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

// ============================================
// POST /api/reports - Create a new report
// ============================================
router.post('/reports', protect, function (req, res) {
  upload.array('attachments', 10)(req, res, async function (err) {
    if (err) {
      console.error('❌ Upload error:', err);
      return res.status(400).json({ 
        success: false,
        message: 'File upload error: ' + err.message 
      });
    }

    try {
      console.log('📝 Creating report...');
      console.log('👤 User:', req.user.id);

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
        unit_id,
        type
      } = req.body;

      // Validate required fields
      if (!title || !title.trim()) {
        return res.status(400).json({ 
          success: false,
          message: 'Report title is required' 
        });
      }

      if (!activity_date) {
        return res.status(400).json({ 
          success: false,
          message: 'Activity date is required' 
        });
      }

      // Get the member record for this user
      const member = await Member.findOne({
        where: { user_id: req.user.id }
      });

      if (!member) {
        return res.status(400).json({
          success: false,
          message: 'Member profile not found. Please complete your profile.'
        });
      }

      // IMPORTANT: Get the district from the member record
      const districtName = member.district;
      
      if (!districtName) {
        return res.status(400).json({
          success: false,
          message: 'Your district is not set. Please contact your administrator.'
        });
      }

      console.log(`📍 Report will be assigned to district: ${districtName}`);

      // Process attachments - store file info with metadata
      const fileUrls = req.files ? req.files.map(function (file) {
        return '/uploads/reports/' + file.filename;
      }) : [];

      // Create report - ALWAYS use the member's district
      const reportData = {
        title: title.trim(),
        description: description || null,
        activity_type: activity_type || null,
        activity_date: activity_date,
        location: location || null,
        participants_count: participants_count ? parseInt(participants_count) : 0,
        achievements: achievements || null,
        challenges: challenges || null,
        recommendations: recommendations || null,
        status: 'pending',
        submitted_by: member.id,
        created_by: req.user.id,
        unit_id: unit_id || null,
        district: districtName,
        type: type || 'activity',
        file_urls: fileUrls,
        published_to_public: false,
        published_to_donors: false
      };

      console.log('📊 Report data:', reportData);

      const report = await Report.create(reportData);
      console.log('✅ Report created with ID:', report.id);

      // Fetch the report with associations
      const createdReport = await Report.findByPk(report.id, {
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
            model: Unit,
            as: 'unit',
            attributes: ['id', 'name']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: `Report submitted successfully to ${districtName} District Commissioner!`,
        report: createdReport
      });

    } catch (error) {
      console.error('❌ Error creating report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit report: ' + error.message
      });
    }
  });
});

// ============================================
// GET /api/reports - Get all reports
// ============================================
router.get('/reports', protect, async function (req, res) {
  try {
    const { status, userId, limit = 100, offset = 0 } = req.query;
    let where = {};

    // Filter by status
    if (status && status !== 'all') {
      where.status = status;
    }

    // Get the user's district from the members table
    const member = await Member.findOne({
      where: { user_id: req.user.id }
    });

    // For District Commissioners - filter by their district
    if (req.user.role === 'district_commissioner') {
      if (member && member.district) {
        where.district = member.district;
        console.log(`🏛️ District Commissioner filtering reports for: ${member.district}`);
      } else {
        console.warn('⚠️ District Commissioner has no district assigned');
        return res.status(400).json({
          success: false,
          message: 'Your district is not assigned. Please contact administrator.'
        });
      }
    }

    // For Unit Leaders - filter by their district AND their own reports
    if (req.user.role === 'unit_leader') {
      if (member && member.district) {
        where.district = member.district;
        where.submitted_by = member.id;
        console.log(`👤 Unit Leader filtering reports for: ${member.district}`);
      } else {
        console.warn('⚠️ Unit Leader has no district assigned');
        return res.status(400).json({
          success: false,
          message: 'Your district is not assigned. Please contact administrator.'
        });
      }
    }

    // For National Commissioner/Admin - see all reports
    if (req.user.role === 'national_commissioner' || req.user.role === 'admin') {
      console.log('👑 National Commissioner/Admin - viewing all reports');
    }

    const reports = await Report.findAndCountAll({
      where: where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
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
        },
        {
          model: Unit,
          as: 'unit',
          attributes: ['id', 'name']
        }
      ]
    });

    console.log(`✅ Found ${reports.count} reports for ${req.user.role}`);

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
});

// ============================================
// GET /api/reports/:id - Get a single report
// ============================================
router.get('/reports/:id', protect, async function (req, res) {
  try {
    const report = await Report.findByPk(req.params.id, {
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
      ]
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, report: report });

  } catch (error) {
    console.error('❌ Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report',
      error: error.message
    });
  }
});

// ============================================
// GET /api/reports/:reportId/attachments/:attachmentId/view - View file (SECURE)
// ============================================
router.get('/reports/:reportId/attachments/:attachmentId/view', protect, async function (req, res) {
  try {
    const { reportId, attachmentId } = req.params;
    console.log(`📄 Viewing attachment ${attachmentId} from report ${reportId}`);
    
    // Find the report
    const report = await Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Check permissions
    const member = await Member.findOne({ where: { user_id: req.user.id } });
    
    const hasAccess = 
      report.created_by === req.user.id ||
      report.submitted_by === (member ? member.id : null) ||
      (req.user.role === 'district_commissioner' && report.district === (member ? member.district : null)) ||
      ['admin', 'national_commissioner'].includes(req.user.role);

    if (!hasAccess) {
      console.warn(`⛔ Access denied for user ${req.user.id} to report ${reportId}`);
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get the file URL from the attachments array
    const fileUrls = report.file_urls || [];
    const fileIndex = parseInt(attachmentId);
    
    if (fileIndex >= fileUrls.length || fileIndex < 0) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const filePath = fileUrls[fileIndex];
    const filename = filePath.split('/').pop();
    const fullPath = path.join(__dirname, '../../uploads/reports/', filename);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Set headers for viewing (inline)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send the file for viewing
    res.sendFile(fullPath, (err) => {
      if (err) {
        console.error('❌ Error sending file:', err);
        return res.status(500).json({ success: false, message: 'Error serving file' });
      }
    });

  } catch (error) {
    console.error('❌ Error viewing file:', error);
    res.status(500).json({ success: false, message: 'Error viewing file' });
  }
});

// ============================================
// GET /api/reports/:reportId/attachments/:attachmentId/download - Download file (SECURE)
// ============================================
router.get('/reports/:reportId/attachments/:attachmentId/download', protect, async function (req, res) {
  try {
    const { reportId, attachmentId } = req.params;
    console.log(`⬇️ Downloading attachment ${attachmentId} from report ${reportId}`);
    
    // Find the report
    const report = await Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Check permissions
    const member = await Member.findOne({ where: { user_id: req.user.id } });
    
    const hasAccess = 
      report.created_by === req.user.id ||
      report.submitted_by === (member ? member.id : null) ||
      (req.user.role === 'district_commissioner' && report.district === (member ? member.district : null)) ||
      ['admin', 'national_commissioner'].includes(req.user.role);

    if (!hasAccess) {
      console.warn(`⛔ Access denied for user ${req.user.id} to report ${reportId}`);
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get the file URL from the attachments array
    const fileUrls = report.file_urls || [];
    const fileIndex = parseInt(attachmentId);
    
    if (fileIndex >= fileUrls.length || fileIndex < 0) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const filePath = fileUrls[fileIndex];
    const filename = filePath.split('/').pop();
    const fullPath = path.join(__dirname, '../../uploads/reports/', filename);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Set headers for download (attachment)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Force download
    res.download(fullPath, filename, (err) => {
      if (err) {
        console.error('❌ Error downloading file:', err);
        return res.status(500).json({ success: false, message: 'Error downloading file' });
      }
    });

  } catch (error) {
    console.error('❌ Error downloading file:', error);
    res.status(500).json({ success: false, message: 'Error downloading file' });
  }
});

// ============================================
// PUT /api/reports/:id - Update a report
// ============================================
router.put('/reports/:id', protect, upload.array('attachments', 10), async function (req, res) {
  try {
    console.log('📝 Updating report:', req.params.id);
    console.log('👤 User:', req.user.id);

    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({ 
        success: false,
        message: 'Report not found' 
      });
    }

    // Check permissions
    if (report.created_by !== req.user.id && 
        req.user.role !== 'district_commissioner' && 
        req.user.role !== 'admin' &&
        req.user.role !== 'national_commissioner') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this report'
      });
    }

    // For District Commissioners, verify the report is in their district
    if (req.user.role === 'district_commissioner') {
      const member = await Member.findOne({
        where: { user_id: req.user.id }
      });
      if (member && member.district && report.district !== member.district) {
        return res.status(403).json({
          success: false,
          message: 'You can only update reports from your district'
        });
      }
    }

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
      unit_id,
      district
    } = req.body;

    // Update fields if provided
    if (title) report.title = title.trim();
    if (description) report.description = description.trim();
    if (activity_type) report.activity_type = activity_type;
    if (activity_date) report.activity_date = activity_date;
    if (location) report.location = location;
    if (participants_count) report.participants_count = parseInt(participants_count);
    if (achievements) report.achievements = achievements;
    if (challenges) report.challenges = challenges;
    if (recommendations) report.recommendations = recommendations;
    if (unit_id) report.unit_id = unit_id;
    
    // District should only be updated if provided and user has permission
    if (district && (req.user.role === 'admin' || req.user.role === 'national_commissioner')) {
      report.district = district;
    }

    // Add new attachments
    if (req.files && req.files.length > 0) {
      const newFileUrls = req.files.map(file => `/uploads/reports/${file.filename}`);
      const existingFiles = report.file_urls || [];
      report.file_urls = [...existingFiles, ...newFileUrls];
    }

    // If status was revision and being updated by Unit Leader, reset to pending
    if (report.status === 'revision' && req.user.role === 'unit_leader') {
      report.status = 'pending';
      report.feedback = null;
      report.reviewed_by = null;
      report.reviewed_at = null;
    }

    await report.save();

    // Fetch updated report with associations
    const updatedReport = await Report.findByPk(report.id, {
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
      ]
    });

    console.log('✅ Report updated:', report.id);

    res.json({
      success: true,
      message: 'Report updated successfully',
      report: updatedReport
    });

  } catch (error) {
    console.error('❌ Error updating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report: ' + error.message
    });
  }
});

// ============================================
// PUT /api/reports/:id/approve - Approve report
// ============================================
router.put('/reports/:id/approve', protect, async function (req, res) {
  try {
    const { feedback } = req.body;
    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (!['district_commissioner', 'national_commissioner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    // For District Commissioners, verify the report is in their district
    if (req.user.role === 'district_commissioner') {
      const member = await Member.findOne({
        where: { user_id: req.user.id }
      });
      if (member && member.district && report.district !== member.district) {
        return res.status(403).json({
          success: false,
          message: 'You can only approve reports from your district'
        });
      }
    }

    report.status = 'approved';
    report.feedback = feedback || report.feedback;
    report.reviewed_by = req.user.id;
    report.reviewed_at = new Date();

    await report.save();

    res.json({
      success: true,
      message: 'Report approved successfully',
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
});

// ============================================
// PUT /api/reports/:id/reject - Request revision
// ============================================
router.put('/reports/:id/reject', protect, async function (req, res) {
  try {
    const { feedback } = req.body;
    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (!['district_commissioner', 'national_commissioner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    // For District Commissioners, verify the report is in their district
    if (req.user.role === 'district_commissioner') {
      const member = await Member.findOne({
        where: { user_id: req.user.id }
      });
      if (member && member.district && report.district !== member.district) {
        return res.status(403).json({
          success: false,
          message: 'You can only reject reports from your district'
        });
      }
    }

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'Feedback is required for revision request' 
      });
    }

    report.status = 'revision';
    report.feedback = feedback.trim();
    report.reviewed_by = req.user.id;
    report.reviewed_at = new Date();

    await report.save();

    res.json({
      success: true,
      message: 'Revision requested',
      report: report
    });

  } catch (error) {
    console.error('❌ Error requesting revision:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request revision',
      error: error.message
    });
  }
});

// ============================================
// PUT /api/reports/:id/archive - Archive report
// ============================================
router.put('/reports/:id/archive', protect, async function (req, res) {
  try {
    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.status = 'archived';
    await report.save();

    res.json({
      success: true,
      message: 'Report archived successfully',
      report: report
    });

  } catch (error) {
    console.error('❌ Error archiving report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive report',
      error: error.message
    });
  }
});

// ============================================
// DELETE /api/reports/:id - Delete a report
// ============================================
router.delete('/reports/:id', protect, async function (req, res) {
  try {
    console.log('🗑️ Deleting report:', req.params.id);

    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({ 
        success: false,
        message: 'Report not found' 
      });
    }

    // Check permissions
    if (report.created_by !== req.user.id && 
        req.user.role !== 'admin' && 
        req.user.role !== 'national_commissioner') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this report'
      });
    }

    // For District Commissioners, verify the report is in their district
    if (req.user.role === 'district_commissioner') {
      const member = await Member.findOne({
        where: { user_id: req.user.id }
      });
      if (member && member.district && report.district !== member.district) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete reports from your district'
        });
      }
    }

    // Only allow deletion if status is pending or revision
    if (report.status !== 'pending' && report.status !== 'revision') {
      return res.status(400).json({
        success: false,
        message: 'Only pending or revision reports can be deleted'
      });
    }

    // Delete associated files from server
    if (report.file_urls && report.file_urls.length > 0) {
      for (const filePath of report.file_urls) {
        const filename = filePath.split('/').pop();
        const fullPath = path.join(__dirname, '../../uploads/reports/', filename);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`🗑️ Deleted file: ${filename}`);
        }
      }
    }

    await report.destroy();

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete report',
      error: error.message
    });
  }
});

// ============================================
// GET /api/reports/stats - Get report statistics
// ============================================
router.get('/reports/stats', protect, async function (req, res) {
  try {
    let where = {};

    if (req.user.role === 'district_commissioner') {
      const member = await Member.findOne({
        where: { user_id: req.user.id }
      });
      if (member && member.district) {
        where.district = member.district;
      }
    }

    if (req.user.role === 'unit_leader') {
      const member = await Member.findOne({
        where: { user_id: req.user.id }
      });
      if (member) {
        where.submitted_by = member.id;
        where.district = member.district;
      }
    }

    const total = await Report.count({ where: where });
    const pending = await Report.count({ where: { ...where, status: 'pending' } });
    const approved = await Report.count({ where: { ...where, status: 'approved' } });
    const revision = await Report.count({ where: { ...where, status: 'revision' } });
    const rejected = await Report.count({ where: { ...where, status: 'rejected' } });
    const archived = await Report.count({ where: { ...where, status: 'archived' } });

    res.json({
      success: true,
      stats: {
        total: total,
        pending: pending,
        approved: approved,
        revision: revision,
        rejected: rejected,
        archived: archived
      }
    });

  } catch (error) {
    console.error('❌ Error fetching report stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report statistics',
      error: error.message
    });
  }
});

// ============================================
// GET /api/user/district - Get current user's district
// ============================================
router.get('/user/district', protect, async function (req, res) {
  try {
    const member = await Member.findOne({
      where: { user_id: req.user.id },
      attributes: ['district', 'id', 'first_name', 'last_name']
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    res.json({
      success: true,
      district: member.district,
      member: member
    });

  } catch (error) {
    console.error('❌ Error fetching user district:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch district information',
      error: error.message
    });
  }
});

console.log('✅ Report routes loaded successfully');

module.exports = router;