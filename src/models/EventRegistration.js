// backend/src/models/EventRegistration.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventRegistration = sequelize.define('EventRegistration', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id'
    }
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'members',
      key: 'id'
    }
  },
  registration_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending'
  },
  payment_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  payment_amount: {
    type: DataTypes.DECIMAL(10, 2)
  },
  payment_method: {
    type: DataTypes.STRING(50)
  },
  payment_reference: {
    type: DataTypes.STRING(100)
  },
  attendance_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  attendance_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  attendance_confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  certificate_issued: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  certificate_url: {
    type: DataTypes.TEXT
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'event_registrations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ============================================
// ✅ FIXED: ASSOCIATIONS WITH SAFETY CHECKS
// ============================================
EventRegistration.associate = (models) => {
  try {
    // EventRegistration belongs to Event
    if (models && models.Event) {
      EventRegistration.belongsTo(models.Event, {
        foreignKey: 'event_id',
        as: 'event'
      });
      console.log('✅ EventRegistration → Event association');
    }

    // EventRegistration belongs to Member
    if (models && models.Member) {
      EventRegistration.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });
      console.log('✅ EventRegistration → Member association');
    }
  } catch (error) {
    console.error('❌ Error in EventRegistration associations:', error.message);
  }
};

module.exports = EventRegistration;