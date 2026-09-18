// src/models/Idea.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Idea = sequelize.define('Idea', {
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
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'Other'
  },
  recipient: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'district_commissioner'
  },
  suggestion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'pending'
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  response: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ideas',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ✅ Association with User model
Idea.associate = (models) => {
  Idea.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'creator'
  });
};

module.exports = Idea;