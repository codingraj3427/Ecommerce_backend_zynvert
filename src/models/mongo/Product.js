const mongoose = require('mongoose');

// Define the embedded review schema first
// This stores reviews directly inside the product document for fast read access
const reviewSchema = new mongoose.Schema({
  user_id: { 
    type: String, 
    required: true 
  }, // Link to the User in PostgreSQL/Firebase
  
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  }, // 1-5 Star Rating
  
  comment: { 
    type: String, 
    required: true,
    trim: true
  }, // The review text
  
  date: { 
    type: Date, 
    default: Date.now 
  }, // Date of the review
});

const productSchema = new mongoose.Schema(
  {
    product_id: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    }, // CRITICAL: This MUST match the 'product_id' in your PostgreSQL 'inventory' table.
    
    category_id: { 
      type: String, 
      required: true, 
      index: true 
    }, // Links to categories.category_id (e.g., 'li-ion-batteries')
    
    name: { 
      type: String, 
      required: true,
      trim: true
    }, // Product Display Title (e.g., "Zynvert 100Ah")
    
    description: { 
      type: String, 
      required: true 
    }, // Main marketing description
    
    price_display: { 
      type: Number, 
      required: true 
    }, // Cosmetic price for display only. (Actual transactional price is in Postgres)
    
    images: [{ 
      type: String, 
      required: true 
    }], // Array of image URLs (e.g., ["url1.jpg", "url2.jpg"])
    
    // Technical Specs: Flexible Key-Value Pair Object
    // We use 'Map' type to allow dynamic keys like "Voltage", "Weight", "Capacity"
    technical_specs: {
      type: Map,
      of: String, 
    },

    // UI Flags: Used for "Featured Products" or "New Arrivals" sections
    display_flags: [{ 
      type: String 
    }], // e.g., ['featured', 'new', 'bestseller']
    
    reviews: [reviewSchema], // The array of review sub-documents defined above
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;