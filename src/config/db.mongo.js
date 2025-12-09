const mongoose = require('mongoose');
require('dotenv').config(); // Ensure env vars are loaded
const default_categories =require('../config/default_categories');
const Category=require('../models/mongo/Category');


async function seedCategoriesIfEmpty() {
  try {
    const count = await Category.countDocuments();
    if (count === 0) {
      console.log("[SEED] Categories collection is empty. Seeding defaults...");
      await Category.insertMany(default_categories);
      console.log("[SEED] Default categories inserted.");
    } else {
      console.log(`[SEED] Categories already exist: ${count} documents.`);
    }
  } catch (err) {
    console.error("[SEED] Error seeding categories:", err.message);
  }
}


const connectMongoDB = async () => {
  try {
    // Connect using the MONGO_URI from your .env file
    const conn = await mongoose.connect(process.env.MONGO_URI);
    await seedCategoriesIfEmpty();
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Exit process with failure so you know it didn't connect
    process.exit(1);
  }
};

module.exports = connectMongoDB;