// src/models/CourseEnrollment.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CourseEnrollment = sequelize.define('CourseEnrollment', {
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
  member_id: {  // ✅ CHANGE: Use member_id instead of user_id
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'members',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_accessed: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  certificate_issued: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  certificate_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  enrolled_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
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
  tableName: 'course_enrollments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// Associations
CourseEnrollment.associate = (models) => {
  CourseEnrollment.belongsTo(models.Course, {
    foreignKey: 'course_id',
    as: 'course'
  });
  
  CourseEnrollment.belongsTo(models.Member, {  // ✅ Associate with Member
    foreignKey: 'member_id',
    as: 'member'
  });
};

module.exports = CourseEnrollment;