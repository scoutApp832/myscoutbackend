const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  entity_id: {
    type: DataTypes.INTEGER
  }
}, {
  tableName: 'audit_logs',
  timestamps: true
});

module.exports = AuditLog;