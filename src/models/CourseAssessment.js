const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CourseAssessment = sequelize.define('CourseAssessment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'courses',
      key: 'id'
    }
  },
  topic_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'course_topics',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.STRING(20),
    defaultValue: 'quiz'
  },
  questions: {
    type: DataTypes.JSON,
    allowNull: false
  },
  passing_score: {
    type: DataTypes.INTEGER,
    defaultValue: 70
  },
  time_limit: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  allow_retake: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  max_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  show_score_immediately: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'course_assessments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// Associations
CourseAssessment.associate = (models) => {
  CourseAssessment.belongsTo(models.Course, {
    foreignKey: 'course_id',
    as: 'course'
  });
  
  CourseAssessment.belongsTo(models.CourseTopic, {
    foreignKey: 'topic_id',
    as: 'topic'
  });
  
  CourseAssessment.hasMany(models.CourseAssessmentAttempt, {
    foreignKey: 'assessment_id',
    as: 'attempts'
  });
};

module.exports = CourseAssessment;