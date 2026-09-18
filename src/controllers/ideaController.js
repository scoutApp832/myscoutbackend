// src/controllers/ideaController.js

console.log('🚀 LOADING IDEA CONTROLLER...');

const { Idea, User, Member } = require('../models');

console.log('📦 Models loaded:', { 
  Idea: !!Idea, 
  User: !!User, 
  Member: !!Member 
});

// ✅ CREATE IDEA
exports.createIdea = async (req, res) => {
  console.log('🔥 CREATE IDEA CALLED!');
  console.log('📥 Body:', req.body);
  console.log('👤 User:', req.user?.id);
  
  try {
    const { title, description, category, recipient, suggestion } = req.body;
    const user = req.user;
    
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required' });
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
        created_at: idea.created_at,
        updated_at: idea.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create idea: ' + error.message,
      error: error.message
    });
  }
};

// ✅ GET IDEAS
exports.getIdeas = async (req, res) => {
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

// ✅ Placeholders
exports.getIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

exports.updateIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

exports.deleteIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

exports.forwardIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

exports.reviewIdea = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

exports.getNationalIdeas = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

exports.getDistrictIdeas = async (req, res) => {
  return res.status(501).json({ message: 'Not implemented' });
};

console.log('✅ IDEA CONTROLLER LOADED!');
console.log('📦 Exported methods:', Object.keys(exports));