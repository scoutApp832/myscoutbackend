const jwt = require('jsonwebtoken');
const { User, Member } = require('../models');
const { JWT_SECRET } = require('../config/auth');

// ==========================================
// Authenticate User
// ==========================================
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findByPk(decoded.id, {
      include: [{ model: Member, as: 'member' }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = user;
    req.district = user.member?.district || null;

    next();
  } catch (error) {
    console.error('❌ Authentication Error:', error);

    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed'
    });
  }
};

// ==========================================
// ✅ SUPER ADMIN ONLY
// ==========================================
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  const allowedRoles = ['super_admin', 'super-admin', 'admin'];

  if (allowedRoles.includes(req.user.role)) {
    console.log(`✅ Super Admin access granted for user ${req.user.id}`);
    return next();
  }

  console.log(`❌ Super Admin access denied for user ${req.user.id} with role ${req.user.role}`);
  return res.status(403).json({
    success: false,
    message: 'Access denied. Only Super Admin can perform this action.'
  });
};

// ==========================================
// ✅ NATIONAL COMMISSIONER OR SUPER ADMIN
// ==========================================
const isNationalCommissioner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  const allowedRoles = [
    'national_commissioner', 
    'national-commissioner', 
    'super_admin', 
    'super-admin', 
    'admin'
  ];

  if (allowedRoles.includes(req.user.role)) {
    console.log(`✅ National Commissioner access granted for user ${req.user.id} with role ${req.user.role}`);
    return next();
  }

  console.log(`❌ National Commissioner access denied for user ${req.user.id} with role ${req.user.role}`);
  return res.status(403).json({
    success: false,
    message: 'Access denied. National Commissioner or Super Admin role required.'
  });
};

// ==========================================
// ✅ DISTRICT COMMISSIONER
// ==========================================
const isDistrictCommissioner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  if (req.user.role === 'super_admin' || 
      req.user.role === 'super-admin' || 
      req.user.role === 'admin') {
    return next();
  }

  const allowedRoles = ['district_commissioner', 'district_commissioner'];
  
  if (allowedRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. District Commissioner role required.'
  });
};

// ==========================================
// ✅ DONOR CHECK
// ==========================================
const isDonor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  if (req.user.role === 'super_admin' || 
      req.user.role === 'super-admin' || 
      req.user.role === 'admin') {
    return next();
  }

  if (req.user.role !== 'donor') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Donor role required.'
    });
  }

  next();
};

// ==========================================
// ✅ SCOUT CHECK
// ==========================================
const isScout = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  if (req.user.role === 'super_admin' || 
      req.user.role === 'super-admin' || 
      req.user.role === 'admin') {
    return next();
  }

  if (req.user.role !== 'scout' && req.user.role !== 'unit_leader') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Scout or Unit Leader only.'
    });
  }

  next();
};

// ==========================================
// ✅ CHECK ROLE
// ==========================================
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (req.user.role === 'super_admin' || 
        req.user.role === 'super-admin' || 
        req.user.role === 'admin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

// ==========================================
// ✅ CHECK PERMISSION - WITH DONOR SUPPORT
// ==========================================
const checkPermission = (moduleKey, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Super Admin bypasses
    if (req.user.role === 'super_admin' || 
        req.user.role === 'super-admin' || 
        req.user.role === 'admin') {
      return next();
    }

    // National Commissioner bypasses
    if (req.user.role === 'national_commissioner' || 
        req.user.role === 'national-commissioner') {
      return next();
    }

    // District Commissioner bypasses
    if (req.user.role === 'district_commissioner' || 
        req.user.role === 'district_commissioner') {
      return next();
    }

    // ✅ DONOR - Allow donor modules
    if (req.user.role === 'donor') {
      const donorModules = ['donations', 'dashboard', 'profile', 'notifications', 'payments', 'projects', 'events'];
      
      if (!donorModules.includes(moduleKey)) {
        return res.status(403).json({
          success: false,
          message: `Donors don't have permission to access ${moduleKey}`
        });
      }

      if (!req.user.permissions) {
        req.user.permissions = {
          modules: {
            donations: ['view', 'create', 'history'],
            dashboard: ['view'],
            profile: ['view', 'edit'],
            notifications: ['view', 'read'],
            payments: ['view', 'create', 'history'],
            projects: ['view', 'support'],
            events: ['view', 'sponsor']
          }
        };
      }
      
      const modules = req.user.permissions.modules || {};
      
      if (!modules[moduleKey]) {
        return res.status(403).json({
          success: false,
          message: `You don't have permission to access ${moduleKey}`
        });
      }

      const actions = modules[moduleKey] || [];
      if (actions.includes(action) || (action === 'view' && actions.includes('view'))) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        message: `You don't have permission to ${action} ${moduleKey}`
      });
    }

    // Other roles
    const permissions = req.user.permissions || {};
    const modules = permissions.modules || {};
    
    if (!modules[moduleKey]) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to access ${moduleKey}`
      });
    }

    const actions = modules[moduleKey] || [];
    if (actions.includes(action)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `You don't have permission to ${action} ${moduleKey}`
    });
  };
};

// ==========================================
// ✅ HAS ANY PERMISSION - WITH DONOR SUPPORT
// ==========================================
const hasAnyPermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  // ✅ Super Admin bypasses
  if (req.user.role === 'super_admin' || 
      req.user.role === 'super-admin' || 
      req.user.role === 'admin') {
    console.log(`✅ Super Admin ${req.user.id} - full access granted`);
    return next();
  }

  // ✅ NATIONAL COMMISSIONER bypasses
  if (req.user.role === 'national_commissioner' || 
      req.user.role === 'national-commissioner') {
    console.log(`✅ National Commissioner ${req.user.id} - full access granted`);
    return next();
  }

  // ✅ DISTRICT COMMISSIONER bypasses
  if (req.user.role === 'district_commissioner' || 
      req.user.role === 'district_commissioner') {
    console.log(`✅ District Commissioner ${req.user.id} - full access granted`);
    return next();
  }

  // ✅ DONOR - Full donor access (BYPASS permission check)
  if (req.user.role === 'donor') {
    console.log(`✅ Donor ${req.user.id} - donor access granted`);
    // Assign donor permissions if none exist
    if (!req.user.permissions || 
        typeof req.user.permissions !== 'object' || 
        !req.user.permissions.modules || 
        Object.keys(req.user.permissions.modules).length === 0) {
      
      req.user.permissions = {
        modules: {
          donations: ['view', 'create', 'history'],
          dashboard: ['view'],
          profile: ['view', 'edit'],
          notifications: ['view', 'read'],
          payments: ['view', 'create', 'history'],
          projects: ['view', 'support'],
          events: ['view', 'sponsor']
        }
      };
      console.log(`✅ Default donor permissions assigned to user ${req.user.id}`);
    }
    return next();
  }

  // ✅ SCOUT - Default access
  if (req.user.role === 'scout') {
    console.log(`✅ Scout ${req.user.id} - default access granted`);
    if (!req.user.permissions || 
        typeof req.user.permissions !== 'object' || 
        !req.user.permissions.modules || 
        Object.keys(req.user.permissions.modules).length === 0) {
      req.user.permissions = {
        modules: {
          courses: ['view', 'enroll'],
          events: ['view', 'register'],
          dashboard: ['view'],
          profile: ['view', 'edit'],
          attendance: ['view'],
          notifications: ['view', 'read']
        },
        assignedDistricts: req.user.member?.district ? [req.user.member.district] : []
      };
      console.log(`✅ Default scout permissions assigned to user ${req.user.id}`);
    }
    return next();
  }

  // ✅ UNIT LEADER - Default access
  if (req.user.role === 'unit_leader' || req.user.role === 'unit-leader') {
    console.log(`✅ Unit Leader ${req.user.id} - default access granted`);
    if (!req.user.permissions || 
        typeof req.user.permissions !== 'object' || 
        !req.user.permissions.modules || 
        Object.keys(req.user.permissions.modules).length === 0) {
      req.user.permissions = {
        modules: {
          courses: ['view', 'enroll'],
          events: ['view', 'register', 'create'],
          dashboard: ['view'],
          profile: ['view', 'edit'],
          attendance: ['view', 'manage'],
          members: ['view'],
          donations: ['view'],
          ideas: ['view', 'create', 'edit', 'delete', 'forward'],
          reports: ['view', 'create', 'edit', 'submit'],
          notifications: ['view', 'read']
        },
        assignedDistricts: req.user.member?.district ? [req.user.member.district] : []
      };
      console.log(`✅ Default unit leader permissions assigned to user ${req.user.id}`);
    }
    return next();
  }

  // ✅ For other roles, check permissions
  const permissions = req.user.permissions || {};
  const modules = permissions.modules || {};
  
  let totalActions = 0;
  let moduleCount = 0;
  
  Object.keys(modules).forEach(moduleKey => {
    const actions = modules[moduleKey] || [];
    if (Array.isArray(actions) && actions.length > 0) {
      totalActions += actions.length;
      moduleCount++;
    }
  });

  console.log(`🔍 User ${req.user.id} has ${moduleCount} modules with ${totalActions} total actions`);

  if (totalActions === 0) {
    console.log(`❌ User ${req.user.id} has NO permissions. Access denied.`);
    return res.status(403).json({
      success: false,
      message: 'Access denied. You have no permissions assigned. Please contact your administrator.'
    });
  }

  console.log(`✅ User ${req.user.id} has ${totalActions} permissions across ${moduleCount} modules`);
  next();
};

// ==========================================
// ✅ HAS DISTRICT
// ==========================================
const hasDistrict = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }

  const district = req.user.member?.district || req.user.district;

  if (!district) {
    return res.status(400).json({
      success: false,
      message: 'No district assigned to your account. Please contact administrator.'
    });
  }

  req.district = district;
  next();
};

// ==========================================
// EXPORT ALL
// ==========================================
module.exports = {
    protect,
    checkRole,
    checkPermission,

    isSuperAdmin,
    isNationalCommissioner,
    isDistrictCommissioner,
    isScout,
    isDonor,  // ✅ Added donor

    hasAnyPermission,
    hasDistrict,

    authenticate: protect,
    authenticateToken: protect,
    authorize: checkRole,
    requireRole: checkRole,
    requirePermission: checkPermission
};