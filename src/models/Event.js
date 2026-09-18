// backend/src/models/Event.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define('Event', {
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
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  venue: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  registration_deadline: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'upcoming'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  scope: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'district'
  },
  district_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_national: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  attendance_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  attendance_link: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  attendance_link_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  attendance_link_generated: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  attendance_link_generated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'events',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ============================================
// ✅ FIXED: ASSOCIATIONS WITH SAFETY CHECKS
// ============================================
Event.associate = (models) => {
  try {
    // Creator of event
    if (models && models.User) {
      Event.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
      });
      console.log('✅ Event → User (creator) association');
    }

    // District association
    if (models && models.District) {
      Event.belongsTo(models.District, {
        foreignKey: 'district_id',
        as: 'district'
      });
      console.log('✅ Event → District association');
    }

    // Event registrations
    if (models && models.EventRegistration) {
      Event.hasMany(models.EventRegistration, {
        foreignKey: 'event_id',
        as: 'registrations'
      });
      console.log('✅ Event → EventRegistration (hasMany)');
    }

    // Event donations
    if (models && models.Donation) {
      Event.hasMany(models.Donation, {
        foreignKey: 'event_id',
        as: 'donations'
      });
      console.log('✅ Event → Donation (hasMany)');
    }

    // Event notifications
    if (models && models.Notification) {
      Event.hasMany(models.Notification, {
        foreignKey: 'event_id',
        as: 'notifications'
      });
      console.log('✅ Event → Notification (hasMany)');
    }
  } catch (error) {
    console.error('❌ Error in Event associations:', error.message);
  }
};

module.exports = Event;