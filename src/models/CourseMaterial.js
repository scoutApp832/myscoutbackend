const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CourseMaterial = sequelize.define('CourseMaterial', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  topic_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'course_topics',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  url: {
    type: DataTypes.STRING(500),
    allowNull: true
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
  tableName: 'course_materials',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// Associations
CourseMaterial.associate = (models) => {
  CourseMaterial.belongsTo(models.CourseTopic, {
    foreignKey: 'topic_id',
    as: 'topic'
  });
};

module.exports = CourseMaterial;