const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

if (!sequelize) {
  throw new Error('Sequelize instance is not defined.');
}

const Member = sequelize.define('Member', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  sin: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  middle_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  // ✅ TROOP NAME - NEW COLUMN
  troop_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null
  },
  
  province: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sector: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  cell: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  village: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    allowNull: true
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  membership_status: {
    type: DataTypes.ENUM('active', 'inactive', 'pending', 'suspended', 'expired'),
    defaultValue: 'pending'
  },
  membership_type: {
    type: DataTypes.ENUM('regular', 'honorary', 'lifetime', 'trial'),
    defaultValue: 'regular'
  },
  joined_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  profile_image: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  skills: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  interests: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  
  // ==============================================
  // ✅ PAYMENT-RELATED FIELDS
  // ==============================================
  fee_status: {
    type: DataTypes.ENUM('unpaid', 'pending', 'paid', 'approved'),
    defaultValue: 'unpaid'
  },
  payment_status: {
    type: DataTypes.ENUM('unpaid', 'pending', 'paid', 'approved'),
    defaultValue: 'unpaid'
  },
  payment_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  payment_approved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  payment_approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  payment_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  payment_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  payment_reference: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  fee_paid_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  fee_expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // ==============================================
  // ✅ SCOUT ID GENERATION
  // ==============================================
  scout_id_generated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  scout_id_generated_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  scout_id_generated_by: {
    type: DataTypes.INTEGER,
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
  tableName: 'members',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = Member;