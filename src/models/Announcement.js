const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Announcement = sequelize.define('Announcement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Title is required' },
      len: { args: [3, 255], msg: 'Title must be between 3 and 255 characters' }
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Content is required' }
    }
  },
  author_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  signature: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  announcement_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'general',
    validate: {
      isIn: {
        args: [['general', 'urgent', 'important', 'info', 'event', 'course', 'notice']],
        msg: 'Invalid announcement type'
      }
    }
  },
  audience: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: ['all']
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'all'
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  is_pinned: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  create_notification: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true
  },
  send_email: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  schedule_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'draft',
    validate: {
      isIn: {
        args: [['draft', 'published', 'archived', 'scheduled']],
        msg: 'Invalid status'
      }
    }
  },
  published_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
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
  tableName: 'announcements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  hooks: {
    beforeCreate: (announcement) => {
      if (!announcement.published_date) {
        announcement.published_date = new Date();
      }
      if (!announcement.status) {
        announcement.status = 'draft';
      }
      if (announcement.is_public === undefined) {
        announcement.is_public = false;
      }
      if (announcement.is_pinned === undefined) {
        announcement.is_pinned = false;
      }
      if (announcement.create_notification === undefined) {
        announcement.create_notification = true;
      }
    },
    beforeUpdate: (announcement) => {
      announcement.updated_at = new Date();
    }
  }
});

// Associations
Announcement.associate = (models) => {
  Announcement.belongsTo(models.User, {
    foreignKey: 'author_id',
    as: 'author'
  });
};

module.exports = Announcement;