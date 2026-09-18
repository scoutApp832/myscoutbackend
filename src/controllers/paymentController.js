const { Op, sequelize } = require('sequelize');
const {
  Payment,
  PaymentService,
  PaymentMethod,
  PaymentHistory,
  PaymentReceipt,
  PaymentNotification,
  User,
  Member,
  Notification,
  District,
  Event
} = require('../models');

// ============================================
// GENERATE REFERENCE NUMBER
// ============================================
const generateReference = (role = 'MSR') => {
  const prefix = role === 'donor' ? 'DON' : 'MSR';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-PAY-${timestamp}-${random}`;
};

const generateInvoice = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${timestamp}-${random}`;
};
// ============================================
// GET PAYMENT SERVICES (SERVICES + EVENTS)
// ============================================
exports.getPaymentServices = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const userDistrict = req.user.member?.district || req.user.district;
    const userDistrictId = req.user.member?.district_id || req.user.district_id || 0;

    console.log('📊 Fetching payment services for user:', { 
      userId, 
      role, 
      userDistrict, 
      userDistrictId 
    });

    // ✅ 1. Get FIXED PAYMENT SERVICES from payment_services table
    const paymentServices = await PaymentService.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC']]
    });

    // Filter payment services by role
    let filteredServices = paymentServices;
    if (role === 'donor') {
      filteredServices = paymentServices.filter(s => 
        s.roles && (s.roles.includes('donor') || s.roles.includes('all'))
      );
    } else if (role === 'scout' || role === 'unit_leader') {
      filteredServices = paymentServices.filter(s => 
        s.roles && (s.roles.includes('scout') || s.roles.includes('unit_leader') || s.roles.includes('all'))
      );
    } else if (role === 'district_commissioner' || role === 'district-commissioner') {
      filteredServices = paymentServices.filter(s => 
        s.roles && (s.roles.includes('district_commissioner') || s.roles.includes('all'))
      );
    } else if (role === 'national_commissioner' || role === 'national-commissioner') {
      filteredServices = paymentServices.filter(s => 
        s.roles && (s.roles.includes('national_commissioner') || s.roles.includes('all'))
      );
    }

    console.log(`📊 Found ${filteredServices.length} payment services`);

    // ✅ 2. Get EVENTS using Sequelize model directly (NO raw SQL)
    let whereClause = {
      status: { [Op.in]: ['upcoming', 'published', 'ongoing'] },
      price: { [Op.gt]: 0 }
    };

    // Filter by role and district
    if (role === 'district_commissioner' || role === 'district-commissioner') {
      if (userDistrictId) {
        whereClause = {
          ...whereClause,
          [Op.or]: [
            { is_national: true },
            { district_id: userDistrictId }
          ]
        };
      } else {
        whereClause = { ...whereClause, is_national: true };
      }
    } else if (role === 'national_commissioner' || role === 'national-commissioner' || 
               role === 'super_admin' || role === 'super-admin' || role === 'admin') {
      // No filter needed - see all events
    } else {
      // Regular users see National events AND their district events
      if (userDistrictId) {
        whereClause = {
          ...whereClause,
          [Op.or]: [
            { is_national: true },
            { district_id: userDistrictId }
          ]
        };
      } else {
        whereClause = { ...whereClause, is_national: true };
      }
    }

    console.log('📊 Where clause:', JSON.stringify(whereClause, null, 2));

    const events = await Event.findAll({
      where: whereClause,
      order: [
        ['is_national', 'DESC'],
        ['start_date', 'ASC']
      ],
      limit: 50
    });

    console.log(`📊 Found ${events.length} payable events`);

    // ✅ 3. Transform events to payment services format
    const eventServices = events.map(event => {
      const serviceLevel = event.is_national === true ? 'National' : 'District';

      return {
        id: `event-${event.id}`,
        name: event.title,
        description: event.description || `Participate in ${event.title}`,
        amount: parseFloat(event.price) || 0,
        category: event.event_type || 'event',
        service_level: serviceLevel,
        is_active: true,
        is_event: true,
        event_id: event.id,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location,
        is_national: event.is_national,
        district_id: event.district_id,
        status: event.status
      };
    });

    // ✅ 4. Combine services and events
    const allServices = [...filteredServices, ...eventServices];

    console.log(`✅ Total services: ${allServices.length}`);
    console.log(`   - Fixed services: ${filteredServices.length}`);
    console.log(`   - Events (payable): ${eventServices.length}`);

    // Log events for debugging
    if (eventServices.length > 0) {
      console.log('📊 Events loaded:');
      eventServices.forEach(e => {
        console.log(`   - ${e.name} (${e.service_level}) - ${e.amount} RWF`);
      });
    }

    res.json({
      success: true,
      services: allServices,
      fixed_services: filteredServices,
      events: eventServices,
      source: 'combined',
      fixed_count: filteredServices.length,
      event_count: eventServices.length,
      total: allServices.length
    });

  } catch (error) {
    console.error('❌ Get payment services error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment services: ' + error.message,
      error: error.message,
      services: []
    });
  }
};
exports.getPaymentMethods = async (req, res) => {
  try {
    const user = req.user;
    const role = user.role;
    const district = user.member?.district || user.district;
    const districtId = user.member?.district_id || user.district_id;

    let whereClause = { is_active: true };

    // ✅ NATIONAL COMMISSIONER & SUPER ADMIN - See ONLY National methods
    if (role === 'national_commissioner' || role === 'national-commissioner' || 
        role === 'super_admin' || role === 'super-admin' || role === 'admin') {
      whereClause = {
        is_active: true,
        [Op.or]: [
          { district: 'all' },
          { district: null },
          { district: '' }
        ]
      };
      console.log('👑 National - Seeing ONLY national payment methods');
    } 
    // ✅ DISTRICT COMMISSIONER - See ONLY their district methods
    else if (role === 'district_commissioner' || role === 'district-commissioner') {
      if (!district) {
        return res.status(400).json({
          success: false,
          message: 'District not assigned to user'
        });
      }
      whereClause = {
        is_active: true,
        district: district
      };
      console.log(`🏛️ District Commissioner - Seeing methods for district: ${district}`);
    } 
    // ✅ OTHER ROLES (scout, unit_leader, donor) - See BOTH National AND their district methods
    else {
      // ✅ Allow both national methods AND district methods for the user's district
      const orConditions = [
        { district: 'all' },
        { district: null },
        { district: '' }
      ];
      
      // ✅ If user has a district, also include their district methods
      if (district) {
        orConditions.push({ district: district });
      }
      
      whereClause = {
        is_active: true,
        [Op.or]: orConditions
      };
      console.log(`👤 ${role} - Seeing national and district (${district || 'none'}) payment methods`);
    }

    const methods = await PaymentMethod.findAll({
      where: whereClause,
      order: [['sort_order', 'ASC']]
    });

    console.log(`✅ Found ${methods.length} payment methods`);

    res.json({
      success: true,
      methods
    });
  } catch (error) {
    console.error('❌ Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment methods',
      error: error.message,
      methods: []
    });
  }
};
// ============================================
// CREATE PAYMENT METHOD - NATIONAL & DISTRICT
// ============================================
exports.createPaymentMethod = async (req, res) => {
  try {
    const {
      name,
      display_name,
      description,
      bank_name,
      account_holder,
      account_number,
      swift_code,
      branch,
      provider,
      phone_number,
      ussd_code,
      is_active,
      sort_order,
      district
    } = req.body;

    const user = req.user;
    const role = user.role;
    const userDistrict = user.member?.district || user.district;
    const userDistrictId = user.member?.district_id || user.district_id;

    // ✅ Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Payment method name is required'
      });
    }

    // ✅ Check permissions
    const isNational = role === 'national_commissioner' || role === 'national-commissioner' || 
                       role === 'super_admin' || role === 'super-admin' || role === 'admin';
    const isDistrict = role === 'district_commissioner' || role === 'district-commissioner';

    if (!isNational && !isDistrict) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create payment methods'
      });
    }

    // ✅ Determine which district to assign
    let assignedDistrict = 'all';
    let assignedDistrictId = null;

    // ✅ NATIONAL COMMISSIONER - Can create National or District methods
    if (isNational) {
      if (district && district !== 'all' && district !== 'national' && district !== '') {
        assignedDistrict = district;
        const foundDistrict = await District.findOne({ 
          where: { name: district } 
        });
        if (foundDistrict) {
          assignedDistrictId = foundDistrict.id;
        }
      } else {
        assignedDistrict = 'all';
        assignedDistrictId = null;
      }
    }

    // ✅ DISTRICT COMMISSIONER - Can ONLY create for their district
    if (isDistrict && !isNational) {
      if (!userDistrict) {
        return res.status(400).json({
          success: false,
          message: 'You are not assigned to any district'
        });
      }
      assignedDistrict = userDistrict;
      const foundDistrict = await District.findOne({ 
        where: { name: userDistrict } 
      });
      if (foundDistrict) {
        assignedDistrictId = foundDistrict.id;
      }
    }

    // ✅ Check if method already exists in this district
    const existingMethod = await PaymentMethod.findOne({ 
      where: { 
        name: name.trim(),
        district: assignedDistrict 
      } 
    });
    
    if (existingMethod) {
      return res.status(400).json({
        success: false,
        message: `Payment method "${name}" already exists in ${assignedDistrict === 'all' ? 'National' : assignedDistrict}`
      });
    }

    // ✅ Create the payment method
    const method = await PaymentMethod.create({
      name: name.trim(),
      display_name: display_name || name,
      description: description || '',
      bank_name: bank_name || null,
      account_holder: account_holder || null,
      account_number: account_number || null,
      swift_code: swift_code || null,
      branch: branch || null,
      provider: provider || null,
      phone_number: phone_number || null,
      ussd_code: ussd_code || null,
      is_active: is_active !== undefined ? is_active : true,
      sort_order: sort_order || 0,
      district: assignedDistrict,
      district_id: assignedDistrictId,
      created_by: user.id
    });

    const level = assignedDistrict === 'all' ? 'National' : assignedDistrict;
    console.log(`✅ ${level} payment method created: ${method.name} by ${user.full_name}`);

    res.status(201).json({
      success: true,
      message: `${level} payment method created successfully`,
      method: {
        id: method.id,
        name: method.name,
        display_name: method.display_name,
        bank_name: method.bank_name,
        account_holder: method.account_holder,
        account_number: method.account_number,
        provider: method.provider,
        phone_number: method.phone_number,
        district: method.district,
        is_active: method.is_active
      }
    });
  } catch (error) {
    console.error('❌ Create payment method error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'A payment method with this name already exists in this district. Please use a different name.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create payment method: ' + error.message,
      error: error.message
    });
  }
};

// ============================================
// UPDATE PAYMENT METHOD
// ============================================
exports.updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const user = req.user;
    const role = user.role;

    const method = await PaymentMethod.findByPk(id);
    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const isNational = role === 'national_commissioner' || role === 'national-commissioner' || 
                       role === 'super_admin' || role === 'super-admin' || role === 'admin';
    const isDistrict = role === 'district_commissioner' || role === 'district-commissioner';

    if (isDistrict && !isNational) {
      const userDistrict = user.member?.district || user.district;
      if (method.district !== userDistrict) {
        return res.status(403).json({
          success: false,
          message: 'You can only update payment methods in your district'
        });
      }
    }

    await method.update(updateData);

    res.json({
      success: true,
      message: 'Payment method updated successfully',
      method
    });
  } catch (error) {
    console.error('❌ Update payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment method',
      error: error.message
    });
  }
};

// ============================================
// DELETE PAYMENT METHOD
// ============================================
exports.deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const role = user.role;

    const method = await PaymentMethod.findByPk(id);
    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const isNational = role === 'national_commissioner' || role === 'national-commissioner' || 
                       role === 'super_admin' || role === 'super-admin' || role === 'admin';
    const isDistrict = role === 'district_commissioner' || role === 'district-commissioner';

    if (isDistrict && !isNational) {
      const userDistrict = user.member?.district || user.district;
      if (method.district !== userDistrict) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete payment methods in your district'
        });
      }
    }

    const paymentCount = await Payment.count({
      where: { payment_method: method.name }
    });

    if (paymentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete payment method. It is used in ${paymentCount} payment(s).`
      });
    }

    await method.destroy();

    res.json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment method',
      error: error.message
    });
  }
};

// ============================================
// TOGGLE PAYMENT METHOD STATUS
// ============================================
exports.togglePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const user = req.user;
    const role = user.role;

    const method = await PaymentMethod.findByPk(id);
    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const isNational = role === 'national_commissioner' || role === 'national-commissioner' || 
                       role === 'super_admin' || role === 'super-admin' || role === 'admin';
    const isDistrict = role === 'district_commissioner' || role === 'district-commissioner';

    if (isDistrict && !isNational) {
      const userDistrict = user.member?.district || user.district;
      if (method.district !== userDistrict) {
        return res.status(403).json({
          success: false,
          message: 'You can only toggle payment methods in your district'
        });
      }
    }

    await method.update({ 
      is_active: is_active !== undefined ? is_active : !method.is_active 
    });

    res.json({
      success: true,
      message: `Payment method ${method.is_active ? 'activated' : 'deactivated'} successfully`,
      method
    });
  } catch (error) {
    console.error('❌ Toggle payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle payment method',
      error: error.message
    });
  }
};

// ============================================
// GET PAYMENT HISTORY
// ============================================
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const userDistrict = req.user.member?.district || req.user.district;

    let whereClause = { user_id: userId };
    
    // ✅ For District Commissioners, also show district payments
    if (userRole === 'district_commissioner' || userRole === 'district-commissioner') {
      whereClause = {
        [Op.or]: [
          { user_id: userId },
          { district: userDistrict }
        ]
      };
    }
    // ✅ For National Commissioners, show all payments
    else if (userRole === 'national_commissioner' || userRole === 'national-commissioner' || 
             userRole === 'super_admin' || userRole === 'super-admin' || userRole === 'admin') {
      whereClause = {};
    }

    const payments = await Payment.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: 50,
      attributes: [
        'id',
        'reference',
        'invoice',
        'full_name',
        'sin',
        'district',
        'unit',
        'email',
        'phone',
        'service_name',
        'service_level',
        'service_category',
        'amount',
        'payment_method',
        'payment_date',
        'payment_status',
        'evidence_file',
        'verified_by',
        'verified_at',
        'created_at',
        'updated_at'
      ]
    });

    // Format payment data for display
    const formattedPayments = payments.map(p => ({
      id: p.id,
      reference: p.reference,
      invoice: p.invoice,
      memberName: p.full_name,
      sin: p.sin || 'N/A',
      district: p.district || 'N/A',
      unit: p.unit || 'N/A',
      email: p.email || 'N/A',
      phone: p.phone || 'N/A',
      service: p.service_name,
      level: p.service_level || 'National',
      category: p.service_category || 'General',
      amount: parseFloat(p.amount) || 0,
      method: p.payment_method,
      date: p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'N/A',
      status: p.payment_status || 'pending',
      evidence: p.evidence_file,
      verified_by: p.verified_by,
      verified_at: p.verified_at,
      created_at: p.created_at,
      updated_at: p.updated_at
    }));

    res.json({
      success: true,
      payments: formattedPayments,
      total: formattedPayments.length
    });
  } catch (error) {
    console.error('❌ Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment history',
      error: error.message,
      payments: []
    });
  }
};
// src/controllers/paymentController.js

exports.getNewPayments = async (req, res) => {
    try {
        const user = req.user;
        const { limit = 10 } = req.query;
        
        console.log(`📊 Getting new payments for user ${user.id} (${user.role})`);
        
        let whereClause = {};
        
        // ✅ If District Commissioner, filter by their district
        if (user.role === 'district_commissioner') {
            const userDistrict = user?.member?.district || user?.district;
            if (userDistrict) {
                whereClause.district = userDistrict;
                console.log(`🏛️ District Commissioner - filtering by: ${userDistrict}`);
            } else {
                console.warn(`⚠️ District Commissioner ${user.id} has no district`);
                return res.status(400).json({
                    success: false,
                    message: 'District not found for this user'
                });
            }
        }
        
        // ✅ Get recent payments with pending status first
        const payments = await Payment.findAll({
            where: {
                ...whereClause,
                payment_status: {
                    [Op.in]: ['pending', 'pending verification', 'submitted']
                }
            },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit)
            // ✅ REMOVE include if there's no association, or use correct alias
        });
        
        // ✅ If no pending payments, get recent approved ones
        if (payments.length === 0) {
            const recentPayments = await Payment.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit)
                // ✅ REMOVE include if there's no association
            });
            
            return res.json({
                success: true,
                payments: recentPayments,
                total: recentPayments.length,
                message: 'No pending payments found. Showing recent payments.',
                district: whereClause.district || 'National'
            });
        }
        
        res.json({
            success: true,
            payments: payments,
            total: payments.length,
            district: whereClause.district || 'National'
        });
        
    } catch (error) {
        console.error('❌ Error getting new payments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get new payments',
            error: error.message
        });
    }
};

// ============================================
// GET DASHBOARD STATS
// ============================================

exports.getDashboardStats = async (req, res) => {
    try {
        const user = req.user;
        const { type } = req.params; // 'national' or 'district'
        const { district } = req.query;
        
        console.log(`📊 Dashboard stats for: ${type}`);
        console.log(`👤 User: ${user.id} (${user.role})`);
        console.log(`📍 District filter: ${district || 'none'}`);
        
        let whereClause = {};
        
        // ✅ If user is District Commissioner, ALWAYS filter by their district
        if (user.role === 'district_commissioner') {
            const userDistrict = district || user?.member?.district || user?.district;
            if (userDistrict) {
                whereClause.district = userDistrict;
                console.log(`🏛️ District Commissioner - filtering by: ${userDistrict}`);
            } else {
                console.warn(`⚠️ District Commissioner ${user.id} has no district`);
                return res.status(400).json({
                    success: false,
                    message: 'District not found for this user'
                });
            }
        }
        
        // ✅ If type is district and district is provided
        if (type === 'district' && district) {
            whereClause.district = district;
        }
        
        console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));
        
        // ✅ Get stats
        const totalPayments = await Payment.count({ where: whereClause });
        const totalRevenue = await Payment.sum('amount', { where: whereClause });
        const pending = await Payment.count({ 
            where: { 
                ...whereClause, 
                payment_status: { [Op.in]: ['pending', 'pending verification', 'submitted'] }
            }
        });
        const approved = await Payment.count({ 
            where: { 
                ...whereClause, 
                payment_status: { [Op.in]: ['approved', 'verified', 'completed'] }
            }
        });
        const membersPaid = await Payment.count({ 
            where: { 
                ...whereClause, 
                payment_status: { [Op.in]: ['approved', 'verified', 'completed'] }
            },
            distinct: true,
            col: 'member_id'
        });
        
        res.json({
            success: true,
            stats: {
                totalPayments: totalPayments || 0,
                totalRevenue: totalRevenue || 0,
                pending: pending || 0,
                approved: approved || 0,
                membersPaid: membersPaid || 0,
                district: whereClause.district || 'National',
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats',
            error: error.message
        });
    }
};
// ============================================
// GET REVENUE SOURCES
// ============================================
exports.getRevenueSources = async (req, res) => {
  try {
    const { type } = req.params;
    const user = req.user;
    const userDistrict = user.member?.district || user.district;
    const { district } = req.query;
    
    console.log(`📊 Revenue sources for: ${type}`);
    console.log(`👤 User: ${user.id} (${user.role})`);
    console.log(`📍 User district: ${userDistrict}`);
    
    let whereClause = { 
      payment_status: { [Op.in]: ['approved', 'completed', 'verified'] }
    };
    
    // ✅ NATIONAL: Show all or filter by district
    if (type === 'national') {
      if (district) {
        whereClause.district = district;
        console.log(`🌍 Filtering national revenue by district: ${district}`);
      }
      // No additional filter - show all
    }
    // ✅ DISTRICT: Filter by user's district
    else if (type === 'district') {
      let targetDistrict = district || userDistrict;
      if (targetDistrict) {
        whereClause.district = targetDistrict;
        console.log(`🏛️ Filtering district revenue by: ${targetDistrict}`);
      } else {
        return res.json({
          success: true,
          sources: [],
          totalRevenue: 0
        });
      }
    }

    const sources = await Payment.findAll({
      where: whereClause,
      attributes: [
        'service_name',
        'service_level',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      group: ['service_name', 'service_level'],
      order: [[sequelize.literal('total_amount'), 'DESC']]
    });

    const totalRevenue = sources.reduce((sum, s) => sum + parseFloat(s.dataValues.total_amount || 0), 0);

    const formattedSources = sources.map(s => ({
      name: s.dataValues.service_name,
      level: s.dataValues.service_level || 'National',
      count: parseInt(s.dataValues.total_count),
      amount: parseFloat(s.dataValues.total_amount || 0),
      percentage: totalRevenue > 0 ? Math.round((parseFloat(s.dataValues.total_amount || 0) / totalRevenue) * 100) : 0
    }));

    res.json({
      success: true,
      sources: formattedSources,
      totalRevenue: totalRevenue,
      district: whereClause.district || 'All',
      type: type
    });
    
  } catch (error) {
    console.error('❌ Get revenue sources error:', error);
    res.json({
      success: true,
      sources: [],
      totalRevenue: 0
    });
  }
};
// src/controllers/paymentController.js

// ============================================
// GET DASHBOARD PAYMENTS - FIXED FOR DISTRICT
// ============================================
exports.getDashboardPayments = async (req, res) => {
  try {
    const { type } = req.params;
    const user = req.user;
    const userDistrict = user.member?.district || user.district;
    const { limit = 20, offset = 0, district } = req.query;
    
    console.log(`📊 Getting dashboard payments for: ${type}`);
    console.log(`👤 User: ${user.id} (${user.role})`);
    console.log(`📍 User district: ${userDistrict}`);
    console.log(`📍 Filter district: ${district || 'none'}`);
    
    let whereClause = {};
    
    // ✅ If user is District Commissioner, filter by their district AND service_level = 'District'
    if (user.role === 'district_commissioner' || user.role === 'district-commissioner') {
      const targetDistrict = district || userDistrict;
      
      if (!targetDistrict) {
        console.warn(`⚠️ District Commissioner ${user.id} has no district`);
        return res.status(400).json({
          success: false,
          message: 'District not found for this user'
        });
      }
      
      // ✅ FORCE filter by district AND service_level = 'District'
      whereClause = {
        district: targetDistrict,
        service_level: 'District'  // ✅ ONLY show district-level payments
      };
      console.log(`🏛️ District Commissioner - Showing ONLY District-level payments for: ${targetDistrict}`);
    } 
    // ✅ NATIONAL: Only National level payments
    else if (type === 'national') {
      whereClause = {
        [Op.or]: [
          { service_level: 'National' },
          { service_level: null },
          { service_level: '' }
        ]
      };
      
      if (district) {
        whereClause.district = district;
        console.log(`🌍 Filtering national payments by district: ${district}`);
      }
    }
    // ✅ DISTRICT (for non-District Commissioners)
    else if (type === 'district') {
      if (district) {
        whereClause.district = district;
        // ✅ For district dashboard, also filter by service_level = 'District'
        whereClause.service_level = 'District';
        console.log(`📌 Filtering district payments by: ${district}`);
      }
    }
    
    console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));
    
    // ✅ Get payments
    const payments = await Payment.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: [
        'id',
        'sin',
        'full_name',
        'district',
        'service_name',
        'service_level',
        'amount',
        'payment_method',
        'payment_date',
        'payment_status',
        'verified_by',
        'created_at'
      ]
    });
    
    const total = await Payment.count({ where: whereClause });
    
    const formattedPayments = payments.map(p => ({
      id: p.id,
      sin: p.sin || 'N/A',
      memberName: p.full_name,
      district: p.district,
      service: p.service_name,
      service_level: p.service_level,
      amount: parseFloat(p.amount) || 0,
      method: p.payment_method,
      payment_date: p.payment_date,
      status: p.payment_status,
      verified_by: p.verified_by,
      created_at: p.created_at
    }));

    res.json({
      success: true,
      total: total,
      payments: formattedPayments,
      district: whereClause.district || 'National',
      type: type,
      filtered: 'district_level_only'
    });
    
  } catch (error) {
    console.error('❌ Get dashboard payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard payments',
      error: error.message,
      payments: []
    });
  }
};
// src/controllers/paymentController.js

// ============================================
// GET DASHBOARD STATS - FIXED FOR DISTRICT
// ============================================
exports.getDashboardStats = async (req, res) => {
    try {
        const user = req.user;
        const { type } = req.params;
        const { district } = req.query;
        
        console.log(`📊 Dashboard stats for: ${type}`);
        console.log(`👤 User: ${user.id} (${user.role})`);
        console.log(`📍 District filter: ${district || 'none'}`);
        
        let whereClause = {};
        
        // ✅ If user is District Commissioner, filter by their district AND service_level = 'District'
        if (user.role === 'district_commissioner' || user.role === 'district-commissioner') {
            const targetDistrict = district || user?.member?.district || user?.district;
            
            if (!targetDistrict) {
                console.warn(`⚠️ District Commissioner ${user.id} has no district`);
                return res.status(400).json({
                    success: false,
                    message: 'District not found for this user'
                });
            }
            
            // ✅ FORCE filter by district AND service_level = 'District'
            whereClause = {
                district: targetDistrict,
                service_level: 'District'  // ✅ ONLY show district-level payments
            };
            console.log(`🏛️ District Commissioner - Showing ONLY District-level stats for: ${targetDistrict}`);
        } 
        // ✅ NATIONAL: Only National level payments
        else if (type === 'national') {
            whereClause = {
                [Op.or]: [
                    { service_level: 'National' },
                    { service_level: null },
                    { service_level: '' }
                ]
            };
            
            if (district) {
                whereClause.district = district;
                console.log(`🌍 Filtering national stats by district: ${district}`);
            }
        }
        // ✅ DISTRICT (for non-District Commissioners)
        else if (type === 'district') {
            if (district) {
                whereClause.district = district;
                whereClause.service_level = 'District';
                console.log(`📌 Filtering district stats by: ${district}`);
            }
        }
        
        console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));
        
        // ✅ Get stats
        const totalPayments = await Payment.count({ where: whereClause });
        const totalRevenue = await Payment.sum('amount', { where: whereClause });
        const pending = await Payment.count({ 
            where: { 
                ...whereClause, 
                payment_status: { [Op.in]: ['pending', 'pending verification', 'submitted'] }
            }
        });
        const approved = await Payment.count({ 
            where: { 
                ...whereClause, 
                payment_status: { [Op.in]: ['approved', 'verified', 'completed'] }
            }
        });
        const membersPaid = await Payment.count({ 
            where: { 
                ...whereClause, 
                payment_status: { [Op.in]: ['approved', 'verified', 'completed'] }
            },
            distinct: true,
            col: 'member_id'
        });
        
        const displayDistrict = whereClause.district || 'National';
        
        res.json({
            success: true,
            stats: {
                totalPayments: totalPayments || 0,
                totalRevenue: totalRevenue || 0,
                pending: pending || 0,
                approved: approved || 0,
                membersPaid: membersPaid || 0,
                district: displayDistrict,
                role: user.role,
                type: type,
                filtered: 'district_level_only'
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats',
            error: error.message
        });
    }
};
// src/controllers/paymentController.js

// ============================================
// GET REVENUE SOURCES - FIXED FOR DISTRICT
// ============================================
exports.getRevenueSources = async (req, res) => {
  try {
    const { type } = req.params;
    const user = req.user;
    const userDistrict = user.member?.district || user.district;
    const { district } = req.query;
    
    console.log(`📊 Revenue sources for: ${type}`);
    console.log(`👤 User: ${user.id} (${user.role})`);
    console.log(`📍 User district: ${userDistrict}`);
    
    let whereClause = { 
      payment_status: { [Op.in]: ['approved', 'completed', 'verified'] }
    };
    
    // ✅ If user is District Commissioner, filter by their district AND service_level = 'District'
    if (user.role === 'district_commissioner' || user.role === 'district-commissioner') {
      const targetDistrict = district || userDistrict;
      
      if (!targetDistrict) {
        return res.json({
          success: true,
          sources: [],
          totalRevenue: 0
        });
      }
      
      // ✅ FORCE filter by district AND service_level = 'District'
      whereClause = {
        ...whereClause,
        district: targetDistrict,
        service_level: 'District'  // ✅ ONLY show district-level revenue
      };
      console.log(`🏛️ District Commissioner - Showing ONLY District-level revenue for: ${targetDistrict}`);
    } 
    // ✅ NATIONAL: Only National level payments
    else if (type === 'national') {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { service_level: 'National' },
          { service_level: null },
          { service_level: '' }
        ]
      };
      
      if (district) {
        whereClause.district = district;
        console.log(`🌍 Filtering national revenue by district: ${district}`);
      }
    }
    // ✅ DISTRICT (for non-District Commissioners)
    else if (type === 'district') {
      if (district) {
        whereClause.district = district;
        whereClause.service_level = 'District';
        console.log(`📌 Filtering district revenue by: ${district}`);
      }
    }

    const sources = await Payment.findAll({
      where: whereClause,
      attributes: [
        'service_name',
        'service_level',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      group: ['service_name', 'service_level'],
      order: [[sequelize.literal('total_amount'), 'DESC']]
    });

    const totalRevenue = sources.reduce((sum, s) => sum + parseFloat(s.dataValues.total_amount || 0), 0);

    const formattedSources = sources.map(s => ({
      name: s.dataValues.service_name,
      level: s.dataValues.service_level || 'National',
      count: parseInt(s.dataValues.total_count),
      amount: parseFloat(s.dataValues.total_amount || 0),
      percentage: totalRevenue > 0 ? Math.round((parseFloat(s.dataValues.total_amount || 0) / totalRevenue) * 100) : 0
    }));

    res.json({
      success: true,
      sources: formattedSources,
      totalRevenue: totalRevenue,
      district: whereClause.district || 'National',
      type: type,
      filtered: 'district_level_only'
    });
    
  } catch (error) {
    console.error('❌ Get revenue sources error:', error);
    res.json({
      success: true,
      sources: [],
      totalRevenue: 0
    });
  }
};
// ============================================
// CREATE PAYMENT
// ============================================
exports.createPayment = async (req, res) => {
  try {
    const {
      serviceId,
      serviceName,
      serviceLevel,
      serviceCategory,
      amount,
      paymentMethod,
      paymentDate,
      fullName,
      sin,
      district,
      unit,
      email,
      phone,
      userId,
      memberId,
      reference,
      invoice
    } = req.body;

    const finalReference = reference || generateReference(req.user.role);
    const finalInvoice = invoice || generateInvoice();

    let userRecord = null;
    let memberRecord = null;

    if (userId) {
      userRecord = await User.findByPk(userId);
    }
    if (!userRecord) {
      userRecord = req.user;
    }

    if (memberId) {
      memberRecord = await Member.findByPk(memberId);
    }
    if (!memberRecord) {
      memberRecord = await Member.findOne({ where: { user_id: userRecord.id } });
    }

    // ✅ Determine if this is a national or district payment
    const paymentDistrict = district || memberRecord?.district || userRecord.district || 'N/A';
    const paymentLevel = serviceLevel || (paymentDistrict === 'N/A' ? 'National' : 'District');

    // ✅ Handle service_id:
    // - For events (event-{id}): set to NULL
    // - For payment services (numeric ID): use the ID
    // - For membership-fee and donation: set to NULL
    let actualServiceId = null;
    if (serviceId) {
      // ✅ Check if it's an event (format: 'event-53') - set to NULL
      if (typeof serviceId === 'string' && serviceId.startsWith('event-')) {
        actualServiceId = null; // ← IMPORTANT: Set to NULL for events
        console.log('📊 Event payment detected - service_id set to NULL');
      } 
      // ✅ Check if it's a numeric ID (for payment services)
      else if (!isNaN(parseInt(serviceId))) {
        // Verify it exists in payment_services
        const serviceExists = await PaymentService.findByPk(parseInt(serviceId));
        if (serviceExists) {
          actualServiceId = parseInt(serviceId);
        } else {
          actualServiceId = null;
          console.log('⚠️ Service ID not found in payment_services, setting to NULL');
        }
      }
      // For 'membership-fee' and 'donation', keep as null
    }

    console.log('📊 Creating payment:', {
      serviceId,
      actualServiceId,
      serviceName,
      amount,
      paymentMethod,
      isEvent: serviceId?.startsWith('event-')
    });

    const paymentData = {
      reference: finalReference,
      invoice: finalInvoice,
      user_id: userRecord.id,
      member_id: memberRecord?.id || null,
      full_name: fullName || userRecord.full_name,
      sin: sin || memberRecord?.sin || 'N/A',
      district: paymentDistrict,
      unit: unit || memberRecord?.unit || 'N/A',
      email: email || userRecord.email || 'N/A',
      phone: phone || userRecord.phone || 'N/A',
      service_id: actualServiceId, // ✅ NULL for events, valid ID for payment_services
      service_name: serviceName,
      service_level: paymentLevel,
      service_category: serviceCategory || null,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      payment_date: paymentDate || new Date(),
      payment_status: 'pending'
    };

    const payment = await Payment.create(paymentData);

    await Notification.create({
      user_id: userRecord.id,
      title: '💰 Payment Submitted',
      message: `Your payment of ${parseFloat(amount).toLocaleString()} RWF for ${serviceName} has been submitted. Reference: ${finalReference}`,
      type: 'payment',
      link: `/payment/${payment.id}`,
      is_read: false
    });

    console.log(`✅ Payment created: ${finalReference} for ${serviceName} - ${amount} RWF (${paymentLevel})`);

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      payment: {
        id: payment.id,
        reference: finalReference,
        invoice: finalInvoice,
        amount: payment.amount,
        service_name: payment.service_name,
        service_level: payment.service_level,
        payment_status: payment.payment_status
      },
      notificationsSent: 1
    });
  } catch (error) {
    console.error('❌ Create payment error:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment: ' + error.message,
      error: error.message
    });
  }
};
// ============================================
// GET PAYMENT DETAILS
// ============================================
exports.getPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id) || id === 'new' || id === 'undefined' || id === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID'
      });
    }

    const payment = await Payment.findByPk(parseInt(id));

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('❌ Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment details',
      error: error.message
    });
  }
};

// ============================================
// APPROVE PAYMENT
// ============================================
exports.approvePayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID'
      });
    }

    const payment = await Payment.findByPk(parseInt(id));
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    await payment.update({
      payment_status: 'approved',
      verified_by: req.user.id,
      verified_at: new Date()
    });

    await Notification.create({
      user_id: payment.user_id,
      title: '✅ Payment Approved',
      message: `Your payment of ${payment.amount.toLocaleString()} RWF for ${payment.service_name} has been approved.`,
      type: 'payment',
      link: `/payment/${payment.id}`,
      is_read: false
    });

    res.json({
      success: true,
      message: 'Payment approved successfully',
      payment
    });
  } catch (error) {
    console.error('❌ Approve payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve payment',
      error: error.message
    });
  }
};

// ============================================
// REJECT PAYMENT
// ============================================
exports.rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID'
      });
    }

    const payment = await Payment.findByPk(parseInt(id));
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    await payment.update({
      payment_status: 'rejected',
      verified_by: req.user.id,
      verified_at: new Date()
    });

    await Notification.create({
      user_id: payment.user_id,
      title: '❌ Payment Rejected',
      message: `Your payment of ${payment.amount.toLocaleString()} RWF for ${payment.service_name} has been rejected.`,
      type: 'payment',
      link: `/payment/${payment.id}`,
      is_read: false
    });

    res.json({
      success: true,
      message: 'Payment rejected',
      payment
    });
  } catch (error) {
    console.error('❌ Reject payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject payment',
      error: error.message
    });
  }
};

// ============================================
// GET PAYMENT NOTIFICATIONS
// ============================================
exports.getPaymentNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.findAll({
      where: { user_id: userId, type: 'payment' },
      order: [['created_at', 'DESC']],
      limit: 50
    });

    const unreadCount = await Notification.count({
      where: { user_id: userId, type: 'payment', is_read: false }
    });

    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('❌ Get payment notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment notifications',
      error: error.message,
      notifications: []
    });
  }
};

// ============================================
// MARK NOTIFICATION READ
// ============================================
exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      where: { id, user_id: userId }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.update({
      is_read: true,
      read_at: new Date()
    });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('❌ Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};
// ============================================
// GET EVENT FOR PAYMENT
// ============================================
exports.getEventForPayment = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const query = `
      SELECT 
        e.id,
        e.title as name,
        e.description,
        e.event_type as category,
        e.start_date,
        e.end_date,
        e.location,
        e.is_national,
        e.scope,
        e.price as amount,
        e.district_id,
        e.status,
        CASE 
          WHEN er.id IS NOT NULL THEN true 
          ELSE false 
        END as is_registered
      FROM events e
      LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = $1
      WHERE e.id = $2
        AND e.status IN ('upcoming', 'published', 'ongoing')
        AND e.price > 0
    `;

    const result = await sequelize.query(query, {
      bind: [userId, eventId],
      type: sequelize.QueryTypes.SELECT
    });

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or not available for payment'
      });
    }

    const event = result[0];
    let serviceLevel = 'District';
    if (event.is_national === true) {
      serviceLevel = 'National';
    }

    res.json({
      success: true,
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        amount: parseFloat(event.amount) || 0,
        category: event.category || 'event',
        service_level: serviceLevel,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location,
        is_registered: event.is_registered || false,
        status: event.status,
        is_national: event.is_national,
        district_id: event.district_id
      }
    });
  } catch (error) {
    console.error('❌ Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event details'
    });
  }
};
// ============================================
// VERIFY INVOICE BY REFERENCE (Public)
// ============================================
exports.verifyInvoice = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference number is required'
      });
    }

    // ✅ Find payment by reference
    const payment = await Payment.findOne({
      where: { reference: reference },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'email', 'phone']
        },
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'sin', 'district', 'troop_name']
        }
      ]
    });

    if (!payment) {
      // ✅ Return HTML for invalid invoice
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Invoice - MyScout Rwanda</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 500px;
            }
            .icon {
              font-size: 64px;
              color: #D32F2F;
              margin-bottom: 20px;
            }
            h1 {
              color: #D32F2F;
              margin: 0 0 10px;
            }
            p {
              color: #666;
              margin: 10px 0;
            }
            .btn {
              display: inline-block;
              padding: 12px 30px;
              background: #4B2E83;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>INVALID INVOICE</h1>
            <p>This invoice was not created by MyScout Rwanda.</p>
            <p>The payment should not be accepted.</p>
            <a href="https://msr.rw" class="btn">Go to MyScout Rwanda</a>
          </div>
        </body>
        </html>
      `);
    }

    // ✅ Check if payment is approved
    const isApproved = payment.payment_status === 'approved' || 
                       payment.payment_status === 'completed';

    // ✅ Return HTML for valid invoice
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verified Invoice - MyScout Rwanda</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            max-width: 600px;
            width: 100%;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #4B2E83;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #4B2E83;
            margin: 0;
            font-size: 24px;
          }
          .header p {
            color: #666;
            margin: 5px 0 0;
          }
          .verified-badge {
            text-align: center;
            padding: 15px;
            background: ${isApproved ? '#d1fae5' : '#fef3c7'};
            border-radius: 8px;
            margin: 20px 0;
            border: 2px solid ${isApproved ? '#065f46' : '#92400e'};
          }
          .verified-badge .icon {
            font-size: 48px;
          }
          .verified-badge .status {
            font-size: 24px;
            font-weight: bold;
            color: ${isApproved ? '#065f46' : '#92400e'};
          }
          .verified-badge .sub {
            font-size: 14px;
            color: ${isApproved ? '#065f46' : '#92400e'};
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .info-item {
            padding: 10px;
            background: #f8f4ff;
            border-radius: 6px;
            border-left: 3px solid #4B2E83;
          }
          .info-item .label {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .info-item .value {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-top: 2px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #999;
          }
          .btn {
            display: inline-block;
            padding: 10px 24px;
            background: #4B2E83;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🇷🇼 MyScout Rwanda</h1>
            <p>Official Invoice Verification</p>
          </div>

          <div class="verified-badge">
            <div class="icon">${isApproved ? '✅' : '⏳'}</div>
            <div class="status">${isApproved ? 'VERIFIED' : 'PENDING VERIFICATION'}</div>
            <div class="sub">
              ${isApproved 
                ? 'This invoice was officially issued by MyScout Rwanda and has been verified.' 
                : 'This invoice is awaiting verification by RSA Finance.'}
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <div class="label">Invoice Number</div>
              <div class="value">${payment.invoice}</div>
            </div>
            <div class="info-item">
              <div class="label">Reference</div>
              <div class="value">${payment.reference}</div>
            </div>
            <div class="info-item">
              <div class="label">Member Name</div>
              <div class="value">${payment.full_name || payment.user?.full_name || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="label">Scout ID / SIN</div>
              <div class="value">${payment.sin || payment.member?.sin || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="label">District</div>
              <div class="value">${payment.district || payment.member?.district || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="label">Amount</div>
              <div class="value">${parseFloat(payment.amount).toLocaleString()} RWF</div>
            </div>
            <div class="info-item">
              <div class="label">Service</div>
              <div class="value">${payment.service_name}</div>
            </div>
            <div class="info-item">
              <div class="label">Payment Method</div>
              <div class="value">${payment.payment_method}</div>
            </div>
            <div class="info-item" style="grid-column: span 2;">
              <div class="label">Payment Date</div>
              <div class="value">${new Date(payment.payment_date).toLocaleDateString()}</div>
            </div>
          </div>

          ${isApproved ? `
          <div style="text-align: center; padding: 10px; background: #d1fae5; border-radius: 6px;">
            <p style="margin: 0; color: #065f46; font-weight: bold;">
              ✅ This payment has been approved by RSA Finance
            </p>
          </div>
          ` : `
          <div style="text-align: center; padding: 10px; background: #fef3c7; border-radius: 6px;">
            <p style="margin: 0; color: #92400e;">
              ⏳ This payment is pending approval by RSA Finance
            </p>
          </div>
          `}

          <div class="footer">
            <p>© ${new Date().getFullYear()} MyScout Rwanda · Rwanda Scouts Association</p>
            <p>This is a digitally verified invoice. For questions, contact RSA Finance.</p>
            <a href="https://msr.rw" class="btn">MyScout Rwanda</a>
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify invoice',
      error: error.message
    });
  }
};

// ============================================
// GET VERIFICATION STATUS (Authenticated)
// ============================================
exports.getVerificationStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference number is required'
      });
    }

    const payment = await Payment.findOne({
      where: { reference: reference },
      attributes: [
        'id',
        'reference',
        'invoice',
        'full_name',
        'sin',
        'district',
        'service_name',
        'amount',
        'payment_method',
        'payment_date',
        'payment_status',
        'created_at'
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        verified: false,
        invalid: true
      });
    }

    const isApproved = payment.payment_status === 'approved' || 
                       payment.payment_status === 'completed';

    res.json({
      success: true,
      verified: true,
      approved: isApproved,
      payment: {
        reference: payment.reference,
        invoice: payment.invoice,
        memberName: payment.full_name,
        sin: payment.sin,
        district: payment.district,
        service: payment.service_name,
        amount: parseFloat(payment.amount),
        method: payment.payment_method,
        date: payment.payment_date,
        status: payment.payment_status,
        issuedAt: payment.created_at
      }
    });

  } catch (error) {
    console.error('❌ Get verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification status',
      error: error.message
    });
  }
};