require("dotenv").config();
const app = require("./src/app");
const connectMongoDB = require("./src/config/db.mongo");
const { connectDB, sequelize } = require("./src/config/db.postgres");

const PORT = process.env.PORT || 5000;

let isConnected = false; // Fixed the slight typo here just in case!

// Connect to Databases and Start Server
const startServer = async () => {
  try {
    // 1. Connect MongoDB
    await connectMongoDB();

    // 2. Connect PostgreSQL (Supabase)
    await connectDB();

    // 3. Sync Tables
    console.log("🔄 Syncing Database Schema with Supabase...");
    await sequelize.sync({ alter: true });
    console.log("✅ Supabase Tables Synced Successfully");

    // 4. Start Express Server (UPDATED FOR MOBILE ACCESS)
    // Adding "0.0.0.0" forces the server to accept connections from any device on your Wi-Fi
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
      );
      console.log(`📱 To access on mobile, point your frontend to: http://<YOUR_PC_IP_ADDRESS>:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();