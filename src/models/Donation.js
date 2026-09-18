// backend/src/models/Donation.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Donation = sequelize.define('Donation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  donor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'donor_id'
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'project_id'
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'event_id'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'RWF'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'payment_method'
  },
  payment_reference: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'payment_reference'
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  receipt_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'receipt_url'
  },
  is_anonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_anonymous'
  },
  donor_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'donor_name'
  },
  donor_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'donor_email'
  },
  donor_phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'donor_phone'
  }
}, {
  tableName: 'donations',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ✅ Associations
Donation.associate = (models) => {
  if (models && models.User) {
    Donation.belongsTo(models.User, {
      foreignKey: 'donor_id',
      as: 'donor'
    });
  }
  if (models && models.Project) {
    Donation.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project'
    });
  }
  if (models && models.Event) {
    Donation.belongsTo(models.Event, {
      foreignKey: 'event_id',
      as: 'event'
    });
  }
};

module.exports = Donation;