const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

// ============================================
// 1. PAYMENT SERVICES MODEL
// ============================================
const PaymentService = sequelize.define('PaymentService', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  level: {
    type: DataTypes.STRING(50),
    defaultValue: 'National'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  roles: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['scout', 'unit_leader', 'donor']
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
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
  tableName: 'payment_services',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ============================================
// 2. PAYMENT METHODS MODEL - WITH DISTRICT UNIQUENESS
// ============================================
const PaymentMethod = sequelize.define('PaymentMethod', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
    // ✅ Removed global unique: true - now unique per district
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  bank_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  account_holder: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  account_number: {
    type: DataTypes.STRING(100),
    allowNull: true
    // ✅ Unique per district (handled by index)
  },
  swift_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  branch: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  provider: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  phone_number: {
    type: DataTypes.STRING(50),
    allowNull: true
    // ✅ Unique per district (handled by index)
  },
  ussd_code: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // ✅ DISTRICT FIELDS
  district_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'all'
  },
  created_by: {
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
  tableName: 'payment_methods',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  // ✅ Add composite unique indexes
  indexes: [
    // ✅ Name + District must be unique together
    {
      unique: true,
      fields: ['name', 'district'],
      name: 'payment_methods_name_district_unique'
    },
    // ✅ Account number + District must be unique together
    {
      unique: true,
      fields: ['account_number', 'district'],
      name: 'payment_methods_account_number_district_unique',
      where: {
        account_number: { [Op.ne]: null }
      }
    },
    // ✅ Phone number + District must be unique together
    {
      unique: true,
      fields: ['phone_number', 'district'],
      name: 'payment_methods_phone_number_district_unique',
      where: {
        phone_number: { [Op.ne]: null }
      }
    }
  ]
});

// ============================================
// 3. PAYMENTS MODEL
// ============================================
const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  invoice: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  sin: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  unit: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  service_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  service_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  service_category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  service_level: {
    type: DataTypes.STRING(50),
    defaultValue: 'National'
  },
  service_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_method: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  payment_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending'
  },
  evidence_file: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  evidence_file_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  evidence_file_type: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  verified_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  verification_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notification_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notification_sent_at: {
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
  tableName: 'payments',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ============================================
// 4. PAYMENT HISTORY MODEL
// ============================================
const PaymentHistory = sequelize.define('PaymentHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  old_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  new_status: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  changed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  changed_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'payment_history',
  timestamps: false
});

// ============================================
// 5. PAYMENT RECEIPTS MODEL
// ============================================
const PaymentReceipt = sequelize.define('PaymentReceipt', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  receipt_number: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  receipt_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  receipt_pdf: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  generated_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  generated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  is_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'payment_receipts',
  timestamps: false
});

// ============================================
// 6. PAYMENT NOTIFICATIONS MODEL
// ============================================
const PaymentNotification = sequelize.define('PaymentNotification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(50),
    defaultValue: 'new_payment'
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sent_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'payment_notifications',
  timestamps: false
});

// ============================================
// ASSOCIATIONS
// ============================================
PaymentService.associate = (models) => {
  PaymentService.hasMany(models.Payment, { foreignKey: 'service_id', as: 'payments' });
};

Payment.associate = (models) => {
  Payment.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  Payment.belongsTo(models.Member, { foreignKey: 'member_id', as: 'member' });
  Payment.belongsTo(models.PaymentService, { foreignKey: 'service_id', as: 'service' });
  Payment.belongsTo(models.User, { foreignKey: 'verified_by', as: 'verifier' });
  Payment.hasMany(models.PaymentHistory, { foreignKey: 'payment_id', as: 'history' });
  Payment.hasMany(models.PaymentNotification, { foreignKey: 'payment_id', as: 'notifications' });
  Payment.hasOne(models.PaymentReceipt, { foreignKey: 'payment_id', as: 'receipt' });
};

PaymentHistory.associate = (models) => {
  PaymentHistory.belongsTo(models.Payment, { foreignKey: 'payment_id', as: 'payment' });
  PaymentHistory.belongsTo(models.User, { foreignKey: 'changed_by', as: 'changer' });
};

PaymentReceipt.associate = (models) => {
  PaymentReceipt.belongsTo(models.Payment, { foreignKey: 'payment_id', as: 'payment' });
  PaymentReceipt.belongsTo(models.User, { foreignKey: 'generated_by', as: 'generator' });
};

PaymentNotification.associate = (models) => {
  PaymentNotification.belongsTo(models.Payment, { foreignKey: 'payment_id', as: 'payment' });
  PaymentNotification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  PaymentNotification.belongsTo(models.Member, { foreignKey: 'member_id', as: 'member' });
};

// ============================================
// EXPORT ALL MODELS
// ============================================
module.exports = {
  PaymentService,
  PaymentMethod,
  Payment,
  PaymentHistory,
  PaymentReceipt,
  PaymentNotification
};