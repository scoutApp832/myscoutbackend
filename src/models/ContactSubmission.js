// backend/src/models/ContactSubmission.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContactSubmission = sequelize.define('ContactSubmission', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'general'
    },
    status: {
      type: DataTypes.ENUM('new', 'read', 'replied', 'archived'),
      defaultValue: 'new'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    replied_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    replied_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
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
    tableName: 'contact_submissions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Associations
  ContactSubmission.associate = (models) => {
    ContactSubmission.belongsTo(models.User, {
      foreignKey: 'replied_by',
      as: 'replier'
    });
  };

  return ContactSubmission;
};