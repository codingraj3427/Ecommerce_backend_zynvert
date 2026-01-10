require('dotenv').config();
const app = require('./src/app');
const connectMongoDB = require('./src/config/db.mongo');

// ✅ UPDATED IMPORT: We import 'connectDB' and 'sequelize'
const { connectDB, sequelize } = require('./src/config/db.postgres');

// const PORT = process.env.PORT || 5000;

let isConnected=false;

// Connect to Databases
// const startServer = async () => {
//   try {
//     // 1. Connect MongoDB
//     await connectMongoDB();

//     // 2. Connect PostgreSQL (Supabase)
//     await connectDB();

//     // 3. Sync Tables (✅ CRITICAL FOR FIRST RUN)
//     // Since Supabase is empty, this command creates all your tables (Users, Orders, Inventory, etc.)
//     console.log("🔄 Syncing Database Schema with Supabase...");
//     await sequelize.sync({ alter: true }); 
//     console.log("✅ Supabase Tables Synced Successfully");

//     // 4. Start Express Server
//     app.listen(PORT, () => {
//       console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
//     });
//   } catch (error) {
//     console.error('❌ Server startup failed:', error);
//     process.exit(1);
//   }
// };


// This is for deloying the  server into vercel
async function init() {
  if (isConnected) return; // Prevent reconnecting on every function invocation

  try {
    console.log("⏳ Connecting to Databases...");

    await connectMongoDB();
    await connectDB();

    console.log("🔄 Syncing Supabase Schema...");
    await sequelize.sync({ alter: true });

    console.log("✅ Databases Connected & Synced");

    isConnected = true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
  }
}

module.exports = async (req, res) => {
  await init();      // Ensure DB connection before handling request
  return app(req, res);
};




// startServer();