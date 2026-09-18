const { sequelize } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

const setupDatabase = async () => {
  try {
    console.log('🔄 Running complete database setup...');
    
    const sqlPath = path.join(__dirname, 'complete-db-setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into statements and execute
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await sequelize.query(stmt);
      }
    }
    
    console.log('✅ Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

setupDatabase();