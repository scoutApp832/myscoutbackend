const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/config/database');
const { User, Member } = require('../src/models');

const createNationalCommissioner = async () => {
  try {
    console.log('🔄 Creating National Commissioner...');

    // Check if already exists
    const existing = await User.findOne({ where: { email: 'national@msr.rw' } });
    if (existing) {
      console.log('✅ National Commissioner already exists!');
      console.log(`📧 Email: ${existing.email}`);
      console.log(`👤 Name: ${existing.full_name}`);
      console.log(`🔑 Password: National@2026`);
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('National@2026', salt);

    // Create user
    const user = await User.create({
      email: 'national@msr.rw',
      password_hash: hashedPassword,
      full_name: 'National Commissioner',
      role: 'national_commissioner',
      status: 'active',
      email_verified: true
    });

    console.log('✅ User created:', user.email);

    // Generate SIN
    const sin = `MSR${Math.floor(100000 + Math.random() * 900000)}`;

    // Create member profile
    const member = await Member.create({
      user_id: user.id,
      sin: sin,
      first_name: 'National',
      last_name: 'Commissioner',
      membership_status: 'active',
      district: 'Kigali',
      province: 'Kigali City'
    });

    console.log('✅ Member profile created with SIN:', sin);

    console.log('\n🎉 National Commissioner created successfully!');
    console.log('=' .repeat(40));
    console.log('📧 Email: national@msr.rw');
    console.log('🔑 Password: National@2026');
    console.log('🆔 SIN:', sin);
    console.log('=' .repeat(40));
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createNationalCommissioner();