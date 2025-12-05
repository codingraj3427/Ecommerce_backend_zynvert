const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    category_id: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true 
    }, // e.g., "li-ion-batteries" - Used for URLs and API routing
    
    name: { 
      type: String, 
      required: true 
    }, // Full Name (e.g., "Lithium-Ion Batteries") - Displayed below the card
    
    short_label: { 
      type: String, 
      required: true 
    }, // Short Label (e.g., "Li-Ion") - Displayed INSIDE the colored box
    
    color_hex: { 
      type: String, 
      default: '#000000' 
    }, // Hex Code (e.g., "#F2706D") - Background color of the box
    
    icon_url: { 
      type: String 
    }, // Optional: URL for an icon if needed in the future
    
    is_popular: { 
      type: Boolean, 
      default: false,
      index: true // Indexed for faster homepage queries
    }, // If true, this category appears in the "Popular Categories" row
    
    sort_order: { 
      type: Number, 
      default: 0 
    }, // Controls the display order (1, 2, 3...)
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;