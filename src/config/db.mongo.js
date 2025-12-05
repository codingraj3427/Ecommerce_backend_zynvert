const mongoose = require('mongoose');
require('dotenv').config(); // Ensure env vars are loaded

const connectMongoDB = async () => {
  try {
    // Connect using the MONGO_URI from your .env file
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Exit process with failure so you know it didn't connect
    process.exit(1);
  }
};

module.exports = connectMongoDB;