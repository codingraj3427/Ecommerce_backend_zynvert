const mongoose = require("mongoose");
require("dotenv").config();
const default_categories = require("../config/default_categories"); // Note: ensure the filename matches exactly (defaultCategories vs default_categories)
const Category = require("../models/mongo/Category");

async function syncDefaultCategories() {
  try {
    console.log("[SEED] Syncing default categories...");

    // Loop through your default categories and upsert them
    for (const category of default_categories) {
      await Category.updateOne(
        { category_id: category.category_id }, // Find by category_id
        { $set: category }, // Update with the file's data
        { upsert: true }, // Insert if it doesn't exist
      );
    }

    const count = await Category.countDocuments();
    console.log(`[SEED] Categories synced successfully. Total in DB: ${count}`);
  } catch (err) {
    console.error("[SEED] Error syncing categories:", err.message);
  }
}

const connectMongoDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    await syncDefaultCategories(); // Call the new sync function here
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectMongoDB;
