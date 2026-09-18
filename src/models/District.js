const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const District = sequelize.define('District', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  province: {
    type: DataTypes.STRING(100)
  },
  code: {
    type: DataTypes.STRING(10)
  }
}, {
  tableName: 'districts',
  timestamps: true
});

module.exports = District;