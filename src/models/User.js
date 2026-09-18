const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Full name is required' },
      len: { args: [2, 255], msg: 'Name must be between 2 and 255 characters' }
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: 'Please provide a valid email' },
      notEmpty: { msg: 'Email is required' }
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: { args: /^[0-9+\-\s()]+$/, msg: 'Invalid phone number format' }
    }
  },
  role: {
    type: DataTypes.ENUM(
      'scout',
      'unit_leader',
      'district_commissioner',
      'national_commissioner',
      'donor'
    ),
    defaultValue: 'scout'
  },
  status: {
    type: DataTypes.ENUM('active', 'pending', 'inactive', 'suspended'),
    defaultValue: 'pending'
  },
  permissions: {
    type: DataTypes.JSONB,
    defaultValue: {},
    get() {
      const raw = this.getDataValue('permissions');
      return raw || {};
    }
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verification_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  reset_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  reset_token_expiry: {
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
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        const salt = await bcrypt.genSalt(12);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        const salt = await bcrypt.genSalt(12);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    }
  }
});

// ✅ Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password_hash);
};

User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password_hash;
  delete values.verification_token;
  delete values.reset_token;
  delete values.reset_token_expiry;
  return values;
};

// ✅ Static methods
User.findByEmail = async function(email) {
  return await this.findOne({ where: { email } });
};

User.findActive = async function() {
  return await this.findAll({ where: { status: 'active' } });
};

module.exports = User;