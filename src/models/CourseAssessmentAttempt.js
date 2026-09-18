const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CourseAssessmentAttempt = sequelize.define('CourseAssessmentAttempt', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  assessment_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'course_assessments',
      key: 'id'
    }
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'members',
      key: 'id'
    }
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  passed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  answers: {
    type: DataTypes.JSON,
    allowNull: true
  },
  attempt_number: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  // ✅ ADD THIS STATUS FIELD
  status: {
    type: DataTypes.ENUM('started', 'submitted', 'graded'),
    defaultValue: 'started'
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
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
  tableName: 'course_assessment_attempts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// Associations
CourseAssessmentAttempt.associate = (models) => {
  CourseAssessmentAttempt.belongsTo(models.CourseAssessment, {
    foreignKey: 'assessment_id',
    as: 'assessment'
  });
  
  CourseAssessmentAttempt.belongsTo(models.Member, {
    foreignKey: 'member_id',
    as: 'member'
  });
};

module.exports = CourseAssessmentAttempt;