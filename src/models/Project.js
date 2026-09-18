const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

if (!sequelize) {
  throw new Error('Sequelize instance is not defined.');
}

const Project = sequelize.define('Project', {
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
    allowNull: true
  },
  // ✅ ADD: Category field
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  budget: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending'
  },
  timeline: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  objectives: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // ✅ Renamed to document_url (matches frontend)
  document_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  submitted_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'members',
      key: 'id'
    }
  },
  reviewed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reviewed_date: {
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
  tableName: 'projects',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = Project;