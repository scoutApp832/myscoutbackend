// backend/src/controllers/donationController.js
const { Donation, Project, Idea, Event, User, Notification, Member, Payment } = require('../models');
const { Op } = require('sequelize');

console.log('📦 Loading donationController.js...');

// ============================================
// GET DONATIONS - READ ONLY (NO CREATION)
// ============================================
exports.getDonations = async (req, res) => {
  console.log('✅ getDonations controller called!');
  console.log('  - User ID:', req.user?.id);
  console.log('  - User Role:', req.user?.role);
  
  try {
    const userId = req.user.id;
    const { date, project, limit } = req.query;
    
    console.log('📊 Query params:', { date, project, limit });
    
    // Build where clause
    const where = { donor_id: userId };
    
    // Date filtering
    if (date && date !== 'all') {
      const now = new Date();
      if (date === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        where.created_at = { [Op.gte]: startOfDay };
      } else if (date === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        where.created_at = { [Op.gte]: weekAgo };
      } else if (date === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        where.created_at = { [Op.gte]: monthAgo };
      } else if (date === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        where.created_at = { [Op.gte]: yearAgo };
      }
    }

    if (project && project !== 'all') {
      where.project_id = project;
    }

    console.log('🔍 Where clause:', JSON.stringify(where));

    // ✅ ONLY READ - DO NOT CREATE DONATIONS HERE
    const donations = await Donation.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    console.log(`✅ Found ${donations.length} donations in database`);
    
    // Log each donation
    donations.forEach(d => {
      console.log(`  - ID: ${d.id}, Amount: ${d.amount}, Status: ${d.status}, Created: ${d.created_at}`);
    });

    // Format donations for frontend
    const formattedDonations = donations.map(d => ({
      id: d.id,
      amount: parseFloat(d.amount) || 0,
      status: d.status || 'pending',
      payment_method: d.payment_method || 'mobile_money',
      paymentMethod: d.payment_method || 'mobile_money',
      message: d.message || '',
      project: d.message || 'General Donation',
      project_id: d.project_id,
      date: d.created_at ? new Date(d.created_at).toLocaleDateString() : null,
      created_at: d.created_at,
      donor_id: d.donor_id,
      donor_name: d.donor_name || 'Anonymous',
      donor_email: d.donor_email || '',
      payment_reference: d.payment_reference,
      is_anonymous: d.is_anonymous || false,
      currency: d.currency || 'RWF'
    }));

    console.log(`📤 Sending ${formattedDonations.length} donations to frontend`);

    res.json(formattedDonations);
    
  } catch (error) {
    console.error('❌ Get donations error:', error);
    res.status(500).json([]);
  }
};

// ============================================
// GET DONATION STATS - READ ONLY
// ============================================
exports.getDonationStats = async (req, res) => {
  console.log('✅ getDonationStats called!');

  try {
    // 1. Make sure user is authenticated
    if (!req.user || !req.user.id) {
      console.error('❌ No authenticated user found');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // 2. Get logged-in user's ID
    const userId = Number(req.user.id);

    console.log('👤 Authenticated user:', {
      id: req.user.id,
      numericId: userId,
      role: req.user.role,
      email: req.user.email
    });

    // 3. Find this donor's donations
    const donations = await Donation.findAll({
      where: {
        donor_id: userId
      },
      attributes: [
        'id',
        'donor_id',
        'amount',
        'currency',
        'status',
        'created_at'
      ],
      order: [['created_at', 'DESC']]
    });

    console.log('💰 Donations found:', donations.length);

    donations.forEach(donation => {
      console.log(
        `   ID: ${donation.id} | ` +
        `Donor: ${donation.donor_id} | ` +
        `Amount: ${donation.amount} | ` +
        `Status: ${donation.status}`
      );
    });

    // 4. Calculate total
    const totalDonations = await Donation.sum('amount', {
      where: {
        donor_id: userId
      }
    });

    // 5. Calculate number of donations
    const donationCount = await Donation.count({
      where: {
        donor_id: userId
      }
    });

    const total = Number(totalDonations) || 0;
    const count = Number(donationCount) || 0;

    console.log('📊 FINAL DONATION STATS:');
    console.log('   Total:', total);
    console.log('   Count:', count);

    // 6. Send response to frontend
    return res.status(200).json({
      success: true,
      totalDonations: total,
      donationCount: count,
      activeProjects: 0
    });

  } catch (error) {
    console.error('❌ Get donation stats error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load donation statistics',
      error: error.message
    });
  }
};

// ============================================
// CREATE DONATION - WITH DUPLICATE PROTECTION
// ============================================
exports.donate = async (req, res) => {
  console.log('✅ donate controller called!');
  console.log('  - Body:', req.body);
  console.log('  - User ID:', req.user?.id);
  
  try {
    const { projectId, eventId, amount, paymentMethod, message, isAnonymous } = req.body;

    // Validate amount
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid donation amount'
      });
    }

    // ✅ Prevent duplicate donation (same donor, same amount, pending, within 1 minute)
    const existingDonation = await Donation.findOne({
      where: {
        donor_id: req.user.id,
        amount: Number(amount),
        status: 'pending'
      },
      order: [['created_at', 'DESC']]
    });

    if (existingDonation) {
      const age = Date.now() - new Date(existingDonation.created_at).getTime();
      
      // Same donation submitted within 1 minute
      if (age < 60 * 1000) {
        console.log(`⚠️ Duplicate donation prevented. Existing ID: ${existingDonation.id}`);
        
        return res.status(200).json({
          success: true,
          message: 'Donation already submitted',
          donation: {
            id: existingDonation.id,
            amount: existingDonation.amount,
            status: existingDonation.status,
            payment_method: existingDonation.payment_method,
            created_at: existingDonation.created_at
          }
        });
      }
    }

    // ✅ Check if project exists if projectId is provided
    if (projectId) {
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // ✅ Check if event exists if eventId is provided
    if (eventId) {
      const event = await Event.findByPk(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
    }

    // ✅ Create donation
    const donation = await Donation.create({
      donor_id: req.user.id,
      project_id: projectId || null,
      event_id: eventId || null,
      amount: Number(amount),
      payment_method: paymentMethod || 'mobile_money',
      message: message || '',
      status: 'pending',
      is_anonymous: isAnonymous || false,
      donor_name: req.user.full_name,
      donor_email: req.user.email,
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log(`✅ Donation created: ID ${donation.id}`);

    // ✅ Create notification
    try {
      await Notification.create({
        user_id: req.user.id,
        title: 'Donation Received',
        message: `Your donation of RWF ${Number(amount).toLocaleString()} has been received and is pending approval.`,
        type: 'donation',
        is_read: false
      });
    } catch (notifError) {
      console.warn('⚠️ Notification creation failed:', notifError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Donation submitted successfully',
      donation: {
        id: donation.id,
        amount: donation.amount,
        status: donation.status,
        payment_method: donation.payment_method,
        created_at: donation.created_at
      }
    });
    
  } catch (error) {
    console.error('❌ Donate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to make donation',
      error: error.message
    });
  }
};

// ============================================
// GET PROJECTS
// ============================================
exports.getProjects = async (req, res) => {
  console.log('✅ getProjects controller called!');
  
  try {
    if (!Project || typeof Project.findAll !== 'function') {
      console.error('❌ Project model not available!');
      return res.json([]);
    }

    const queryOptions = {
      attributes: ['id', 'title', 'description', 'budget', 'status', 'timeline', 'objectives', 'file_url', 'submitted_by', 'created_at', 'updated_at'],
      where: { status: ['active', 'pending'] },
      order: [['created_at', 'DESC']]
    };

    if (req.query.limit) {
      queryOptions.limit = parseInt(req.query.limit);
    }

    const projects = await Project.findAll(queryOptions);

    console.log(`✅ Found ${projects.length} projects`);
    
    const formattedProjects = projects.map(project => ({
      id: project.id,
      title: project.title || 'Untitled Project',
      description: project.description || '',
      goal: parseFloat(project.budget) || 0,
      raised: 0,
      status: project.status || 'pending',
      category: 'Project',
      timeline: project.timeline,
      objectives: project.objectives,
      file_url: project.file_url,
      created_at: project.created_at
    }));
    
    res.json(formattedProjects);
  } catch (error) {
    console.error('❌ Get projects error:', error);
    res.json([]);
  }
};

// ============================================
// GET IDEAS
// ============================================
exports.getIdeas = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('📥 GET /ideas called by user:', userId, 'role:', userRole);

    let whereClause = {};
    
    if (userRole === 'donor') {
      whereClause = {
        [Op.or]: [
          { user_id: userId },
          { status: { [Op.in]: ['published', 'approved'] } }
        ]
      };
    } else {
      whereClause = {};
    }

    console.log('🔍 Where clause:', JSON.stringify(whereClause));

    const ideas = await Idea.findAll({
      where: whereClause,
      limit: parseInt(limit) || 10,
      offset: parseInt(offset) || 0,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    console.log(`✅ Found ${ideas.length} ideas`);

    const formattedIdeas = ideas.map(idea => ({
      id: idea.id,
      title: idea.title || 'Untitled',
      description: idea.description || '',
      category: idea.category || 'general',
      status: idea.status || 'pending',
      suggestion: idea.suggestion || '',
      response: idea.response || idea.feedback || '',
      feedback: idea.feedback || '',
      user_id: idea.user_id,
      recipient: idea.recipient || '',
      district: idea.district || '',
      created_at: idea.created_at,
      updated_at: idea.updated_at,
      author: idea.creator?.full_name || 'Unknown'
    }));

    const total = await Idea.count({ where: whereClause });

    res.json({
      success: true,
      ideas: formattedIdeas,
      total,
      pagination: { 
        limit: parseInt(limit) || 10, 
        offset: parseInt(offset) || 0, 
        total 
      }
    });
  } catch (error) {
    console.error('❌ Get ideas error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get ideas', 
      error: error.message 
    });
  }
};

// ============================================
// CREATE IDEA
// ============================================
exports.createIdea = async (req, res) => {
  console.log('✅ createIdea controller called!');
  console.log('  - Body:', req.body);
  console.log('  - User ID:', req.user?.id);
  
  try {
    const { title, description, category, suggestion } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    const ideaData = {
      title: title,
      description: description,
      category: category || 'general',
      suggestion: suggestion || '',
      user_id: req.user.id,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };

    const idea = await Idea.create(ideaData);
    
    console.log('✅ Idea created successfully:', idea.id);

    res.status(201).json({
      success: true,
      message: 'Idea submitted successfully',
      idea: {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        category: idea.category,
        suggestion: idea.suggestion,
        status: idea.status,
        created_at: idea.created_at
      }
    });
  } catch (error) {
    console.error('❌ Create idea error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create idea',
      error: error.message
    });
  }
};

// ============================================
// GET EVENTS
// ============================================
exports.getEvents = async (req, res) => {
  console.log('✅ getEvents controller called!');
  
  try {
    if (!Event || typeof Event.findAll !== 'function') {
      console.error('❌ Event model not available!');
      return res.json([]);
    }

    const events = await Event.findAll({
      where: { status: ['upcoming', 'ongoing'] },
      attributes: ['id', 'title', 'description', 'start_date', 'end_date', 'location', 'venue', 'status', 'created_at'],
      order: [['start_date', 'ASC']]
    });

    console.log(`✅ Found ${events.length} events`);

    const formattedEvents = events.map(event => ({
      id: event.id,
      title: event.title || 'Untitled Event',
      description: event.description || '',
      date: event.start_date || event.created_at,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location || event.venue || 'TBD',
      status: event.status || 'upcoming',
      created_at: event.created_at
    }));

    res.json(formattedEvents);
  } catch (error) {
    console.error('❌ Get events error:', error);
    res.json([]);
  }
};

// ============================================
// GET UPDATES - ONLY APPROVED PROJECTS
// ============================================
exports.getUpdates = async (req, res) => {
  console.log('✅ getUpdates controller called!');
  
  try {
    const { type } = req.query;
    let updates = [];
    
    // 1. FETCH PROJECTS - ONLY APPROVED/PUBLISHED/COMPLETED
    if (Project && typeof Project.findAll === 'function') {
      const projects = await Project.findAll({
        attributes: ['id', 'title', 'description', 'budget', 'status', 'created_at', 'updated_at'],
        where: {
          status: {
            [Op.in]: ['approved', 'published', 'completed']
          }
        },
        order: [['created_at', 'DESC']]
      });
      
      console.log(`📋 Found ${projects.length} approved projects`);
      
      const projectUpdates = projects.map(p => ({
        id: `project-${p.id}`,
        title: `✅ ${p.title || 'Untitled Project'}`,
        message: p.description || `Project ${p.title} is ${p.status || 'approved'}`,
        type: 'project',
        status: p.status || 'approved',
        date: p.created_at ? new Date(p.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
        image: null,
        video: null,
        document: null
      }));
      
      updates = [...updates, ...projectUpdates];
    }
    
    // 2. FETCH EVENTS - COMPLETED OR ONGOING
    if (Event && typeof Event.findAll === 'function') {
      const events = await Event.findAll({
        attributes: ['id', 'title', 'description', 'start_date', 'status', 'created_at'],
        where: {
          status: {
            [Op.in]: ['completed', 'ongoing']
          }
        },
        order: [['start_date', 'DESC']],
        limit: 10
      });
      
      console.log(`📅 Found ${events.length} completed/ongoing events`);
      
      const eventUpdates = events.map(e => ({
        id: `event-${e.id}`,
        title: `📅 ${e.title || 'Untitled Event'}`,
        message: e.description || `Event ${e.title} is ${e.status || 'ongoing'}`,
        type: 'event',
        status: e.status || 'ongoing',
        date: e.start_date ? new Date(e.start_date).toLocaleDateString() : new Date().toLocaleDateString(),
        image: null,
        video: null,
        document: null
      }));
      
      updates = [...updates, ...eventUpdates];
    }
    
    // 3. FETCH DONATIONS WITH MESSAGES (Thank You)
    if (Donation && typeof Donation.findAll === 'function') {
      const donations = await Donation.findAll({
        attributes: ['id', 'message', 'amount', 'created_at', 'donor_name'],
        where: { status: 'completed' },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      console.log(`❤️ Found ${donations.length} completed donations`);
      
      const thankYouUpdates = donations
        .filter(d => d.message && d.message.trim() !== '')
        .map(d => ({
          id: `thanks-${d.id}`,
          title: '❤️ Thank You!',
          message: d.message || `Thank you for your donation of RWF ${d.amount}`,
          type: 'thankyou',
          status: 'completed',
          date: d.created_at ? new Date(d.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
          image: null,
          video: null,
          document: null
        }));
      
      updates = [...updates, ...thankYouUpdates];
    }
    
    // 4. FILTER BY TYPE
    if (type && type !== 'all') {
      updates = updates.filter(u => u.type === type);
    }
    
    // 5. SORT BY DATE (NEWEST FIRST)
    updates.sort((a, b) => new Date(b.date) - new Date(a.date));
    updates = updates.slice(0, 20);
    
    console.log(`✅ Found ${updates.length} total updates (approved projects only)`);
    res.json(updates);
    
  } catch (error) {
    console.error('❌ Get updates error:', error);
    res.json([]);
  }
};

console.log('✅ Donation controller loaded successfully!');
console.log('  - getDonations:', typeof exports.getDonations);
console.log('  - getProjects:', typeof exports.getProjects);
console.log('  - getIdeas:', typeof exports.getIdeas);
console.log('  - createIdea:', typeof exports.createIdea);
console.log('  - getEvents:', typeof exports.getEvents);
console.log('  - getUpdates:', typeof exports.getUpdates);
console.log('  - donate:', typeof exports.donate);
console.log('  - getDonationStats:', typeof exports.getDonationStats);