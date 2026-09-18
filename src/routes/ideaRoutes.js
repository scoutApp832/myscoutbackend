// src/routes/ideaRoutes.js

console.log('🔵 IDEA ROUTES FILE IS EXECUTING!');

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Idea, Member, User } = require('../models');

console.log('📦 Models loaded:', { 
  Idea: !!Idea, 
  Member: !!Member, 
  User: !!User 
});

// ============================================
// CREATE IDEA
// ============================================

const createIdea = async (req, res) => {
  console.log('🔥 CREATE IDEA CALLED!');
  console.log('📥 Body:', req.body);
  console.log('👤 User:', req.user?.id);
  
  try {
    const { title, description, category, recipient, suggestion } = req.body;
    const user = req.user;
    
    if (!user || !user.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }
    
    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title is required' 
      });
    }
    
    if (!description || !description.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Description is required' 
      });
    }
    
    // Get district
    let userDistrict = 'Nyarugenge';
    try {
      const member = await Member.findOne({
        where: { user_id: user.id },
        attributes: ['district']
      });
      if (member?.district) userDistrict = member.district;
    } catch (err) {
      console.warn('Could not fetch district:', err.message);
    }
    
    // ✅ SAVE TO DATABASE
    const idea = await Idea.create({
      title: title.trim(),
      description: description.trim(),
      category: category || 'Other',
      recipient: recipient || 'district_commissioner',
      suggestion: suggestion ? suggestion.trim() : null,
      status: 'pending',
      feedback: null,
      response: null,
      district: userDistrict,
      user_id: user.id
    });
    
    console.log('✅ IDEA SAVED! ID:', idea.id);
    
    return res.status(201).json({
      success: true,
      message: 'Idea submitted successfully',
      idea: {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        category: idea.category,
        recipient: idea.recipient,
        status: idea.status,
        district: idea.district,
        suggestion: idea.suggestion,
        created_at: idea.created_at,
        updated_at: idea.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ ERROR creating idea:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create idea: ' + error.message,
      error: error.message
    });
  }
};

// ============================================
// GET IDEAS
// ============================================

const getIdeas = async (req, res) => {
  console.log('📊 GET IDEAS CALLED!');
  console.log('👤 User:', req.user?.id);
  
  try {
    const user = req.user;
    
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        ideas: []
      });
    }
    
    const whereClause = {};
    
    if (user.role === 'scout' || user.role === 'unit_leader') {
      whereClause.user_id = parseInt(user.id);
      console.log('👤 Filtering by user_id:', whereClause.user_id);
    }
    
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
    
    console.log(`✅ Found ${ideas.length} ideas`);
    
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
      user_id: idea.user_id,
      created_at: idea.created_at,
      updated_at: idea.updated_at
    }));
    
    return res.json({
      success: true,
      total: formattedIdeas.length,
      ideas: formattedIdeas
    });
    
  } catch (error) {
    console.error('❌ Error fetching ideas:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ideas',
      error: error.message,
      ideas: []
    });
  }
};

// ============================================
// PLACEHOLDER FUNCTIONS
// ============================================

const getIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

const updateIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

const deleteIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

const forwardIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

const reviewIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

const getNationalIdeas = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

const getDistrictIdeas = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

// ============================================
// REGISTER ROUTES
// ============================================

console.log('📝 Registering idea routes...');

// ✅ TEST ROUTE - PUBLIC (NO AUTH)
router.get('/test', (req, res) => {
  console.log('🧪 Test route called!');
  res.json({ 
    success: true, 
    message: 'Idea routes are working! (REAL ROUTER)',
    timestamp: new Date().toISOString(),
    routerLoaded: true
  });
});

// ✅ PROTECTED ROUTES (Require Auth)
router.get('/', authenticate, getIdeas);
router.post('/', authenticate, createIdea);
router.get('/:id', authenticate, getIdea);
router.put('/:id', authenticate, updateIdea);
router.delete('/:id', authenticate, deleteIdea);
router.post('/:id/forward', authenticate, forwardIdea);
router.put('/:id/review', authenticate, reviewIdea);
router.get('/national', authenticate, getNationalIdeas);
router.get('/district', authenticate, getDistrictIdeas);

console.log('✅ All idea routes registered');
console.log('📋 Routes:');
console.log('  ✅ GET  /api/ideas/test - PUBLIC (no auth)');
console.log('  🔒 GET  /api/ideas - Requires auth');
console.log('  🔒 POST /api/ideas - Requires auth');
console.log('  🔒 GET  /api/ideas/:id - Requires auth');
console.log('  🔒 PUT  /api/ideas/:id - Requires auth');
console.log('  🔒 DEL  /api/ideas/:id - Requires auth');
console.log('  🔒 POST /api/ideas/:id/forward - Requires auth');
console.log('  🔒 PUT  /api/ideas/:id/review - Requires auth');
console.log('  🔒 GET  /api/ideas/national - Requires auth');
console.log('  🔒 GET  /api/ideas/district - Requires auth');

console.log('✅ Idea routes loaded successfully');

// ✅ THIS IS CRITICAL - MUST export router directly
module.exports = router;

console.log('📤 Router exported with stack:', !!router.stack);
console.log('📤 Router type:', typeof router);