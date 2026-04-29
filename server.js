require("dotenv").config();
const { trusted } = require("mongoose");
const app = require("./src/app");
const connectMongoDB = require("./src/config/db.mongo");
const { connectDB, sequelize } = require("./src/config/db.postgres");

const PORT = process.env.PORT || 5000;

let isConnected = false;

// Connect to Databases and Start Server
const startServer = async () => {
  try {
    // 1. Connect MongoDB
    await connectMongoDB();

    // 2. Connect PostgreSQL (Supabase)
    await connectDB();

    // 3. Conditionally Sync Tables (THIS IS THE FIX)
    // It will ONLY run if you have SYNC_SCHEMA=true in your .env file
    if (process.env.SYNC_SCHEMA === "true") {
      console.log("🔄 Syncing Database Schema with Supabase...");
      await sequelize.sync(true); // You can leave this as true when you actually want to sync
      console.log("✅ Supabase Tables Synced Successfully");
    } else {
      console.log("⏩ Skipping database sync for ultra-fast startup.");
    }

    // 4. Start Express Server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
      );
      console.log(
        `📱 To access on mobile, point your frontend to: http://<YOUR_PC_IP_ADDRESS>:${PORT}`,
      );
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
