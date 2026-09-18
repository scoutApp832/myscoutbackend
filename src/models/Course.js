const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  cover_image: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'general'
  },
  level: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
    defaultValue: 'beginner'
  },
  duration: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'Self-paced'
  },
  prerequisites: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    defaultValue: 'draft'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  archived_at: {
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
  tableName: 'courses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// Associations
Course.associate = (models) => {
  Course.belongsTo(models.User, {
    foreignKey: 'created_by',
    as: 'creator'
  });
  
  Course.hasMany(models.CourseTopic, {
    foreignKey: 'course_id',
    as: 'topics'
  });
  
  Course.hasMany(models.CourseEnrollment, {
    foreignKey: 'course_id',
    as: 'enrollments'
  });
  
  Course.hasMany(models.CourseAssessment, {
    foreignKey: 'course_id',
    as: 'assessments'
  });
};

module.exports = Course;