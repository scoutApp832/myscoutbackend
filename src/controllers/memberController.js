const { Member, User, AuditLog } = require('../models');
const { generateSIN } = require('../services/sinGenerator');

// Get all members (National Commissioner only)
exports.getAllMembers = async (req, res) => {
  try {
    const { search, district, status } = req.query;
    const where = {};

    if (district && district !== 'all') {
      where.district = district;
    }

    if (status && status !== 'all') {
      where.membership_status = status;
    }

    const members = await Member.findAll({
      where,
      attributes: [
        'id', 
        'sin', 
        'first_name', 
        'last_name', 
        'troop_name',  // ✅ ADD THIS
        'province', 
        'district', 
        'sector', 
        'cell', 
        'village', 
        'gender', 
        'date_of_birth', 
        'membership_status', 
        'fee_status', 
        'payment_status', 
        'scout_id_generated', 
        'profile_image',
        'created_at'
      ],
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'full_name', 'phone', 'status'] }
      ],
      order: [['created_at', 'DESC']]
    });

    // ... rest of the code
  } catch (error) {
    // ...
  }
};

// Get district members (District Commissioner only)
exports.getDistrictMembers = async (req, res) => {
  try {
    const user = req.user;
    const { search } = req.query;

    // Get the district commissioner's member record
    const commissionerMember = await Member.findOne({
      where: { user_id: user.id }
    });

    if (!commissionerMember) {
      return res.status(404).json({ success: false, message: 'Commissioner member record not found' });
    }

    const members = await Member.findAll({
      where: { district: commissionerMember.district },
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'full_name', 'phone', 'status'] }
      ],
      order: [['created_at', 'DESC']]
    });

    let filteredMembers = members;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMembers = members.filter(m => 
        m.sin?.toLowerCase().includes(searchLower) ||
        m.first_name?.toLowerCase().includes(searchLower) ||
        m.last_name?.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      members: filteredMembers
    });

  } catch (error) {
    console.error('Get district members error:', error);
    res.status(500).json({ success: false, message: 'Failed to get members', error: error.message });
  }
};

// Get member by ID
exports.getMemberById = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'full_name', 'phone', 'status'] }
      ]
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json({ success: true, member });

  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ success: false, message: 'Failed to get member', error: error.message });
  }
};

// Create member (National Commissioner only)
exports.createMember = async (req, res) => {
  try {
    const { email, password, fullName, phone, role, ...memberData } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Create user
    const user = await User.create({
      email,
      password_hash: password,
      full_name: fullName,
      phone,
      role: role || 'scout',
      status: 'active'
    });

    // Generate SIN
    const sin = await generateSIN(user.id);

    // Create member
    const member = await Member.create({
      user_id: user.id,
      sin,
      first_name: fullName.split(' ')[0],
      last_name: fullName.split(' ').slice(1).join(' ') || fullName,
      ...memberData,
      membership_status: 'active'
    });

    // Log creation
    await AuditLog.create({
      user_id: req.user.id,
      action: 'create_member',
      entity_type: 'member',
      entity_id: member.id,
      new_value: { email, role }
    });

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      member
    });

  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ success: false, message: 'Failed to create member', error: error.message });
  }
};

// Update member
exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, fullName, phone, ...memberData } = req.body;

    const member = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Update user
    if (email || fullName || phone) {
      await member.user.update({
        email: email || member.user.email,
        full_name: fullName || member.user.full_name,
        phone: phone || member.user.phone
      });
    }

    // Update member
    await member.update(memberData);

    await AuditLog.create({
      user_id: req.user.id,
      action: 'update_member',
      entity_type: 'member',
      entity_id: member.id,
      old_value: { email: member.user.email },
      new_value: { email }
    });

    res.json({
      success: true,
      message: 'Member updated successfully',
      member
    });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ success: false, message: 'Failed to update member', error: error.message });
  }
};

// Delete member
exports.deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Delete user (cascade will delete member)
    await User.destroy({ where: { id: member.user_id } });

    await AuditLog.create({
      user_id: req.user.id,
      action: 'delete_member',
      entity_type: 'member',
      entity_id: id
    });

    res.json({
      success: true,
      message: 'Member deleted successfully'
    });

  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete member', error: error.message });
  }
};

// Toggle member status
exports.toggleMemberStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('🔄 Toggling member status:', { id, status });

    const member = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    await member.update({ membership_status: status });

    if (member.user) {
      await member.user.update({ status: status });
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: 'toggle_member_status',
      entity_type: 'member',
      entity_id: id,
      new_value: { status }
    });

    res.json({
      success: true,
      message: `Member ${status === 'active' ? 'activated' : status === 'inactive' ? 'deactivated' : 'suspended'} successfully`
    });

  } catch (error) {
    console.error('❌ Toggle member status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update status', 
      error: error.message 
    });
  }
};

// Approve membership fee
exports.approveFee = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const feeExpiryDate = new Date();
    feeExpiryDate.setFullYear(feeExpiryDate.getFullYear() + 1);

    await member.update({
      fee_status: 'paid',
      fee_paid_date: new Date(),
      fee_expiry_date: feeExpiryDate
    });

    await AuditLog.create({
      user_id: req.user.id,
      action: 'approve_fee',
      entity_type: 'member',
      entity_id: id
    });

    res.json({
      success: true,
      message: 'Membership fee approved'
    });

  } catch (error) {
    console.error('Approve fee error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve fee', error: error.message });
  }
};

// Generate SIN (controller method)
exports.generateSIN = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (member.sin) {
      return res.status(400).json({ success: false, message: 'SIN already generated' });
    }

    if (member.fee_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Membership fee must be paid first' });
    }

    const sin = await generateSIN(id);
    await member.update({ 
      sin, 
      scout_id_generated: true,
      scout_id_generated_date: new Date()
    });

    await AuditLog.create({
      user_id: req.user.id,
      action: 'generate_sin',
      entity_type: 'member',
      entity_id: id,
      new_value: { sin }
    });

    res.json({
      success: true,
      message: 'SIN generated successfully',
      sin
    });

  } catch (error) {
    console.error('Generate SIN error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate SIN', error: error.message });
  }
};

// ✅ APPROVE PAYMENT - FIXED (uses imported generateSIN)
exports.approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`💰 Approving payment for member ${id}`);
    
    const member = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });
    
    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }
    
    console.log(`📊 Current fee_status: ${member.fee_status}`);
    console.log(`📊 Current sin: ${member.sin}`);
    console.log(`📊 Current scout_id_generated: ${member.scout_id_generated}`);
    
    const updates = {
      fee_status: 'paid',
      payment_status: 'paid',
      payment_approved: true,
      payment_approved_at: new Date(),
      payment_approved_by: req.user?.id || null,
      membership_status: 'active',
      scout_id_generated: true
    };
    
    // If no SIN, generate one
    if (!member.sin) {
      const newSin = await generateSIN(member.user_id);
      updates.sin = newSin;
      console.log(`🆕 Generated new SIN: ${newSin}`);
    }
    
    await member.update(updates);
    await member.reload();
    
    console.log(`✅ Payment approved for member ${id}`);
    console.log(`📊 New fee_status: ${member.fee_status}`);
    console.log(`📊 New sin: ${member.sin}`);
    console.log(`📊 New scout_id_generated: ${member.scout_id_generated}`);
    
    // ✅ Get updated member with user data
    const updatedMember = await Member.findByPk(id, {
      include: [{ model: User, as: 'user' }]
    });
    
    // ✅ SEND SCOUT ID CARD VIA EMAIL
    let emailSent = false;
    let emailError = null;
    try {
      if (updatedMember.user?.email) {
        const emailResult = await sendScoutIDCardEmail(updatedMember);
        emailSent = true;
        console.log(`📧 Scout ID Card email sent to ${updatedMember.user.email}`);
      } else {
        console.warn(`⚠️ No email found for member ${id}`);
      }
    } catch (emailError) {
      console.error('❌ Failed to send Scout ID Card email:', emailError);
      emailError = emailError.message;
      // Don't block the approval if email fails
    }
    
    return res.status(200).json({
      success: true,
      message: 'Payment approved successfully! Scout ID Card is now available.',
      member: updatedMember,
      sinGenerated: !!member.sin,
      emailSent: emailSent,
      emailError: emailError || null
    });
    
  } catch (error) {
    console.error('❌ Payment approval error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to approve payment: ' + error.message 
    });
  }
};

// ==============================================
// ❌ NO duplicate generateSIN function here!
// The function is imported from '../services/sinGenerator'
// ==============================================