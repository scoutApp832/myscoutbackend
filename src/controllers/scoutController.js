const { User, Member, Event, EventRegistration, Course, CourseEnrollment, Idea,
  Project, Report, Notification, CourseTopic, 
  CourseMaterial,   
  CourseAssessment,
  Announcement  // ✅ Added Announcement (capital A)
} = require('../models');
const { Op } = require('sequelize');

// ============================================
// ✅ PROFILE ROUTES
// ============================================

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Member, as: 'member' }],
      attributes: { exclude: ['password_hash'] }
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, ...memberData } = req.body;
    const user = req.user;
    await user.update({ full_name: fullName, phone });
    if (user.member) {
      await user.member.update(memberData);
    }
    res.json({ success: true, message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    await user.update({ password_hash: newPassword });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
  }
};

// ============================================
// ✅ UPLOAD AVATAR
// ============================================

exports.uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📤 Avatar upload request for user:', userId);
    console.log('📤 File:', req.file);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    console.log('📤 Avatar URL:', avatarUrl);

    const member = await Member.findOne({ where: { user_id: userId } });
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    await member.update({
      profile_image: avatarUrl
    });

    console.log('✅ Avatar URL saved to database for user:', userId);

    const updatedMember = await Member.findOne({ where: { user_id: userId } });
    console.log('✅ Updated profile_image:', updatedMember.profile_image);

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });

  } catch (error) {
    console.error('❌ Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar',
      error: error.message
    });
  }
};

// ============================================
// ✅ EVENT ROUTES
// ============================================

exports.getEvents = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { filter = 'all' } = req.query;
    const userId = req.user.id;

    console.log('📅 Fetching events for user:', userId, 'filter:', filter);

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member profile not found' 
      });
    }

    let whereClause = { 
      status: ['published', 'upcoming']
    };
    const now = new Date();
    
    if (filter === 'upcoming') {
      whereClause.start_date = { [Op.gte]: now };
    } else if (filter === 'past') {
      whereClause.end_date = { [Op.lt]: now };
    } else if (filter === 'registered') {
      const registrations = await EventRegistration.findAll({
        where: { member_id: member.id },
        attributes: ['event_id']
      });
      const eventIds = registrations.map(r => r.event_id);
      if (eventIds.length > 0) {
        whereClause.id = { [Op.in]: eventIds };
      } else {
        return res.json({ success: true, events: [] });
      }
    }

    let registeredEventIds = [];
    try {
      const registrations = await EventRegistration.findAll({
        where: { member_id: member.id },
        attributes: ['event_id']
      });
      registeredEventIds = registrations.map(r => r.event_id);
      console.log('📋 Registered event IDs:', registeredEventIds);
    } catch (err) {
      console.log('⚠️ EventRegistration table issue:', err.message);
    }

    const events = await Event.findAll({
      where: whereClause,
      order: [['start_date', 'ASC']]
    });

    console.log(`✅ Found ${events.length} events`);

    const eventsWithRegistration = events.map(event => ({
      ...event.toJSON(),
      isRegistered: registeredEventIds.includes(event.id),
      registrationStatus: registeredEventIds.includes(event.id) ? 'registered' : 'available'
    }));

    res.json({ 
      success: true, 
      events: eventsWithRegistration 
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

exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`📅 Fetching event ${id} for user ${userId}`);

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const event = await Event.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const registration = await EventRegistration.findOne({
      where: {
        event_id: id,
        member_id: member.id
      }
    });

    const registeredCount = await EventRegistration.count({
      where: {
        event_id: id,
        status: ['approved', 'confirmed', 'pending']
      }
    });

    const eventData = {
      ...event.toJSON(),
      isRegistered: !!registration,
      registrationStatus: registration?.status || 'not_registered',
      registrationDetails: registration || null,
      registeredCount: registeredCount
    };

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      event: eventData
    });
  } catch (error) {
    console.error('❌ Get event by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get event',
      error: error.message
    });
  }
};

exports.getUpcomingEvents = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const userId = req.user.id;
    const { limit = 10 } = req.query;

    console.log('📅 Fetching upcoming events for user:', userId);

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member profile not found' 
      });
    }

    const events = await Event.findAll({
      where: {
        start_date: { [Op.gte]: new Date() },
        status: ['published', 'upcoming']
      },
      order: [['start_date', 'ASC']],
      limit: parseInt(limit)
    });

    let registeredEventIds = [];
    try {
      const registrations = await EventRegistration.findAll({
        where: { member_id: member.id },
        attributes: ['event_id']
      });
      registeredEventIds = registrations.map(r => r.event_id);
    } catch (err) {
      console.log('⚠️ EventRegistration table issue:', err.message);
    }

    const eventsWithRegistration = events.map(event => ({
      ...event.toJSON(),
      isRegistered: registeredEventIds.includes(event.id)
    }));

    console.log(`✅ Found ${eventsWithRegistration.length} upcoming events`);

    res.json({ 
      success: true, 
      events: eventsWithRegistration 
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

exports.registerForEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const existingRegistration = await EventRegistration.findOne({
      where: { event_id: id, member_id: member.id }
    });
    if (existingRegistration) {
      return res.status(400).json({ success: false, message: 'Already registered for this event' });
    }

    const registration = await EventRegistration.create({
      event_id: id,
      member_id: member.id,
      status: 'pending',
      registration_date: new Date()
    });

    res.json({ success: true, message: 'Registration submitted successfully', registration });
  } catch (error) {
    console.error('❌ Register for event error:', error);
    res.status(500).json({ success: false, message: 'Failed to register for event', error: error.message });
  }
};

exports.cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const registration = await EventRegistration.findOne({
      where: { event_id: id, member_id: member.id }
    });
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    await registration.update({ status: 'cancelled' });
    res.json({ success: true, message: 'Registration cancelled successfully' });
  } catch (error) {
    console.error('❌ Cancel registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel registration', error: error.message });
  }
};

// ============================================
// ✅ COURSE ROUTES
// ============================================

exports.getCourses = async (req, res) => {
  try {
    console.log('📚 Fetching courses...');

    const { filter = 'all' } = req.query;
    const userId = req.user.id;

    let whereClause = { status: 'published' };

    const courses = await Course.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    console.log(`✅ Found ${courses.length} courses`);

    const member = await Member.findOne({ where: { user_id: userId } });
    let enrolledCourseIds = [];
    if (member) {
      try {
        const enrollments = await CourseEnrollment.findAll({
          where: {
            member_id: member.id,
            status: ['approved', 'active', 'completed']
          },
          attributes: ['course_id']
        });
        enrolledCourseIds = enrollments.map(e => e.course_id);
      } catch (err) {
        console.log('⚠️ CourseEnrollment table issue:', err.message);
      }
    }

    const coursesWithEnrollment = courses.map(course => {
      const plainCourse = course.toJSON ? course.toJSON() : course.get({ plain: true });
      return {
        ...plainCourse,
        isEnrolled: enrolledCourseIds.includes(course.id),
        enrolledCount: 0
      };
    });

    res.json({
      success: true,
      courses: coursesWithEnrollment
    });
  } catch (error) {
    console.error('❌ Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get courses',
      error: error.message,
      courses: []
    });
  }
};

exports.getAvailableCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    let enrolledCourseIds = [];
    try {
      const enrollments = await CourseEnrollment.findAll({
        where: { user_id: userId, status: 'approved' },
        attributes: ['course_id']
      });
      enrolledCourseIds = enrollments.map(e => e.course_id);
    } catch (err) {
      console.log('⚠️ CourseEnrollment table issue:', err.message);
    }

    const courses = await Course.findAll({
      where: {
        id: { [Op.notIn]: enrolledCourseIds },
        status: 'published',
        start_date: { [Op.gte]: new Date() }
      },
      order: [['start_date', 'ASC']],
      limit: parseInt(limit)
    });

    res.json({ success: true, courses });
  } catch (error) {
    console.error('❌ Get available courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to get available courses', error: error.message, courses: [] });
  }
};

exports.enrollInCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found. Please complete your profile first.'
      });
    }

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (course.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'This course is not available for enrollment'
      });
    }

    const existingEnrollment = await CourseEnrollment.findOne({
      where: { 
        course_id: id, 
        member_id: member.id
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course'
      });
    }

    if (course.max_students) {
      const enrolledCount = await CourseEnrollment.count({
        where: { 
          course_id: id, 
          status: ['approved', 'completed'] 
        }
      });
      
      if (enrolledCount >= course.max_students) {
        return res.status(400).json({
          success: false,
          message: 'This course has reached maximum capacity'
        });
      }
    }

    const enrollment = await CourseEnrollment.create({
      course_id: id,
      member_id: member.id,
      status: 'approved',
      enrolled_at: new Date(),
      progress: 0,
      last_accessed: new Date()
    });

    const updatedCourse = await Course.findByPk(id);
    const enrollmentCount = await CourseEnrollment.count({
      where: { 
        course_id: id, 
        status: ['approved', 'completed'] 
      }
    });

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in course!',
      enrollment,
      course: {
        ...updatedCourse.toJSON(),
        enrolledCount: enrollmentCount
      }
    });
  } catch (error) {
    console.error('❌ Enroll in course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll in course',
      error: error.message
    });
  }
};

// ============================================
// ✅ COURSE ENROLLMENT METHODS
// ============================================

exports.getCourseEnrollments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    console.log(`📚 Fetching enrollments for course ${courseId}`);

    const user = await User.findByPk(userId);
    const isAdmin = user?.role === 'national_commissioner' || user?.role === 'super_admin';

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    let whereClause = { course_id: courseId };
    if (!isAdmin) {
      whereClause.member_id = member.id;
    }

    const enrollments = await CourseEnrollment.findAll({
      where: whereClause,
      include: [
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
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'description', 'level']
        }
      ],
      order: [['enrolled_at', 'DESC']]
    });

    const formattedEnrollments = enrollments.map(enrollment => ({
      id: enrollment.id,
      memberId: enrollment.member_id,
      fullName: enrollment.member?.user?.full_name || 'N/A',
      name: enrollment.member?.user?.full_name || 'N/A',
      email: enrollment.member?.user?.email || 'N/A',
      sin: enrollment.member?.sin || 'N/A',
      district: enrollment.member?.district || 'N/A',
      progress: enrollment.progress || 0,
      status: enrollment.status || 'active',
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at,
      lastAccessedAt: enrollment.last_accessed_at,
      courseTitle: enrollment.course?.title || 'N/A'
    }));

    res.json({
      success: true,
      enrollments: formattedEnrollments,
      count: formattedEnrollments.length,
      isAdmin: isAdmin
    });

  } catch (error) {
    console.error('❌ Get course enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get course enrollments',
      error: error.message
    });
  }
};

exports.getCourseStatistics = async (req, res) => {
  try {
    const { courseId } = req.params;

    console.log(`📊 Fetching statistics for course ${courseId}`);

    const enrollments = await CourseEnrollment.findAll({
      where: { course_id: courseId }
    });

    const totalEnrolled = enrollments.length;
    const completed = enrollments.filter(e => e.status === 'completed').length;
    const inProgress = enrollments.filter(e => e.status === 'active' && (e.progress || 0) < 100).length;
    const dropped = enrollments.filter(e => e.status === 'dropped').length;
    const pending = enrollments.filter(e => e.status === 'pending').length;
    const avgProgress = totalEnrolled > 0
      ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / totalEnrolled)
      : 0;

    res.json({
      success: true,
      statistics: {
        totalEnrolled,
        completed,
        inProgress,
        dropped,
        pending,
        avgProgress,
        completionRate: totalEnrolled > 0 ? Math.round((completed / totalEnrolled) * 100) : 0
      }
    });

  } catch (error) {
    console.error('❌ Get course statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get course statistics',
      error: error.message
    });
  }
};

exports.getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const enrollments = await CourseEnrollment.findAll({
      where: { member_id: member.id },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'description', 'level', 'category', 'duration', 'status']
        }
      ],
      order: [['enrolled_at', 'DESC']]
    });

    const formattedEnrollments = enrollments.map(enrollment => ({
      id: enrollment.id,
      courseId: enrollment.course_id,
      courseTitle: enrollment.course?.title || 'N/A',
      courseLevel: enrollment.course?.level || 'N/A',
      progress: enrollment.progress || 0,
      status: enrollment.status || 'active',
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at,
      lastAccessedAt: enrollment.last_accessed_at
    }));

    res.json({
      success: true,
      enrollments: formattedEnrollments,
      count: formattedEnrollments.length
    });

  } catch (error) {
    console.error('❌ Get my enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get your enrollments',
      error: error.message
    });
  }
};

exports.updateEnrollmentProgress = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { progress, status } = req.body;
    const userId = req.user.id;

    const enrollment = await CourseEnrollment.findByPk(enrollmentId);
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member || enrollment.member_id !== member.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this enrollment'
      });
    }

    const updateData = { last_accessed_at: new Date() };
    if (progress !== undefined) {
      updateData.progress = Math.min(Math.max(progress, 0), 100);
      if (updateData.progress === 100 && enrollment.status !== 'completed') {
        updateData.status = 'completed';
        updateData.completed_at = new Date();
      }
    }
    if (status) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completed_at = new Date();
        updateData.progress = 100;
      }
    }

    await enrollment.update(updateData);

    res.json({
      success: true,
      message: 'Enrollment updated successfully',
      enrollment
    });

  } catch (error) {
    console.error('❌ Update enrollment progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update enrollment progress',
      error: error.message
    });
  }
};

// ============================================
// ✅ IDEA ROUTES
// ============================================

exports.getIdeas = async (req, res) => {
  try {
    const userId = req.user.id;
    let ideas = [];
    try {
      ideas = await Idea.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']]
      });
    } catch (err) {
      console.log('⚠️ Ideas table issue:', err.message);
    }
    res.json({ success: true, ideas: Array.isArray(ideas) ? ideas : [] });
  } catch (error) {
    console.error('❌ Get ideas error:', error);
    res.status(500).json({ success: false, message: 'Failed to get ideas', error: error.message, ideas: [] });
  }
};

exports.createIdea = async (req, res) => {
  try {
    const { title, description, category, recipient } = req.body;
    const userId = req.user.id;

    console.log('📝 Create Idea - Request body:', req.body);

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

    const idea = await Idea.create({
      title: title.trim(),
      description: description.trim(),
      category: category || 'general',
      recipient: recipient || 'unit-leader',
      user_id: userId,
      status: 'pending'
    });

    console.log('✅ Idea created:', idea.id);

    res.status(201).json({
      success: true,
      message: 'Idea created successfully',
      idea
    });
  } catch (error) {
    console.error('❌ Create idea error:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create idea',
      error: error.message
    });
  }
};

exports.updateIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category } = req.body;
    const userId = req.user.id;
    const idea = await Idea.findOne({ where: { id, user_id: userId } });
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found' });
    }
    await idea.update({ title, description, category });
    res.json({ success: true, message: 'Idea updated successfully', idea });
  } catch (error) {
    console.error('❌ Update idea error:', error);
    res.status(500).json({ success: false, message: 'Failed to update idea', error: error.message });
  }
};

exports.deleteIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const idea = await Idea.findOne({ where: { id, user_id: userId } });
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found' });
    }
    await idea.destroy();
    res.json({ success: true, message: 'Idea deleted successfully' });
  } catch (error) {
    console.error('❌ Delete idea error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete idea', error: error.message });
  }
};

// ============================================
// ✅ PROJECT ROUTES
// ============================================

exports.createProject = async (req, res) => {
  try {
    const { title, description, category, objectives, timeline, budget } = req.body;
    const userId = req.user.id;

    console.log('📝 Creating project for user:', userId);
    console.log('📝 Request body:', req.body);
    console.log('📝 File:', req.file);

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Project title is required'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Project description is required'
      });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Project category is required'
      });
    }

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found. Please complete your profile first.'
      });
    }

    let documentUrl = null;
    if (req.file) {
      documentUrl = `/uploads/projects/${req.file.filename}`;
      console.log('📎 Document uploaded:', documentUrl);
    }

    const projectData = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      objectives: objectives || '',
      timeline: timeline || '',
      budget: budget ? parseFloat(budget) : 0,
      document_url: documentUrl,
      submitted_by: member.id,
      status: 'pending'
    };

    console.log('📝 Project data to save:', projectData);

    const project = await Project.create(projectData);

    console.log('✅ Project created:', project.id);

    res.status(201).json({
      success: true,
      message: 'Project submitted successfully!',
      project: project
    });

  } catch (error) {
    console.error('❌ Create project error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit project',
      error: error.message
    });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📊 Fetching projects for user:', userId);

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      console.log('❌ No member found for user:', userId);
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }
    console.log('✅ Member found, ID:', member.id);

    const projects = await Project.findAll({
      where: {
        submitted_by: member.id
      },
      order: [['created_at', 'DESC']]
    });

    console.log(`✅ Found ${projects.length} projects for member ${member.id}`);

    res.json({
      success: true,
      projects: projects
    });
  } catch (error) {
    console.error('❌ Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get projects',
      error: error.message
    });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await Project.findOne({
      where: {
        id: id,
        [Op.or]: [
          { created_by: userId },
          { submitted_by: userId }
        ]
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      project: project
    });
  } catch (error) {
    console.error('❌ Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project',
      error: error.message
    });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, objectives, timeline, budget } = req.body;
    const userId = req.user.id;

    const project = await Project.findOne({
      where: {
        id: id,
        [Op.or]: [
          { created_by: userId },
          { submitted_by: userId }
        ]
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.status !== 'pending' && project.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: `Cannot update project in ${project.status} status`
      });
    }

    await project.update({
      title: title || project.title,
      description: description || project.description,
      category: category || project.category,
      objectives: objectives || project.objectives,
      timeline: timeline || project.timeline,
      budget: budget ? parseFloat(budget) : project.budget
    });

    res.json({
      success: true,
      message: 'Project updated successfully',
      project: project
    });
  } catch (error) {
    console.error('❌ Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update project',
      error: error.message
    });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await Project.findOne({
      where: {
        id: id,
        [Op.or]: [
          { created_by: userId },
          { submitted_by: userId }
        ]
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.status === 'approved' || project.status === 'in_progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete project in ${project.status} status`
      });
    }

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

// ============================================
// ✅ REPORT ROUTES
// ============================================

exports.submitReport = async (req, res) => {
  try {
    const { title, description, content } = req.body;
    const userId = req.user.id;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }
    const report = await Report.create({
      title,
      description: description || '',
      content,
      user_id: userId,
      status: 'pending'
    });
    res.status(201).json({ success: true, message: 'Report submitted successfully', report });
  } catch (error) {
    console.error('❌ Submit report error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit report', error: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const userId = req.user.id;
    const reports = await Report.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, reports });
  } catch (error) {
    console.error('❌ Get reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to get reports', error: error.message, reports: [] });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const report = await Report.findOne({ where: { id, user_id: userId } });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true, report });
  } catch (error) {
    console.error('❌ Get report error:', error);
    res.status(500).json({ success: false, message: 'Failed to get report', error: error.message });
  }
};

// ============================================
// ✅ NOTIFICATION ROUTES
// ============================================

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { filter = 'all', limit = 50, offset = 0 } = req.query;

    console.log('📬 Fetching notifications for user:', userId);

    let whereClause = { user_id: userId };
    if (filter === 'unread') {
      whereClause.read = false;
    }

    const notifications = await Notification.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const unreadCount = await Notification.count({
      where: { user_id: userId, read: false }
    });

    const totalCount = await Notification.count({
      where: { user_id: userId }
    });

    console.log(`✅ Found ${notifications.length} notifications`);

    const formattedNotifications = notifications.map(n => ({
      id: n.id,
      user_id: n.user_id,
      title: n.title,
      message: n.message,
      type: n.type || 'info',
      link: n.link || null,
      read: n.read || false,
      read_at: n.read_at || null,
      sent_email: n.sent_email || false,
      sent_sms: n.sent_sms || false,
      priority: n.priority || 'normal',
      created_at: n.created_at,
      updated_at: n.updated_at
    }));

    res.json({
      success: true,
      notifications: formattedNotifications,
      unreadCount: unreadCount || 0,
      pagination: {
        total: totalCount || 0,
        unread: unreadCount || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
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
    const userId = req.user.id;
    const notification = await Notification.findOne({ where: { id, user_id: userId } });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    await notification.update({ read: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('❌ Mark notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read', error: error.message });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.update(
      { read: true },
      { where: { user_id: userId, read: false } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('❌ Mark all notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read', error: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const notification = await Notification.findOne({ where: { id, user_id: userId } });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    await notification.destroy();
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification', error: error.message });
  }
};

// ============================================
// ✅ GET ANNOUNCEMENTS - FROM ANNOUNCEMENTS TABLE
// ============================================

exports.getAnnouncements = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📢 Scout fetching announcements for user: ${userId} (${userRole})`);

    const user = await User.findByPk(userId, {
      include: [{ model: Member, as: 'member' }]
    });

    const userDistrict = user?.member?.district || null;
    console.log(`👤 User district: ${userDistrict || 'No district'}`);

    let whereClause = { 
      status: 'published'
    };

    if (userDistrict) {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { district: 'all' },
          { district: userDistrict },
          { district: null }
        ]
      };
    } else {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { district: 'all' },
          { district: null }
        ]
      };
    }

    console.log(`📊 Where clause: ${JSON.stringify(whereClause)}`);

    const announcements = await Announcement.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      attributes: [
        'id',
        'title',
        'content',
        'announcement_type',
        'district',
        'audience',
        'send_email',
        'status',
        'author_id',
        'signature',
        'schedule_date',
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

    console.log(`✅ Found ${announcements.length} announcements for scout`);

    const formattedAnnouncements = announcements.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      message: item.content,
      announcement_type: item.announcement_type,
      type: item.announcement_type,
      district: item.district,
      audience: item.audience || ['all'],
      send_email: item.send_email,
      status: item.status,
      author_id: item.author_id,
      signature: item.signature,
      schedule_date: item.schedule_date,
      published_date: item.published_date,
      created_at: item.created_at,
      updated_at: item.updated_at,
      author: item.author || { full_name: 'Commissioner' },
      is_read: false,
      read: false
    }));

    res.json({
      success: true,
      announcements: formattedAnnouncements
    });

  } catch (error) {
    console.error('❌ Get scout announcements error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      announcements: []
    });
  }
};

// ============================================
// ✅ DASHBOARD ROUTES
// ============================================

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    let upcomingEvents = [];
    let stats = {
      upcomingEvents: 0,
      enrolledCourses: 0,
      unreadNotifications: 0
    };

    try {
      upcomingEvents = await EventRegistration.findAll({
        where: { member_id: member.id },
        include: [{
          model: Event,
          as: 'event',
          where: { start_date: { [Op.gte]: new Date() } },
          required: true
        }],
        order: [[{ model: Event, as: 'event' }, 'start_date', 'ASC']],
        limit: 5
      });

      stats.upcomingEvents = await EventRegistration.count({
        where: { member_id: member.id },
        include: [{
          model: Event,
          as: 'event',
          where: { start_date: { [Op.gte]: new Date() } },
          required: true
        }]
      });
    } catch (err) {
      console.log('⚠️ EventRegistration issue:', err.message);
    }

    let enrolledCourses = [];
    try {
      enrolledCourses = await CourseEnrollment.findAll({
        where: { user_id: userId, status: 'approved' },
        include: [{ model: Course, as: 'course' }],
        limit: 5
      });

      stats.enrolledCourses = await CourseEnrollment.count({
        where: { user_id: userId, status: 'approved' }
      });
    } catch (err) {
      console.log('⚠️ CourseEnrollment issue:', err.message);
    }

    try {
      stats.unreadNotifications = await Notification.count({
        where: { user_id: userId, read: false }
      });
    } catch (err) {
      console.log('⚠️ Notification issue:', err.message);
    }

    res.json({
      success: true,
      dashboard: {
        stats,
        upcomingEvents: upcomingEvents.map(r => r.event),
        enrolledCourses: enrolledCourses.map(e => e.course)
      }
    });
  } catch (error) {
    console.error('❌ Get dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get dashboard data', error: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const userId = req.user.id;
    console.log(`🔍 Getting stats for user ${userId}`);

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      console.log('❌ No member found for user:', userId);
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }
    console.log('✅ Member found, ID:', member.id);

    const upcomingEvents = await EventRegistration.count({
      where: {
        member_id: member.id,
        status: ['approved', 'pending', 'confirmed']
      },
      include: [{
        model: Event,
        as: 'event',
        where: {
          start_date: { [Op.gte]: new Date() },
          status: ['published', 'upcoming']
        },
        required: true
      }]
    });
    console.log(`📅 Upcoming events: ${upcomingEvents}`);

    const enrolledCourses = await CourseEnrollment.count({
      where: {
        member_id: member.id,
        status: ['approved', 'active', 'completed']
      }
    });
    console.log(`📚 Enrolled courses: ${enrolledCourses}`);

    const unreadNotifications = await Notification.count({
      where: {
        user_id: userId,
        read: false
      }
    });
    console.log(`📬 Unread notifications: ${unreadNotifications}`);

    const totalIdeas = await Idea.count({
      where: { user_id: userId }
    });
    console.log(`💡 Total ideas: ${totalIdeas}`);

    const totalProjects = await Project.count({
      where: {
        [Op.or]: [
          { created_by: userId },
          { submitted_by: member.id }
        ]
      }
    });
    console.log(`📊 Total projects: ${totalProjects}`);

    const totalReports = await Report.count({
      where: { user_id: userId }
    });
    console.log(`📄 Total reports: ${totalReports}`);

    const availableCourses = await Course.count({
      where: {
        status: 'published'
      }
    });
    console.log(`📚 Available courses: ${availableCourses}`);

    const stats = {
      upcomingEvents: upcomingEvents || 0,
      enrolledCourses: enrolledCourses || 0,
      unreadNotifications: unreadNotifications || 0,
      totalIdeas: totalIdeas || 0,
      totalProjects: totalProjects || 0,
      totalReports: totalReports || 0,
      availableCourses: availableCourses || 0
    };

    console.log('✅ Final stats:', stats);

    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
};

// ============================================
// ✅ RECENT ACTIVITIES
// ============================================

exports.getRecentActivities = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📊 Fetching recent activities for user:', userId);

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      console.log('⚠️ No member found for user:', userId);
      return res.json({ success: true, activities: [] });
    }

    let activities = [];
    try {
      const registrations = await EventRegistration.findAll({
        where: { member_id: member.id },
        limit: 10,
        order: [['created_at', 'DESC']],
        include: [{ model: Event, as: 'event' }]
      });

      activities = registrations.map(r => ({
        id: r.id,
        title: r.event?.title || 'Event Registration',
        status: r.status || 'pending',
        date: r.created_at,
        eventId: r.event?.id || null
      }));

      console.log(`✅ Found ${activities.length} activities`);
    } catch (err) {
      console.log('⚠️ EventRegistration issue:', err.message);
    }

    res.json({ success: true, activities });
  } catch (error) {
    console.error('❌ Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activities',
      error: error.message,
      activities: []
    });
  }
};

// ============================================
// ✅ SCOUT ATTENDANCE CONTROLLER METHODS
// ============================================

exports.getAttendanceHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member record not found'
      });
    }

    const registrations = await EventRegistration.findAll({
      where: { member_id: member.id },
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'title', 'start_date', 'end_date', 'location', 'venue', 'status']
        }
      ],
      order: [['event', 'start_date', 'DESC']]
    });

    const attendanceHistory = registrations.map(reg => ({
      id: reg.id,
      eventId: reg.event?.id || null,
      eventName: reg.event?.title || 'Event',
      eventDate: reg.event?.start_date || null,
      endDate: reg.event?.end_date || null,
      location: reg.event?.location || reg.event?.venue || 'TBD',
      status: reg.attendance_status || 'pending',
      attendedAt: reg.attendance_time || null,
      checkedInBy: reg.checked_in_by || 'system',
      registrationStatus: reg.status
    }));

    res.json({
      success: true,
      attendance: attendanceHistory,
      count: attendanceHistory.length
    });
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attendance history',
      error: error.message
    });
  }
};

exports.getRecentAttendance = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member record not found'
      });
    }

    const registrations = await EventRegistration.findAll({
      where: { 
        member_id: member.id,
        attendance_status: ['attended', 'present']
      },
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'title', 'start_date', 'end_date', 'location', 'venue']
        }
      ],
      order: [['attendance_time', 'DESC']],
      limit: 5
    });

    const recentAttendance = registrations.map(reg => ({
      id: reg.id,
      eventId: reg.event?.id || null,
      eventName: reg.event?.title || 'Event',
      eventDate: reg.event?.start_date || null,
      location: reg.event?.location || reg.event?.venue || 'TBD',
      attendedAt: reg.attendance_time || null,
      status: reg.attendance_status
    }));

    res.json({
      success: true,
      attendance: recentAttendance
    });
  } catch (error) {
    console.error('Get recent attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent attendance',
      error: error.message
    });
  }
};

exports.getUpcomingEventsWithAttendance = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member record not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingEvents = await Event.findAll({
      where: {
        start_date: { [Op.gte]: today },
        status: ['published', 'upcoming']
      },
      order: [['start_date', 'ASC']],
      limit: 10
    });

    const registrations = await EventRegistration.findAll({
      where: { member_id: member.id }
    });

    const eventsWithStatus = upcomingEvents.map(event => {
      const registration = registrations.find(r => r.event_id === event.id);
      let attendanceStatus = 'not_registered';
      
      if (registration) {
        attendanceStatus = registration.attendance_status || 'pending';
      }

      return {
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location || event.venue || 'TBD',
        status: event.status,
        attendanceStatus: attendanceStatus,
        isRegistered: !!registration
      };
    });

    res.json({
      success: true,
      events: eventsWithStatus
    });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upcoming events',
      error: error.message
    });
  }
};

// ============================================
// ✅ COURSE TOPICS & PROGRESS METHODS
// ============================================

exports.getCourseTopics = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const isAdmin = req.user.role === 'super_admin' || 
                    req.user.role === 'super-admin' || 
                    req.user.role === 'national_commissioner' ||
                    req.user.role === 'national-commissioner';
    
    if (!isAdmin) {
      const enrollment = await CourseEnrollment.findOne({
        where: { course_id: courseId, member_id: member.id }
      });
      
      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You are not enrolled in this course'
        });
      }
    }

    const topics = await CourseTopic.findAll({
      where: { course_id: courseId },
      include: [
        {
          model: CourseMaterial,
          as: 'materials',
          attributes: ['id', 'title', 'type', 'content', 'url', 'order']
        },
        {
          model: CourseAssessment,
          as: 'assessments',
          attributes: ['id', 'title', 'description', 'type', 'passing_score', 'time_limit', 'questions']
        }
      ],
      order: [['order', 'ASC']]
    });

    res.json({
      success: true,
      topics: topics
    });

  } catch (error) {
    console.error('❌ Get course topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load topics',
      error: error.message
    });
  }
};

exports.getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: { course_id: courseId, member_id: member.id }
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Not enrolled in this course'
      });
    }

    let progress = enrollment.progress || 0;
    
    if (progress === 0) {
      const topics = await CourseTopic.findAll({
        where: { course_id: courseId },
        attributes: ['id']
      });
      progress = enrollment.progress || 0;
    }

    res.json({
      success: true,
      progress: {
        progress: progress,
        status: enrollment.status,
        enrolled_at: enrollment.enrolled_at,
        completed_at: enrollment.completed_at
      }
    });

  } catch (error) {
    console.error('❌ Get course progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load progress',
      error: error.message
    });
  }
};

// ============================================
// ✅ EXPORT ALL METHODS
// ============================================

module.exports = exports;