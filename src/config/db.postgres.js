const { Sequelize } = require('sequelize');
require('dotenv').config();

// ✅ Pass the entire connection string directly
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    // ⚠️ CRITICAL for Transaction Pooler (Port 6543)
    // This fixes the "prepared statement" errors you might get with the pooler
    prepare: false, 
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL Connected to Supabase (Pooler) successfully.');
  } catch (error) {
    console.error('❌ PostgreSQL Connection Error:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };




















// const { Sequelize } = require('sequelize');
// require('dotenv').config();

// const sequelize = new Sequelize(process.env.POSTGRES_URI, {
//   dialect: 'postgres',
//   logging: false, // Set to console.log to see SQL queries
//   pool: {
//     max: 5,
//     min: 0,
//     acquire: 30000,
//     idle: 10000,
//   },
// });

// const connectPostgres = async () => {
//   try {
//     await sequelize.authenticate();
//     console.log('✅ PostgreSQL Connected');
//     // Sync models (use { force: true } only for development to drop/recreate tables)
//     await sequelize.sync({ alter: true }); 
//     console.log('✅ PostgreSQL Models Synced');
//   } catch (error) {
//     console.error('❌ PostgreSQL Connection Error:', error);
//     process.exit(1);
//   }
// };

// module.exports = { sequelize, connectPostgres };