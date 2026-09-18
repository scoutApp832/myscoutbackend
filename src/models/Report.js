const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Debug: Check if sequelize is valid
if (!sequelize) {
  console.error('❌ Report: sequelize is undefined');
  throw new Error('Sequelize instance is undefined. Check database configuration.');
}

if (typeof sequelize.define !== 'function') {
  console.error('❌ Report: sequelize.define is not a function');
  throw new Error('Sequelize instance is invalid.');
}

console.log('✅ Report: Sequelize instance is valid');

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  activity_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'activity_type'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  submitted_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'submitted_by'
  },
  unit_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'unit_id'
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  activity_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'activity_date'
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  participants_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    field: 'participants_count'
  },
  achievements: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  challenges: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recommendations: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  file_urls: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'revision', 'rejected', 'archived'),
    defaultValue: 'pending'
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reviewed_by'
  },
  published_to_public: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'published_to_public'
  },
  published_to_donors: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'published_to_donors'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by'
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reviewed_at'
  },
  
  // ✅ ADD THESE FIELDS
  forwarded_to_national: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'forwarded_to_national'
  },
  forwarded_to_national_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'forwarded_to_national_at'
  },
  forwarded_to_national_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'forwarded_to_national_by'
  },
  resent_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'resent_at'
  },
  resent_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'resent_by'
  },
  resent_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    field: 'resent_count'
  },
  last_resent_destination: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'last_resent_destination'
  },
  edited_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'edited_by'
  },
  edited_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'edited_at'
  },
  edit_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    field: 'edit_count'
  }

}, {
  timestamps: true,
  tableName: 'reports',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

console.log('✅ Report model defined successfully');

module.exports = Report;