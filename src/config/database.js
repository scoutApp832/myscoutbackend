const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'msr_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',

    logging:
      process.env.NODE_ENV === 'production'
        ? false
        : console.log,

    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000
    },

    dialectOptions: {
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              require: true,
              rejectUnauthorized: false
            }
          : false,

      connectTimeout: 60000
    },

    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      freezeTableName: true
    }
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();

    // Temporary verification: show which database the backend is actually using.
    const [result] = await sequelize.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        inet_server_addr() AS server
    `);

    console.log('🔎 Backend database:', result[0]);

    console.log('✅ Database connection established successfully.');

    return true;
  } catch (error) {
    console.error(
      '❌ Unable to connect to the database:',
      error.message
    );

    return false;
  }
}

/*
 * Export the Sequelize instance directly.
 * This avoids CommonJS/Rolldown interop problems on Vercel.
 */
module.exports = sequelize;
module.exports.sequelize = sequelize;
module.exports.testConnection = testConnection;
