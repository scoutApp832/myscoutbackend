const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CourseTopic = sequelize.define('CourseTopic', {
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
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  parent_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'course_topics',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.STRING(50),
    defaultValue: 'lesson'
  },
  is_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
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
  tableName: 'course_topics',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// Associations
CourseTopic.associate = (models) => {
  CourseTopic.belongsTo(models.Course, {
    foreignKey: 'course_id',
    as: 'course'
  });
  
  CourseTopic.belongsTo(models.CourseTopic, {
    foreignKey: 'parent_id',
    as: 'parent'
  });
  
  CourseTopic.hasMany(models.CourseTopic, {
    foreignKey: 'parent_id',
    as: 'subtopics'
  });
  
  CourseTopic.hasMany(models.CourseMaterial, {
    foreignKey: 'topic_id',
    as: 'materials'
  });
  
  CourseTopic.hasMany(models.CourseAssessment, {
    foreignKey: 'topic_id',
    as: 'assessments'
  });
};

module.exports = CourseTopic;