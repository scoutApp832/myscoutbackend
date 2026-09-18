const { Course, CourseEnrollment, CourseTopic, CourseMaterial, CourseAssessment, CourseAssessmentAttempt, User, Member } = require('../models');
const { Op } = require('sequelize');
const NotificationService = require('../services/notificationService');

// ============================================
// ✅ HELPER FUNCTIONS - Auto Completion
// ============================================

/**
 * Update topic completion status based on assessment progress
 */
async function updateTopicCompletionStatus(memberId, topicId, courseId) {
  try {
    // Get all assessments for this topic
    const assessments = await CourseAssessment.findAll({
      where: { topic_id: topicId }
    });

    // If no assessments, mark topic as completed (no assessment needed)
    if (assessments.length === 0) {
      await CourseTopic.update(
        { is_completed: true },
        { where: { id: topicId } }
      );
      console.log(`✅ Topic ${topicId} marked as completed (no assessments)`);
      return true;
    }

    // Get all assessment IDs
    const assessmentIds = assessments.map(a => a.id);

    // Count how many assessments the member has passed
    const passedCount = await CourseAssessmentAttempt.count({
      where: {
        assessment_id: { [Op.in]: assessmentIds },
        member_id: memberId,
        passed: true
      }
    });

    // If all assessments are passed, mark topic as completed
    const allCompleted = passedCount >= assessments.length;
    
    if (allCompleted) {
      await CourseTopic.update(
        { is_completed: true },
        { where: { id: topicId } }
      );
      console.log(`✅ Topic ${topicId} marked as completed (${passedCount}/${assessments.length} assessments passed)`);
    } else {
      console.log(`📊 Topic ${topicId} not yet completed (${passedCount}/${assessments.length} assessments passed)`);
    }

    return allCompleted;
  } catch (error) {
    console.error('❌ Error updating topic completion:', error);
    return false;
  }
}

/**
 * Update course progress and check for completion
 */
async function updateCourseProgress(memberId, courseId) {
  try {
    // Count total topics in the course
    const totalTopics = await CourseTopic.count({
      where: { course_id: courseId }
    });

    // Count completed topics
    const completedTopics = await CourseTopic.count({
      where: { 
        course_id: courseId,
        is_completed: true
      }
    });

    // Calculate progress percentage
    const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    const isCompleted = progress === 100;

    // Update enrollment
    await CourseEnrollment.update(
      { 
        progress: progress,
        status: isCompleted ? 'completed' : 'active',
        completed_at: isCompleted ? new Date() : null,
        last_accessed: new Date()
      },
      {
        where: { 
          course_id: courseId, 
          member_id: memberId 
        }
      }
    );

    console.log(`📊 Progress updated: ${progress}% for member ${memberId} in course ${courseId}`);

    // If course is completed, send notification
    if (isCompleted) {
      const enrollment = await CourseEnrollment.findOne({
        where: { course_id: courseId, member_id: memberId },
        include: [{ model: Course, as: 'course' }]
      });
      
      if (enrollment) {
        try {
          const user = await User.findByPk(memberId);
          await NotificationService.createForUser(memberId, {
            title: `🎓 Course Completed: ${enrollment.course.title}`,
            message: `Congratulations! You have successfully completed "${enrollment.course.title}". You have earned a certificate for this course.`,
            type: 'achievement',
            priority: 'high',
            link: `/courses/${courseId}/certificate`
          });

          // Notify course creator
          if (enrollment.course && enrollment.course.created_by) {
            await NotificationService.createForUser(enrollment.course.created_by, {
              title: `📊 Student Completed Course`,
              message: `${user?.full_name || 'A student'} has completed "${enrollment.course.title}".`,
              type: 'system',
              priority: 'normal',
              link: `/courses/${courseId}/enrollments`
            });
          }
        } catch (notifErr) {
          console.error('❌ Notification error (non-critical):', notifErr.message);
        }
      }
    }

    return progress;
  } catch (error) {
    console.error('❌ Error updating course progress:', error);
    return 0;
  }
}

// ============================================
// COURSE CRUD OPERATIONS
// ============================================

// Get all courses
exports.getCourses = async (req, res) => {
  try {
    const { category, level, status, search } = req.query;
    const where = {};

    if (category && category !== 'all') where.category = category;
    if (level && level !== 'all') where.level = level;
    if (status && status !== 'all') where.status = status;
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const courses = await Course.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const coursesWithCounts = await Promise.all(courses.map(async (course) => {
      const enrollmentCount = await CourseEnrollment.count({
        where: { course_id: course.id, status: ['active', 'completed'] }
      });
      return {
        ...course.toJSON(),
        enrolledCount: enrollmentCount
      };
    }));

    res.json({
      success: true,
      courses: coursesWithCounts
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get courses',
      error: error.message
    });
  }
};

// Get course by ID
exports.getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { 
          model: CourseTopic, 
          as: 'topics',
          include: [
            { model: CourseMaterial, as: 'materials' },
            { model: CourseAssessment, as: 'assessments' }
          ],
          order: [['order', 'ASC']]
        }
      ]
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const enrollmentCount = await CourseEnrollment.count({
      where: { course_id: id, status: ['active', 'completed'] }
    });

    res.json({
      success: true,
      course: {
        ...course.toJSON(),
        enrolledCount: enrollmentCount
      }
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get course',
      error: error.message
    });
  }
};

// Create course
exports.createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      cover_image,
      category,
      level,
      duration,
      prerequisites,
      status = 'draft'
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    const course = await Course.create({
      title,
      description,
      cover_image: cover_image || '',
      category: category || 'general',
      level: level || 'beginner',
      duration: duration || 0,
      prerequisites: prerequisites || '',
      status,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course',
      error: error.message
    });
  }
};

// Update course
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      cover_image,
      category,
      level,
      duration,
      prerequisites,
      status
    } = req.body;

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const oldStatus = course.status;

    await course.update({
      title: title || course.title,
      description: description || course.description,
      cover_image: cover_image !== undefined ? cover_image : course.cover_image,
      category: category || course.category,
      level: level || course.level,
      duration: duration !== undefined ? duration : course.duration,
      prerequisites: prerequisites !== undefined ? prerequisites : course.prerequisites,
      status: status || course.status
    });

    if (status === 'published' && oldStatus !== 'published') {
      const enrollments = await CourseEnrollment.findAll({
        where: { course_id: id },
        include: [{ model: Member, as: 'member' }]
      });

      for (const enrollment of enrollments) {
        if (enrollment.member && enrollment.member.user_id) {
          try {
            await NotificationService.createForUser(enrollment.member.user_id, {
              title: `📚 Course Published: ${course.title}`,
              message: `The course "${course.title}" has been published. Start learning now!`,
              type: 'course',
              priority: 'normal',
              link: `/courses/${course.id}`
            });
          } catch (notifErr) {
            console.error('❌ Notification error (non-critical):', notifErr.message);
          }
        }
      }
    }

    res.json({
      success: true,
      message: 'Course updated successfully',
      course
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course',
      error: error.message
    });
  }
};

// Delete course
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const activeEnrollments = await CourseEnrollment.count({
      where: { course_id: id, status: ['active', 'in_progress'] }
    });

    if (activeEnrollments > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course with ${activeEnrollments} active enrollments`
      });
    }

    await course.destroy();

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      error: error.message
    });
  }
};

// ============================================
// ENROLLMENT OPERATIONS
// ============================================

// Enroll in course
exports.enrollCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const existingEnrollment = await CourseEnrollment.findOne({
      where: { course_id: id, member_id: member.id }
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course'
      });
    }

    const enrollment = await CourseEnrollment.create({
      course_id: id,
      member_id: member.id,
      status: 'active',
      enrolled_at: new Date(),
      progress: 0,
      last_accessed: new Date()
    });

    const user = await User.findByPk(userId);
    try {
      await NotificationService.createCourseEnrollmentNotifications(course, user);
    } catch (notifErr) {
      console.error('❌ Notification error (non-critical):', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in course',
      enrollment
    });
  } catch (error) {
    console.error('Enroll course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll in course',
      error: error.message
    });
  }
};

// Get enrolled courses
exports.getEnrolledCourses = async (req, res) => {
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
          include: [{ model: User, as: 'creator', attributes: ['id', 'full_name'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      enrollments
    });
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get enrolled courses',
      error: error.message
    });
  }
};

// Get course progress
exports.getCourseProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: { course_id: id, member_id: member.id }
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Not enrolled in this course'
      });
    }

    const totalTopics = await CourseTopic.count({
      where: { course_id: id }
    });

    const completedTopics = await CourseTopic.count({
      where: { 
        course_id: id,
        is_completed: true
      }
    });

    const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    res.json({
      success: true,
      progress: {
        percentage: progress,
        completed: completedTopics,
        total: totalTopics,
        status: enrollment.status
      }
    });
  } catch (error) {
    console.error('Get course progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get course progress',
      error: error.message
    });
  }
};

// Update progress
exports.updateProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { topicId, completed } = req.body;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: { course_id: id, member_id: member.id },
      include: [{ model: Course, as: 'course' }]
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Not enrolled in this course'
      });
    }

    const oldProgress = enrollment.progress || 0;

    if (topicId) {
      const topic = await CourseTopic.findOne({
        where: { id: topicId, course_id: id }
      });

      if (topic) {
        await topic.update({ is_completed: completed || false });
      }
    }

    const totalTopics = await CourseTopic.count({
      where: { course_id: id }
    });

    const completedTopics = await CourseTopic.count({
      where: { 
        course_id: id,
        is_completed: true
      }
    });

    const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    let wasCompleted = false;

    if (progress === 100 && enrollment.status !== 'completed') {
      await enrollment.update({ 
        status: 'completed', 
        completed_at: new Date(),
        progress: progress
      });
      wasCompleted = true;
      
      const user = await User.findByPk(userId);
      try {
        await NotificationService.createForUser(userId, {
          title: `🎓 Course Completed: ${enrollment.course.title}`,
          message: `Congratulations! You have successfully completed "${enrollment.course.title}". You have earned a certificate for this course.`,
          type: 'achievement',
          priority: 'high',
          link: `/courses/${id}/certificate`
        });

        if (enrollment.course.created_by) {
          await NotificationService.createForUser(enrollment.course.created_by, {
            title: `📊 Student Completed Course`,
            message: `${user.full_name} has completed "${enrollment.course.title}".`,
            type: 'system',
            priority: 'normal',
            link: `/courses/${id}/enrollments`
          });
        }
      } catch (notifErr) {
        console.error('❌ Notification error (non-critical):', notifErr.message);
      }
    }

    const progressMilestones = [25, 50, 75];
    if (progress > oldProgress && !wasCompleted) {
      for (const milestone of progressMilestones) {
        if (oldProgress < milestone && progress >= milestone) {
          const user = await User.findByPk(userId);
          try {
            await NotificationService.createForUser(userId, {
              title: `📚 Course Progress: ${milestone}%`,
              message: `You have completed ${milestone}% of "${enrollment.course.title}". Keep going!`,
              type: 'course',
              priority: 'normal',
              link: `/courses/${id}`
            });
          } catch (notifErr) {
            console.error('❌ Notification error (non-critical):', notifErr.message);
          }
          break;
        }
      }
    }

    if (!wasCompleted) {
      await enrollment.update({ 
        progress: progress, 
        last_accessed: new Date() 
      });
    }

    res.json({
      success: true,
      message: wasCompleted ? '🎉 Course completed! Congratulations!' : 'Progress updated successfully',
      progress: {
        percentage: progress,
        completed: completedTopics,
        total: totalTopics,
        completed_at: wasCompleted ? enrollment.completed_at : null
      }
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update progress',
      error: error.message
    });
  }
};

// ============================================
// TOPIC OPERATIONS
// ============================================

// Get course topics
exports.getCourseTopics = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const topics = await CourseTopic.findAll({
      where: { course_id: id },
      include: [
        { model: CourseMaterial, as: 'materials' },
        { model: CourseAssessment, as: 'assessments' }
      ],
      order: [['order', 'ASC']]
    });

    res.json({
      success: true,
      topics
    });
  } catch (error) {
    console.error('Get course topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get topics',
      error: error.message
    });
  }
};

// Create topic
exports.createTopic = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, content, order, type, parentId } = req.body;

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const topic = await CourseTopic.create({
      course_id: courseId,
      title,
      description: description || '',
      content: content || '',
      order: order || 0,
      type: type || 'lesson',
      parent_id: parentId || null
    });

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      topic
    });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create topic',
      error: error.message
    });
  }
};

// Update topic
exports.updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, order, type, parentId } = req.body;

    const topic = await CourseTopic.findByPk(id);
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    await topic.update({
      title: title || topic.title,
      description: description !== undefined ? description : topic.description,
      content: content !== undefined ? content : topic.content,
      order: order !== undefined ? order : topic.order,
      type: type || topic.type,
      parent_id: parentId !== undefined ? parentId : topic.parent_id
    });

    res.json({
      success: true,
      message: 'Topic updated successfully',
      topic
    });
  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update topic',
      error: error.message
    });
  }
};

// Delete topic
exports.deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await CourseTopic.findByPk(id);
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    const materials = await CourseMaterial.count({ where: { topic_id: id } });
    if (materials > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete topic with ${materials} materials`
      });
    }

    await topic.destroy();

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete topic',
      error: error.message
    });
  }
};

// ============================================
// MATERIAL OPERATIONS
// ============================================

// Create material
exports.createMaterial = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { title, description, content, url, type, order } = req.body;

    const topic = await CourseTopic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    const material = await CourseMaterial.create({
      topic_id: topicId,
      title,
      description: description || '',
      content: content || '',
      url: url || '',
      type: type || 'document',
      order: order || 0
    });

    res.status(201).json({
      success: true,
      message: 'Material created successfully',
      material
    });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create material',
      error: error.message
    });
  }
};

// Update material
exports.updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, url, type, order } = req.body;

    const material = await CourseMaterial.findByPk(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    await material.update({
      title: title || material.title,
      description: description !== undefined ? description : material.description,
      content: content !== undefined ? content : material.content,
      url: url !== undefined ? url : material.url,
      type: type || material.type,
      order: order !== undefined ? order : material.order
    });

    res.json({
      success: true,
      message: 'Material updated successfully',
      material
    });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update material',
      error: error.message
    });
  }
};

// Delete material
exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await CourseMaterial.findByPk(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    await material.destroy();

    res.json({
      success: true,
      message: 'Material deleted successfully'
    });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete material',
      error: error.message
    });
  }
};

// ============================================
// ASSESSMENT OPERATIONS - ✅ COMPLETE FIX
// ============================================

// Get assessment info - ✅ FIXED
exports.getAssessmentInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('📊 Getting assessment info:', {
      assessmentId: id,
      userId: userId
    });

    const member = await Member.findOne({ 
      where: { user_id: userId } 
    });
    
    if (!member) {
      console.error('❌ Member not found for user:', userId);
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    console.log('👤 Member found:', {
      memberId: member.id,
      userId: member.user_id
    });

    const assessment = await CourseAssessment.findByPk(id);
    
    const attempts = await CourseAssessmentAttempt.count({
      where: {
        assessment_id: id,
        member_id: member.id
      }
    });

    console.log('📊 Attempts count:', {
      assessmentId: id,
      memberId: member.id,
      attempts: attempts,
      maxAttempts: assessment?.max_attempts || 1
    });

    res.json({
      success: true,
      attempts: attempts
    });
  } catch (error) {
    console.error('❌ Get assessment info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assessment info',
      error: error.message
    });
  }
};

// Create assessment - ✅ FIXED
exports.createAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { 
      topicId,
      title, 
      description, 
      type, 
      questions, 
      passing_score, 
      time_limit, 
      allow_retake,
      max_attempts,
      show_score_immediately,
      order 
    } = req.body;

    console.log('📝 Create assessment request:', {
      courseId,
      topicId: topicId,
      title: title
    });

    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: '❌ topicId is required. Please select a topic for this assessment.',
        missingField: 'topicId'
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: '❌ Title is required for the assessment.',
        missingField: 'title'
      });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: `❌ Course with ID ${courseId} not found`
      });
    }

    const topic = await CourseTopic.findOne({
      where: { 
        id: topicId, 
        course_id: courseId 
      }
    });
    
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: `❌ Topic with ID ${topicId} not found in this course`
      });
    }

    const assessment = await CourseAssessment.create({
      course_id: parseInt(courseId),
      topic_id: parseInt(topicId),
      title: title.trim(),
      description: description || '',
      type: type || 'quiz',
      questions: questions || [],
      passing_score: parseInt(passing_score) || 70,
      time_limit: time_limit || null,
      allow_retake: allow_retake || false,
      max_attempts: parseInt(max_attempts) || 1,
      show_score_immediately: show_score_immediately !== undefined ? show_score_immediately : true,
      order: parseInt(order) || 0
    });

    console.log('✅ Assessment created:', {
      id: assessment.id,
      title: assessment.title,
      topic_id: assessment.topic_id
    });

    res.status(201).json({
      success: true,
      message: '✅ Assessment created successfully',
      assessment: assessment
    });

  } catch (error) {
    console.error('❌ Create assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assessment',
      error: error.message,
      details: error.errors || null
    });
  }
};

// Update assessment
exports.updateAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      type, 
      questions, 
      passing_score, 
      time_limit, 
      allow_retake,
      max_attempts,
      show_score_immediately,
      order 
    } = req.body;

    const assessment = await CourseAssessment.findByPk(id);
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    await assessment.update({
      title: title || assessment.title,
      description: description !== undefined ? description : assessment.description,
      type: type || assessment.type,
      questions: questions || assessment.questions,
      passing_score: passing_score !== undefined ? passing_score : assessment.passing_score,
      time_limit: time_limit !== undefined ? time_limit : assessment.time_limit,
      allow_retake: allow_retake !== undefined ? allow_retake : assessment.allow_retake,
      max_attempts: max_attempts || assessment.max_attempts,
      show_score_immediately: show_score_immediately !== undefined ? show_score_immediately : assessment.show_score_immediately,
      order: order !== undefined ? order : assessment.order
    });

    res.json({
      success: true,
      message: 'Assessment updated successfully',
      assessment
    });
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assessment',
      error: error.message
    });
  }
};

// Delete assessment
exports.deleteAssessment = async (req, res) => {
  try {
    const { id } = req.params;

    const assessment = await CourseAssessment.findByPk(id);
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    const attempts = await CourseAssessmentAttempt.count({
      where: { assessment_id: id }
    });

    if (attempts > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete assessment with ${attempts} attempts`
      });
    }

    await assessment.destroy();

    res.json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete assessment',
      error: error.message
    });
  }
};

// Submit assessment - ✅ COMPLETE FIX with auto-completion and debugging
exports.submitAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const userId = req.user.id;

    console.log('📤 Submitting assessment:', {
      assessmentId: id,
      userId: userId,
      answersCount: answers?.length || 0
    });

    // Get member
    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    // Get assessment
    const assessment = await CourseAssessment.findByPk(id, {
      include: [{ model: Course, as: 'course' }]
    });
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // ✅ DEBUG: Log the full assessment data
    console.log('🔍 ASSESSMENT DATA:', {
      id: assessment.id,
      title: assessment.title,
      max_attempts: assessment.max_attempts,
      allow_retake: assessment.allow_retake,
      passing_score: assessment.passing_score,
      topic_id: assessment.topic_id,
      course_id: assessment.course_id,
      rawData: assessment.dataValues
    });

    // ✅ Count existing attempts
    const existingAttempts = await CourseAssessmentAttempt.count({
      where: {
        assessment_id: id,
        member_id: member.id
      }
    });

    // ✅ Get maxAttempts - with debug
    const maxAttempts = assessment.max_attempts || 1;
    const allowRetake = assessment.allow_retake || false;

    console.log('📊 Existing attempts:', {
      existingAttempts,
      maxAttempts: maxAttempts,
      allowRetake: allowRetake,
      isRetakeAllowed: allowRetake && existingAttempts < maxAttempts
    });

    // ✅ Check retake rules
    if (!allowRetake && existingAttempts >= 1) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this assessment. Retakes are not allowed.'
      });
    }

    if (allowRetake && existingAttempts >= maxAttempts) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum number of attempts (${maxAttempts}).`
      });
    }

    // ✅ Calculate score
    const questions = assessment.questions || [];
    let correctAnswers = 0;
    const gradedAnswers = [];

    questions.forEach((question, index) => {
      const userAnswer = answers && answers[index] !== undefined ? answers[index] : null;
      let isCorrect = false;

      if (question.type === 'multiple-choice') {
        isCorrect = userAnswer === question.correctAnswer;
      } else if (question.type === 'true-false') {
        isCorrect = userAnswer === question.correctAnswer;
      } else if (question.type === 'short-answer') {
        const correctAnswersList = question.correctAnswers || [];
        isCorrect = correctAnswersList.some(a => 
          userAnswer && userAnswer.toLowerCase().includes(a.toLowerCase())
        );
      }

      if (isCorrect) correctAnswers++;

      gradedAnswers.push({
        question: question.question,
        userAnswer: userAnswer,
        isCorrect: isCorrect,
        correctAnswer: question.correctAnswer || question.correctAnswers?.join(', ') || null
      });
    });

    const totalQuestions = questions.length;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const passed = score >= (assessment.passing_score || 70);

    // ✅ Save attempt
    const attempt = await CourseAssessmentAttempt.create({
      assessment_id: id,
      member_id: member.id,
      answers: answers || [],
      score: score,
      passed: passed,
      attempt_number: existingAttempts + 1,
      status: 'submitted',
      completed_at: new Date(),
      started_at: new Date()
    });

    console.log('✅ Attempt saved:', {
      attemptId: attempt.id,
      attemptNumber: attempt.attempt_number,
      score: score,
      passed: passed,
      maxAttempts: maxAttempts,
      remainingAttempts: maxAttempts - (existingAttempts + 1)
    });

    // ✅ AUTO-COMPLETE: Update topic and course progress
    const topicId = assessment.topic_id;
    if (topicId) {
      // Update topic completion status
      await updateTopicCompletionStatus(member.id, topicId, assessment.course_id);
      
      // Update course progress
      await updateCourseProgress(member.id, assessment.course_id);
    }

    // ✅ SAFE NOTIFICATIONS - wrapped in try-catch
    try {
      const user = await User.findByPk(userId);
      if (user && NotificationService && typeof NotificationService.createForUser === 'function') {
        await NotificationService.createForUser(userId, {
          title: `📝 Assessment Submitted: ${assessment.title}`,
          message: `You have submitted "${assessment.title}". Score: ${score}%${passed ? ' ✅ Passed!' : ' ❌ Not passed'}`,
          type: passed ? 'success' : 'warning',
          priority: passed ? 'normal' : 'high',
          link: `/courses/${assessment.course_id}/assessments/${id}/results`
        });

        if (passed) {
          await NotificationService.createForUser(userId, {
            title: `🏆 Assessment Passed: ${assessment.title}`,
            message: `Congratulations! You passed "${assessment.title}" with ${score}%!`,
            type: 'achievement',
            priority: 'high',
            link: `/courses/${assessment.course_id}`
          });

          if (assessment.course && assessment.course.created_by) {
            await NotificationService.createForUser(assessment.course.created_by, {
              title: `📊 Assessment Passed`,
              message: `${user.full_name} passed "${assessment.title}" with ${score}%.`,
              type: 'system',
              priority: 'normal',
              link: `/courses/${assessment.course_id}/enrollments`
            });
          }
        }
      }
    } catch (notifError) {
      console.error('❌ Notification error (non-critical):', notifError.message);
      // Don't throw - assessment submission is already successful
    }

    res.status(201).json({
      success: true,
      message: 'Assessment submitted successfully',
      attempt: {
        id: attempt.id,
        score: score,
        passed: passed,
        correctAnswers: correctAnswers,
        totalQuestions: totalQuestions,
        gradedAnswers: gradedAnswers,
        attemptNumber: existingAttempts + 1,
        maxAttempts: maxAttempts,
        allowRetake: allowRetake,
        remainingAttempts: maxAttempts - (existingAttempts + 1),
        status: attempt.status,
        completed_at: attempt.completed_at
      }
    });

  } catch (error) {
    console.error('❌ Submit assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit assessment',
      error: error.message
    });
  }
};

// Get assessment results - ✅ FIXED
exports.getAssessmentResults = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const attempts = await CourseAssessmentAttempt.findAll({
      where: { 
        assessment_id: id, 
        member_id: member.id 
      },
      order: [['created_at', 'DESC']]
    });

    console.log('📊 Results found:', {
      assessmentId: id,
      memberId: member.id,
      attemptsCount: attempts.length
    });

    res.json({
      success: true,
      attempts: attempts
    });
  } catch (error) {
    console.error('❌ Get assessment results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assessment results',
      error: error.message
    });
  }
};

// ============================================
// STATS OPERATIONS
// ============================================

// Get course stats
exports.getCourseStats = async (req, res) => {
  try {
    const totalCourses = await Course.count();
    const publishedCourses = await Course.count({ where: { status: 'published' } });
    const draftCourses = await Course.count({ where: { status: 'draft' } });
    const archivedCourses = await Course.count({ where: { status: 'archived' } });

    const totalEnrollments = await CourseEnrollment.count();
    const completedEnrollments = await CourseEnrollment.count({ where: { status: 'completed' } });
    const activeEnrollments = await CourseEnrollment.count({ where: { status: 'active' } });

    res.json({
      success: true,
      stats: {
        totalCourses,
        publishedCourses,
        draftCourses,
        archivedCourses,
        totalEnrollments,
        completedEnrollments,
        activeEnrollments
      }
    });
  } catch (error) {
    console.error('Get course stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get course stats',
      error: error.message
    });
  }
};

// ============================================
// Get course certificate
// ============================================
exports.getCourseCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await Member.findOne({ where: { user_id: userId } });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: { 
        course_id: id, 
        member_id: member.id,
        status: 'completed'
      },
      include: [{ model: Course, as: 'course' }]
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Course not completed or not enrolled'
      });
    }

    const user = await User.findByPk(userId);
    const certificateData = {
      user: user,
      course: enrollment.course,
      completed_at: enrollment.completed_at,
      certificate_id: `CERT-${enrollment.id}-${Date.now()}`
    };

    res.json({
      success: true,
      certificate: certificateData
    });

  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get certificate',
      error: error.message
    });
  }
};