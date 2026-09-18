const { Event, EventRegistration, Member, User, AuditLog } = require('../models');
const { Op } = require('sequelize');

// ============================================
// ✅ GET EVENTS FOR DONATION MODULE (SIMPLIFIED)
// ============================================
exports.getDonationEvents = async (req, res) => {
  console.log('✅ getDonationEvents called!');
  
  try {
    const events = await Event.findAll({
      where: { 
        status: ['upcoming', 'ongoing'] 
      },
      attributes: ['id', 'title', 'description', 'start_date', 'end_date', 'location', 'venue', 'status', 'created_at'],
      order: [['start_date', 'ASC']]
    });

    console.log(`✅ Found ${events.length} events for donation module`);

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
    console.error('❌ Get donation events error:', error);
    res.json([]);
  }
};

// ============================================
// ✅ GET ALL EVENTS - COMPLETE
// ============================================
exports.getEvents = async (req, res) => {
  try {
    console.log('📅 Fetching events...');
    
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
      order: [['start_date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // ✅ Get registration counts for each event
    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const registrationCount = await EventRegistration.count({
        where: { event_id: event.id, status: 'approved' }
      });
      
      const pendingCount = await EventRegistration.count({
        where: { event_id: event.id, status: 'pending' }
      });

      return {
        ...event.toJSON(),
        registrationCount,
        pendingCount
      };
    }));

    res.json({
      success: true,
      events: eventsWithCounts,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get events error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get events', 
      error: error.message,
      events: []
    });
  }
};

// ============================================
// ✅ GET UPCOMING EVENTS
// ============================================
exports.getUpcomingEvents = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const events = await Event.findAll({
      where: {
        start_date: { [Op.gte]: new Date() },
        status: { [Op.in]: ['published', 'approved'] }
      },
      order: [['start_date', 'ASC']],
      limit: parseInt(limit)
    });

    // ✅ Get registration counts
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
      count: eventsWithCounts.length
    });
  } catch (error) {
    console.error('❌ Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upcoming events',
      error: error.message,
      events: []
    });
  }
};

// ============================================
// ✅ GET EVENT BY ID
// ============================================
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id);

    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // ✅ Get registration counts
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
    console.error('❌ Get event error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get event', 
      error: error.message 
    });
  }
};

// ============================================
// ✅ CREATE EVENT
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
      category,
      registration_deadline,
      status = 'draft'
    } = req.body;

    // ✅ Validate required fields
    if (!title || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Title, start date and end date are required'
      });
    }

    // ✅ Validate dates
    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const user = req.user;

    const event = await Event.create({
      title,
      description: description || '',
      start_date,
      end_date,
      location: location || '',
      capacity: capacity || null,
      price: price || 0,
      category: category || 'general',
      registration_deadline: registration_deadline || null,
      status,
      created_by: user.id
    });

    // ✅ Log activity
    if (AuditLog) {
      await AuditLog.create({
        user_id: user.id,
        action: 'CREATE_EVENT',
        entity: 'event',
        entity_id: event.id,
        details: `Event "${title}" created by ${user.full_name}`
      });
    }

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
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
// ✅ UPDATE EVENT
// ============================================
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const eventData = req.body;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // ✅ Check if trying to update a cancelled event
    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a cancelled event'
      });
    }

    await event.update(eventData);

    // ✅ Log activity
    if (AuditLog) {
      await AuditLog.create({
        user_id: req.user.id,
        action: 'UPDATE_EVENT',
        entity: 'event',
        entity_id: event.id,
        details: `Event "${event.title}" updated by ${req.user.full_name}`
      });
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('❌ Update event error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update event', 
      error: error.message 
    });
  }
};

// ============================================
// ✅ DELETE EVENT (CANCEL)
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

    // ✅ Check if there are approved registrations
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

    // ✅ Log activity
    if (AuditLog) {
      await AuditLog.create({
        user_id: req.user.id,
        action: 'CANCEL_EVENT',
        entity: 'event',
        entity_id: event.id,
        details: `Event "${event.title}" cancelled by ${req.user.full_name}`
      });
    }

    res.json({ 
      success: true, 
      message: 'Event cancelled successfully' 
    });
  } catch (error) {
    console.error('❌ Delete event error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel event', 
      error: error.message 
    });
  }
};

// ============================================
// ✅ REGISTER FOR EVENT
// ============================================
exports.registerForEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // ✅ Get user with member
    const user = await User.findByPk(userId, {
      include: [{ model: Member, as: 'member' }]
    });

    if (!user || !user.member) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member profile not found' 
      });
    }

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // ✅ Check registration deadline
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Registration deadline has passed' 
      });
    }

    // ✅ Check if already registered
    const existingRegistration = await EventRegistration.findOne({
      where: { 
        event_id: id, 
        user_id: userId 
      }
    });

    if (existingRegistration) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already registered for this event' 
      });
    }

    // ✅ Check capacity
    if (event.capacity) {
      const approvedCount = await EventRegistration.count({
        where: { event_id: id, status: 'approved' }
      });
      
      if (approvedCount >= event.capacity) {
        return res.status(400).json({ 
          success: false, 
          message: 'Event is full' 
        });
      }
    }

    // ✅ Create registration
    const status = event.price > 0 ? 'pending' : 'approved';
    const registration = await EventRegistration.create({
      event_id: id,
      user_id: userId,
      status: status,
      registration_date: new Date()
    });

    res.json({
      success: true,
      message: event.price > 0 
        ? 'Registration pending payment approval' 
        : 'Registration successful',
      registration
    });
  } catch (error) {
    console.error('❌ Register for event error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to register for event', 
      error: error.message 
    });
  }
};

// ============================================
// ✅ CANCEL REGISTRATION
// ============================================
exports.cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const registration = await EventRegistration.findOne({
      where: { event_id: id, user_id: userId }
    });

    if (!registration) {
      return res.status(404).json({ 
        success: false, 
        message: 'Registration not found' 
      });
    }

    if (registration.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Registration is already cancelled'
      });
    }

    await registration.update({ status: 'cancelled' });

    res.json({ 
      success: true, 
      message: 'Registration cancelled successfully' 
    });
  } catch (error) {
    console.error('❌ Cancel registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel registration', 
      error: error.message 
    });
  }
};

// ============================================
// ✅ APPROVE REGISTRATION
// ============================================
exports.approveRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await EventRegistration.findByPk(registrationId);

    if (!registration) {
      return res.status(404).json({ 
        success: false, 
        message: 'Registration not found' 
      });
    }

    if (registration.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Registration is already approved'
      });
    }

    // ✅ Get event to check capacity
    const event = await Event.findByPk(registration.event_id);
    
    // ✅ Check capacity before approving
    if (event && event.capacity) {
      const approvedCount = await EventRegistration.count({
        where: { 
          event_id: registration.event_id, 
          status: 'approved' 
        }
      });
      
      if (approvedCount >= event.capacity) {
        return res.status(400).json({ 
          success: false, 
          message: 'Event is full' 
        });
      }
    }

    await registration.update({ status: 'approved' });

    res.json({ 
      success: true, 
      message: 'Registration approved successfully' 
    });
  } catch (error) {
    console.error('❌ Approve registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to approve registration', 
      error: error.message 
    });
  }
};

// ============================================
// ✅ GET EVENT REGISTRATIONS
// ============================================
exports.getEventRegistrations = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    const registrations = await EventRegistration.findAll({
      where: { event_id: id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'email', 'phone']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      registrations,
      count: registrations.length,
      stats: {
        approved: registrations.filter(r => r.status === 'approved').length,
        pending: registrations.filter(r => r.status === 'pending').length,
        cancelled: registrations.filter(r => r.status === 'cancelled').length
      }
    });
  } catch (error) {
    console.error('❌ Get event registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registrations',
      error: error.message,
      registrations: []
    });
  }
};