// backend/src/models/index.js
const { sequelize } = require('../config/database');

if (!sequelize) {
  throw new Error('Sequelize instance is not defined.');
}

// ===============================
// IMPORT MODELS
// ===============================
const User = require('./User');
const Member = require('./Member');
const Notification = require('./Notification');
const Event = require('./Event');
const EventRegistration = require('./EventRegistration');
const Course = require('./Course');
const CourseEnrollment = require('./CourseEnrollment');
const CourseTopic = require('./CourseTopic');
const CourseMaterial = require('./CourseMaterial');
const CourseAssessment = require('./CourseAssessment');
const CourseAssessmentAttempt = require('./CourseAssessmentAttempt');
const Project = require('./Project');
const Report = require('./Report');
const Announcement = require('./Announcement');
const Idea = require('./Idea');
const Donation = require('./Donation');
const AuditLog = require('./AuditLog');
const District = require('./District');
const Unit = require('./Unit');

// ✅ PRODUCT MODEL
const Product = require('./Product')(sequelize);
const ContactSubmission = require('./ContactSubmission')(sequelize);

// ✅ NEWS MODEL
const News = require('./News')(sequelize);

// ✅ CHAT MODEL - Pass sequelize instance
const ChatMessage = require('./ChatMessage')(sequelize);

// ✅ PAYMENT MODELS
const {
  PaymentService,
  PaymentMethod,
  Payment,
  PaymentHistory,
  PaymentReceipt,
  PaymentNotification
} = require('./paymentModels');

console.log('📦 Models imported:');
console.log('  - User:', typeof User);
console.log('  - Member:', typeof Member);
console.log('  - Project:', typeof Project);
console.log('  - Report:', typeof Report);
console.log('  - Donation:', typeof Donation);
console.log('  - Event:', typeof Event);
console.log('  - Idea:', typeof Idea);
console.log('  - District:', typeof District);
console.log('  - Product:', typeof Product);
console.log('  - ContactSubmission:', typeof ContactSubmission);
console.log('  - News:', typeof News);
console.log('  - CourseTopic:', typeof CourseTopic);
console.log('  - CourseMaterial:', typeof CourseMaterial);
console.log('  - CourseAssessment:', typeof CourseAssessment);
console.log('  - CourseAssessmentAttempt:', typeof CourseAssessmentAttempt);
console.log('  - ChatMessage:', typeof ChatMessage);
console.log('  - PaymentService:', typeof PaymentService);
console.log('  - PaymentMethod:', typeof PaymentMethod);
console.log('  - Payment:', typeof Payment);
console.log('  - PaymentHistory:', typeof PaymentHistory);
console.log('  - PaymentReceipt:', typeof PaymentReceipt);
console.log('  - PaymentNotification:', typeof PaymentNotification);

// ✅ Verify ChatMessage has methods
if (ChatMessage) {
  console.log('🔍 ChatMessage methods:', Object.keys(ChatMessage).filter(k => typeof ChatMessage[k] === 'function'));
} else {
  console.error('❌ ChatMessage model is undefined!');
}

// ===============================
// ASSOCIATIONS
// ===============================
const setupAssociations = () => {

  // ============================================
  // ✅ USER ↔ MEMBER
  // ============================================
  try {
    User.hasOne(Member, {
      foreignKey: 'user_id',
      as: 'member',
      onDelete: 'CASCADE'
    });

    Member.belongsTo(User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    console.log('✅ User ↔ Member association created');
  } catch (error) {
    console.error('❌ Error creating User ↔ Member association:', error.message);
  }

  // ============================================
  // ✅ USER ↔ NOTIFICATION
  // ============================================
  try {
    User.hasMany(Notification, {
      foreignKey: 'user_id',
      as: 'notifications',
      onDelete: 'CASCADE'
    });

    Notification.belongsTo(User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    console.log('✅ User ↔ Notification association created');
  } catch (error) {
    console.error('❌ Error creating User ↔ Notification association:', error.message);
  }

  // ============================================
  // ✅ USER ↔ EVENT (CREATOR)
  // ============================================
  try {
    User.hasMany(Event, {
      foreignKey: 'created_by',
      as: 'createdEvents'
    });

    Event.belongsTo(User, {
      foreignKey: 'created_by',
      as: 'creator'
    });
    console.log('✅ User ↔ Event association created');
  } catch (error) {
    console.error('❌ Error creating User ↔ Event association:', error.message);
  }

  // ============================================
  // ✅ EVENT ↔ REGISTRATION
  // ============================================
  try {
    Event.hasMany(EventRegistration, {
      foreignKey: 'event_id',
      as: 'registrations',
      onDelete: 'CASCADE'
    });

    EventRegistration.belongsTo(Event, {
      foreignKey: 'event_id',
      as: 'event'
    });
    console.log('✅ Event ↔ Registration association created');
  } catch (error) {
    console.error('❌ Error creating Event ↔ Registration association:', error.message);
  }

  // ============================================
  // ✅ MEMBER ↔ EVENT REGISTRATION
  // ============================================
  try {
    Member.hasMany(EventRegistration, {
      foreignKey: 'member_id',
      as: 'registrations',
      onDelete: 'CASCADE'
    });

    EventRegistration.belongsTo(Member, {
      foreignKey: 'member_id',
      as: 'member'
    });
    console.log('✅ Member ↔ EventRegistration association created');
  } catch (error) {
    console.error('❌ Error creating Member ↔ EventRegistration association:', error.message);
  }

  // ============================================
  // ✅ DISTRICT ↔ EVENT
  // ============================================
  try {
    District.hasMany(Event, {
      foreignKey: 'district_id',
      as: 'events',
      onDelete: 'SET NULL'
    });

    Event.belongsTo(District, {
      foreignKey: 'district_id',
      as: 'district'
    });
    console.log('✅ District ↔ Event association created');
  } catch (error) {
    console.error('❌ Error creating District ↔ Event association:', error.message);
  }

  // ============================================
  // ✅ DISTRICT ↔ MEMBER
  // ============================================
  try {
    District.hasMany(Member, {
      foreignKey: 'district_id',
      as: 'members',
      onDelete: 'SET NULL'
    });

    Member.belongsTo(District, {
      foreignKey: 'district_id',
      as: 'districtInfo'
    });
    console.log('✅ District ↔ Member association created');
  } catch (error) {
    console.error('❌ Error creating District ↔ Member association:', error.message);
  }

  // ============================================
  // ✅ DISTRICT ↔ USER
  // ============================================
  try {
    District.hasMany(User, {
      foreignKey: 'district_id',
      as: 'users',
      onDelete: 'SET NULL'
    });

    User.belongsTo(District, {
      foreignKey: 'district_id',
      as: 'district'
    });
    console.log('✅ District ↔ User association created');
  } catch (error) {
    console.error('❌ Error creating District ↔ User association:', error.message);
  }

  // ============================================
  // ✅ MEMBER ↔ PROJECT (SUBMITTER)
  // ============================================
  try {
    if (Member && Project) {
      Member.hasMany(Project, {
        foreignKey: 'submitted_by',
        as: 'submittedProjects',
        onDelete: 'SET NULL'
      });

      Project.belongsTo(Member, {
        foreignKey: 'submitted_by',
        as: 'submitter'
      });
      console.log('✅ Member ↔ Project association created');
    }
  } catch (error) {
    console.error('❌ Error creating Member ↔ Project association:', error.message);
  }

  // ============================================
  // ✅ USER ↔ PROJECT (REVIEWER)
  // ============================================
  try {
    if (User && Project) {
      User.hasMany(Project, {
        foreignKey: 'reviewed_by',
        as: 'reviewedProjects',
        onDelete: 'SET NULL'
      });

      Project.belongsTo(User, {
        foreignKey: 'reviewed_by',
        as: 'reviewer'
      });
      console.log('✅ User ↔ Project (reviewer) association created');
    }
  } catch (error) {
    console.error('❌ Error creating User ↔ Project (reviewer) association:', error.message);
  }

  // ============================================
  // ✅ DONATION ↔ PROJECT
  // ============================================
  try {
    if (Donation && Project) {
      Donation.belongsTo(Project, {
        foreignKey: 'project_id',
        as: 'project'
      });

      Project.hasMany(Donation, {
        foreignKey: 'project_id',
        as: 'donations'
      });
      console.log('✅ Donation ↔ Project association created');
    }
  } catch (error) {
    console.error('❌ Error creating Donation ↔ Project association:', error.message);
  }

  // ============================================
  // ✅ DONATION ↔ EVENT
  // ============================================
  try {
    if (Donation && Event) {
      Donation.belongsTo(Event, {
        foreignKey: 'event_id',
        as: 'event'
      });

      Event.hasMany(Donation, {
        foreignKey: 'event_id',
        as: 'donations'
      });
      console.log('✅ Donation ↔ Event association created');
    }
  } catch (error) {
    console.error('❌ Error creating Donation ↔ Event association:', error.message);
  }

  // ============================================
  // ✅ DONATION ↔ USER (DONOR)
  // ============================================
  try {
    if (Donation && User) {
      Donation.belongsTo(User, {
        foreignKey: 'donor_id',
        as: 'donor'
      });

      User.hasMany(Donation, {
        foreignKey: 'donor_id',
        as: 'donations'
      });
      console.log('✅ Donation ↔ User (donor) association created');
    }
  } catch (error) {
    console.error('❌ Error creating Donation ↔ User association:', error.message);
  }

  // ============================================
  // ✅ USER ↔ IDEA
  // ============================================
  try {
    if (User && Idea) {
      if (typeof Idea.hasMany === 'function' || typeof Idea.associate === 'function') {
        User.hasMany(Idea, {
          foreignKey: 'user_id',
          as: 'ideas',
          onDelete: 'CASCADE'
        });

        Idea.belongsTo(User, {
          foreignKey: 'user_id',
          as: 'creator'
        });
        console.log('✅ User ↔ Idea association created');
      } else {
        console.warn('⚠️ Idea model not fully initialized, skipping User ↔ Idea association');
      }
    }
  } catch (error) {
    console.error('❌ Error creating User ↔ Idea association:', error.message);
  }

  // ============================================
  // ✅ USER ↔ REPORT (CREATOR)
  // ============================================
  try {
    if (User && Report) {
      User.hasMany(Report, {
        foreignKey: 'created_by',
        as: 'reports'
      });

      Report.belongsTo(User, {
        foreignKey: 'created_by',
        as: 'creator'
      });
      console.log('✅ User ↔ Report association created');
    }
  } catch (error) {
    console.error('❌ Error creating User ↔ Report association:', error.message);
  }

  // ============================================
  // ✅ MEMBER ↔ REPORT (SUBMITTER)
  // ============================================
  try {
    if (Member && Report) {
      Member.hasMany(Report, {
        foreignKey: 'submitted_by',
        as: 'submittedReports',
        onDelete: 'SET NULL'
      });

      Report.belongsTo(Member, {
        foreignKey: 'submitted_by',
        as: 'submitter'
      });
      console.log('✅ Member ↔ Report association created');
    }
  } catch (error) {
    console.error('❌ Error creating Member ↔ Report association:', error.message);
  }

  // ============================================
  // ✅ USER ↔ REPORT (REVIEWER)
  // ============================================
  try {
    if (User && Report) {
      User.hasMany(Report, {
        foreignKey: 'reviewed_by',
        as: 'reviewedReports',
        onDelete: 'SET NULL'
      });

      Report.belongsTo(User, {
        foreignKey: 'reviewed_by',
        as: 'reviewer'
      });
      console.log('✅ User ↔ Report (reviewer) association created');
    }
  } catch (error) {
    console.error('❌ Error creating User ↔ Report (reviewer) association:', error.message);
  }

  // ============================================
  // ✅ USER ↔ ANNOUNCEMENT
  // ============================================
  try {
    if (User && Announcement) {
      User.hasMany(Announcement, {
        foreignKey: 'author_id',
        as: 'announcements'
      });

      Announcement.belongsTo(User, {
        foreignKey: 'author_id',
        as: 'author'
      });
      console.log('✅ User ↔ Announcement association created');
    }
  } catch (error) {
    console.error('❌ Error creating User ↔ Announcement association:', error.message);
  }

  // ============================================
  // ✅ NEWS ↔ USER (AUTHOR)
  // ============================================
  try {
    if (User && News) {
      User.hasMany(News, {
        foreignKey: 'author_id',
        as: 'news'
      });

      News.belongsTo(User, {
        foreignKey: 'author_id',
        as: 'author'
      });
      console.log('✅ User ↔ News association created');
    }
  } catch (error) {
    console.error('❌ Error creating User ↔ News association:', error.message);
  }

  // ============================================
  // ✅ CHAT MESSAGE ASSOCIATIONS
  // ============================================
  try {
    if (User && ChatMessage) {
      // User as sender
      User.hasMany(ChatMessage, {
        foreignKey: 'sender_id',
        as: 'sentMessages',
        onDelete: 'CASCADE'
      });

      ChatMessage.belongsTo(User, {
        foreignKey: 'sender_id',
        as: 'sender'
      });

      // User as receiver
      User.hasMany(ChatMessage, {
        foreignKey: 'receiver_id',
        as: 'receivedMessages',
        onDelete: 'CASCADE'
      });

      ChatMessage.belongsTo(User, {
        foreignKey: 'receiver_id',
        as: 'receiver'
      });

      console.log('✅ User ↔ ChatMessage associations created');
    }
  } catch (error) {
    console.error('❌ Error creating User ↔ ChatMessage associations:', error.message);
  }

  // ============================================
  // ✅ COURSE ASSOCIATIONS
  // ============================================

  // Course ↔ Enrollment
  try {
    if (Course && CourseEnrollment) {
      Course.hasMany(CourseEnrollment, {
        foreignKey: 'course_id',
        as: 'enrollments',
        onDelete: 'CASCADE'
      });

      CourseEnrollment.belongsTo(Course, {
        foreignKey: 'course_id',
        as: 'course'
      });
      console.log('✅ Course ↔ Enrollment association created');
    }
  } catch (error) {
    console.error('❌ Error creating Course ↔ Enrollment association:', error.message);
  }

  // Member ↔ Course Enrollment
  try {
    if (Member && CourseEnrollment) {
      Member.hasMany(CourseEnrollment, {
        foreignKey: 'member_id',
        as: 'enrollments',
        onDelete: 'CASCADE'
      });

      CourseEnrollment.belongsTo(Member, {
        foreignKey: 'member_id',
        as: 'member'
      });
      console.log('✅ Member ↔ CourseEnrollment association created');
    }
  } catch (error) {
    console.error('❌ Error creating Member ↔ CourseEnrollment association:', error.message);
  }

  // User ↔ Course (creator)
  try {
    if (User && Course) {
      User.hasMany(Course, {
        foreignKey: 'created_by',
        as: 'createdCourses'
      });

      Course.belongsTo(User, {
        foreignKey: 'created_by',
        as: 'creator'
      });
      console.log('✅ User ↔ Course (creator) association created');
    }
  } catch (error) {
    console.error('❌ Error creating User ↔ Course (creator) association:', error.message);
  }

  // Course ↔ Topics
  try {
    if (Course && CourseTopic) {
      Course.hasMany(CourseTopic, {
        foreignKey: 'course_id',
        as: 'topics',
        onDelete: 'CASCADE'
      });

      CourseTopic.belongsTo(Course, {
        foreignKey: 'course_id',
        as: 'course'
      });
      console.log('✅ Course ↔ Topics association created');
    }
  } catch (error) {
    console.error('❌ Error creating Course ↔ Topics association:', error.message);
  }

  // Topic ↔ Subtopics
  try {
    if (CourseTopic) {
      CourseTopic.hasMany(CourseTopic, {
        foreignKey: 'parent_id',
        as: 'subtopics'
      });

      CourseTopic.belongsTo(CourseTopic, {
        foreignKey: 'parent_id',
        as: 'parent'
      });
      console.log('✅ Topic ↔ Subtopics association created');
    }
  } catch (error) {
    console.error('❌ Error creating Topic ↔ Subtopics association:', error.message);
  }

  // Topic ↔ Materials
  try {
    if (CourseTopic && CourseMaterial) {
      CourseTopic.hasMany(CourseMaterial, {
        foreignKey: 'topic_id',
        as: 'materials',
        onDelete: 'CASCADE'
      });

      CourseMaterial.belongsTo(CourseTopic, {
        foreignKey: 'topic_id',
        as: 'topic'
      });
      console.log('✅ Topic ↔ Materials association created');
    }
  } catch (error) {
    console.error('❌ Error creating Topic ↔ Materials association:', error.message);
  }

  // Course ↔ Assessments
  try {
    if (Course && CourseAssessment) {
      Course.hasMany(CourseAssessment, {
        foreignKey: 'course_id',
        as: 'assessments',
        onDelete: 'CASCADE'
      });

      CourseAssessment.belongsTo(Course, {
        foreignKey: 'course_id',
        as: 'course'
      });
      console.log('✅ Course ↔ Assessments association created');
    }
  } catch (error) {
    console.error('❌ Error creating Course ↔ Assessments association:', error.message);
  }

  // Topic ↔ Assessments
  try {
    if (CourseTopic && CourseAssessment) {
      CourseTopic.hasMany(CourseAssessment, {
        foreignKey: 'topic_id',
        as: 'assessments',
        onDelete: 'CASCADE'
      });

      CourseAssessment.belongsTo(CourseTopic, {
        foreignKey: 'topic_id',
        as: 'topic'
      });
      console.log('✅ Topic ↔ Assessments association created');
    }
  } catch (error) {
    console.error('❌ Error creating Topic ↔ Assessments association:', error.message);
  }

  // Assessment ↔ Attempts
  try {
    if (CourseAssessment && CourseAssessmentAttempt) {
      CourseAssessment.hasMany(CourseAssessmentAttempt, {
        foreignKey: 'assessment_id',
        as: 'attempts',
        onDelete: 'CASCADE'
      });

      CourseAssessmentAttempt.belongsTo(CourseAssessment, {
        foreignKey: 'assessment_id',
        as: 'assessment'
      });
      console.log('✅ Assessment ↔ Attempts association created');
    }
  } catch (error) {
    console.error('❌ Error creating Assessment ↔ Attempts association:', error.message);
  }

  // Member ↔ Assessment Attempts
  try {
    if (Member && CourseAssessmentAttempt) {
      Member.hasMany(CourseAssessmentAttempt, {
        foreignKey: 'member_id',
        as: 'assessmentAttempts',
        onDelete: 'CASCADE'
      });

      CourseAssessmentAttempt.belongsTo(Member, {
        foreignKey: 'member_id',
        as: 'member'
      });
      console.log('✅ Member ↔ AssessmentAttempts association created');
    }
  } catch (error) {
    console.error('❌ Error creating Member ↔ AssessmentAttempts association:', error.message);
  }

  // Unit ↔ Report
  try {
    if (Unit && Report) {
      Unit.hasMany(Report, {
        foreignKey: 'unit_id',
        as: 'reports',
        onDelete: 'SET NULL'
      });

      Report.belongsTo(Unit, {
        foreignKey: 'unit_id',
        as: 'unit'
      });
      console.log('✅ Unit ↔ Report association created');
    }
  } catch (error) {
    console.error('❌ Error creating Unit ↔ Report association:', error.message);
  }

  // ============================================
  // ✅ CONTACT SUBMISSION ASSOCIATIONS
  // ============================================
  try {
    if (ContactSubmission && User) {
      ContactSubmission.belongsTo(User, {
        foreignKey: 'replied_by',
        as: 'replier'
      });
      console.log('✅ ContactSubmission ↔ User association created');
    }
  } catch (error) {
    console.error('❌ Error creating ContactSubmission ↔ User association:', error.message);
  }

  // ============================================
  // ✅ PRODUCT ASSOCIATIONS (Optional)
  // ============================================
  // If you have associations for Product, add them here
  // For example: Product.hasMany(Order) or Product.belongsTo(Category)

  // ============================================
  // ✅ PAYMENT ASSOCIATIONS
  // ============================================

  // Payment ↔ PaymentService
  try {
    if (Payment && PaymentService) {
      Payment.belongsTo(PaymentService, {
        foreignKey: 'service_id',
        as: 'service'
      });

      PaymentService.hasMany(Payment, {
        foreignKey: 'service_id',
        as: 'payments'
      });
      console.log('✅ Payment ↔ PaymentService association created');
    }
  } catch (error) {
    console.error('❌ Error creating Payment ↔ PaymentService association:', error.message);
  }

  // Payment ↔ User (verifier)
  try {
    if (Payment && User) {
      Payment.belongsTo(User, {
        foreignKey: 'verified_by',
        as: 'verifier'
      });

      User.hasMany(Payment, {
        foreignKey: 'verified_by',
        as: 'verifiedPayments'
      });
      console.log('✅ Payment ↔ User (verifier) association created');
    }
  } catch (error) {
    console.error('❌ Error creating Payment ↔ User (verifier) association:', error.message);
  }

  // Payment ↔ PaymentHistory
  try {
    if (Payment && PaymentHistory) {
      Payment.hasMany(PaymentHistory, {
        foreignKey: 'payment_id',
        as: 'history',
        onDelete: 'CASCADE'
      });

      PaymentHistory.belongsTo(Payment, {
        foreignKey: 'payment_id',
        as: 'payment'
      });
      console.log('✅ Payment ↔ PaymentHistory association created');
    }
  } catch (error) {
    console.error('❌ Error creating Payment ↔ PaymentHistory association:', error.message);
  }

  // Payment ↔ PaymentReceipt
  try {
    if (Payment && PaymentReceipt) {
      Payment.hasOne(PaymentReceipt, {
        foreignKey: 'payment_id',
        as: 'receipt',
        onDelete: 'CASCADE'
      });

      PaymentReceipt.belongsTo(Payment, {
        foreignKey: 'payment_id',
        as: 'payment'
      });
      console.log('✅ Payment ↔ PaymentReceipt association created');
    }
  } catch (error) {
    console.error('❌ Error creating Payment ↔ PaymentReceipt association:', error.message);
  }

  // Payment ↔ PaymentNotification
  try {
    if (Payment && PaymentNotification) {
      Payment.hasMany(PaymentNotification, {
        foreignKey: 'payment_id',
        as: 'notifications',
        onDelete: 'CASCADE'
      });

      PaymentNotification.belongsTo(Payment, {
        foreignKey: 'payment_id',
        as: 'payment'
      });
      console.log('✅ Payment ↔ PaymentNotification association created');
    }
  } catch (error) {
    console.error('❌ Error creating Payment ↔ PaymentNotification association:', error.message);
  }

  // PaymentNotification ↔ User
  try {
    if (PaymentNotification && User) {
      PaymentNotification.belongsTo(User, {
        foreignKey: 'user_id',
        as: 'user'
      });

      User.hasMany(PaymentNotification, {
        foreignKey: 'user_id',
        as: 'paymentNotifications'
      });
      console.log('✅ PaymentNotification ↔ User association created');
    }
  } catch (error) {
    console.error('❌ Error creating PaymentNotification ↔ User association:', error.message);
  }

  // PaymentNotification ↔ Member
  try {
    if (PaymentNotification && Member) {
      PaymentNotification.belongsTo(Member, {
        foreignKey: 'member_id',
        as: 'member'
      });

      Member.hasMany(PaymentNotification, {
        foreignKey: 'member_id',
        as: 'paymentNotifications'
      });
      console.log('✅ PaymentNotification ↔ Member association created');
    }
  } catch (error) {
    console.error('❌ Error creating PaymentNotification ↔ Member association:', error.message);
  }

  // ============================================
  // ✅ SUMMARY
  // ============================================

  console.log('✅ All associations loaded successfully');
  console.log('🔍 Association Summary:');
  console.log('  - User ↔ ChatMessage (sender):', !!(User && ChatMessage && User.associations?.sentMessages));
  console.log('  - User ↔ ChatMessage (receiver):', !!(User && ChatMessage && User.associations?.receivedMessages));
  console.log('  - Donation → Project:', !!(Donation && Project && Donation.associations?.project));
  console.log('  - Donation → Event:', !!(Donation && Event && Donation.associations?.event));
  console.log('  - Donation → User (donor):', !!(Donation && User && Donation.associations?.donor));
  console.log('  - Project → Member (submitter):', !!(Project && Member && Project.associations?.submitter));
  console.log('  - User → Member:', !!(User && Member && User.associations?.member));
  console.log('  - Member → User:', !!(Member && User && Member.associations?.user));
  console.log('  - User → Idea:', !!(User && Idea && User.associations?.ideas));
  console.log('  - Idea → User (creator):', !!(Idea && User && Idea.associations?.creator));
  console.log('  - Course → Enrollment:', !!(Course && CourseEnrollment && Course.associations?.enrollments));
  console.log('  - Member → CourseEnrollment:', !!(Member && CourseEnrollment && Member.associations?.enrollments));
  console.log('  - User → Course (creator):', !!(User && Course && User.associations?.createdCourses));
  console.log('  - Course → Topics:', !!(Course && CourseTopic && Course.associations?.topics));
  console.log('  - Topic → Subtopics:', !!(CourseTopic && CourseTopic.associations?.subtopics));
  console.log('  - Topic → Materials:', !!(CourseTopic && CourseMaterial && CourseTopic.associations?.materials));
  console.log('  - Course → Assessments:', !!(Course && CourseAssessment && Course.associations?.assessments));
  console.log('  - Topic → Assessments:', !!(CourseTopic && CourseAssessment && CourseTopic.associations?.assessments));
  console.log('  - Assessment → Attempts:', !!(CourseAssessment && CourseAssessmentAttempt && CourseAssessment.associations?.attempts));
  console.log('  - Member → AssessmentAttempts:', !!(Member && CourseAssessmentAttempt && Member.associations?.assessmentAttempts));
  console.log('  - District → Event:', !!(District && Event && District.associations?.events));
  console.log('  - Event → District:', !!(Event && District && Event.associations?.district));
  console.log('  - District → Member:', !!(District && Member && District.associations?.members));
  console.log('  - District → User:', !!(District && User && District.associations?.users));
  console.log('  - User → News:', !!(User && News && User.associations?.news));
  console.log('  - Payment → PaymentService:', !!(Payment && PaymentService && Payment.associations?.service));
  console.log('  - Payment → User (verifier):', !!(Payment && User && Payment.associations?.verifier));
  console.log('  - Payment → PaymentHistory:', !!(Payment && PaymentHistory && Payment.associations?.history));
  console.log('  - Payment → PaymentReceipt:', !!(Payment && PaymentReceipt && Payment.associations?.receipt));
  console.log('  - Payment → PaymentNotification:', !!(Payment && PaymentNotification && Payment.associations?.notifications));
  console.log('  - PaymentNotification → User:', !!(PaymentNotification && User && PaymentNotification.associations?.user));
  console.log('  - PaymentNotification → Member:', !!(PaymentNotification && Member && PaymentNotification.associations?.member));
  console.log('  - ContactSubmission → User (replier):', !!(ContactSubmission && User && ContactSubmission.associations?.replier));
};

// ===============================
// INITIALIZE ASSOCIATIONS
// ===============================
setupAssociations();

// ===============================
// EXPORT MODELS
// ===============================
module.exports = {
  sequelize,
  User,
  Member,
  Event,
  EventRegistration,
  Course,
  CourseEnrollment,
  CourseTopic,
  CourseMaterial,
  CourseAssessment,
  CourseAssessmentAttempt,
  Project,
  Report,
  Announcement,
  Idea,
  Donation,
  AuditLog,
  District,
  Unit,
  Notification,
  Product,
  ContactSubmission,
  News,  // ✅ ADDED
  ChatMessage,
  PaymentService,
  PaymentMethod,
  Payment,
  PaymentHistory,
  PaymentReceipt,
  PaymentNotification
};