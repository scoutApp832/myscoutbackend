const { sequelize } = require('../src/config/database');
const { Member, User } = require('../src/models');

const migrateSIN = async () => {
  try {
    console.log('🔄 Adding SIN to existing members...');

    // Get all members without SIN
    const members = await Member.findAll({
      where: { sin: null }
    });

    console.log(`📊 Found ${members.length} members without SIN`);

    for (const member of members) {
      // Generate unique SIN
      let sin;
      let exists = true;
      let attempts = 0;

      while (exists && attempts < 100) {
        const random = Math.floor(100000 + Math.random() * 900000);
        sin = `MSR${random}`;
        const existing = await Member.findOne({ where: { sin } });
        exists = !!existing;
        attempts++;
      }

      if (sin) {
        await member.update({ sin });
        console.log(`✅ Updated member ${member.id} with SIN: ${sin}`);
      }
    }

    console.log('🎉 Migration complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateSIN();