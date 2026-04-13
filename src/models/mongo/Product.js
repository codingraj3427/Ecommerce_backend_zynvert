const mongoose = require("mongoose");

// Define the embedded review schema first
const reviewSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true },
  image: { type: String },
  date: { type: Date, default: Date.now },
});

const productSchema = new mongoose.Schema(
  {
    product_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ✅ ADDED SKU HERE
    sku: {
      type: String,
      trim: true,
      index: true, // Indexed so admin/users can quickly search by SKU
    },

    category_id: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    stock_level: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    price_display: {
      type: Number,
      required: true,
    },

    old_price: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ✅ NEW LEGAL & TAX FIELDS FOR MONGO
    base_price: {
      type: Number,
      required: true,
      default: 0,
    },
    hsn_code: {
      type: String,
      required: true,
      trim: true,
    },
    gst_rate: {
      type: Number,
      required: true,
      default: 18,
    },
    country_of_origin: {
      type: String,
      required: true,
      default: "India",
    },

    images: [
      {
        type: String,
        required: true,
      },
    ],

    technical_specs: {
      type: Map,
      of: String,
    },

    display_flags: [
      {
        type: String,
      },
    ],
    is_visible: {
      type: Boolean,
      default: false,
      index: true, // Indexed so the storefront can quickly filter visible products
    },

    reviews: [reviewSchema],
    average_rating: {
      type: Number,
      default: 0,
    },

    total_reviews: {
      type: Number,
      default: 0,
    },
    product_dimension: {
      type: String, // e.g., "30x20x15 cm"
      default: "",
    },
    product_weight: {
      type: Number, // e.g., 15.5 (in kg)
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

/* ======================================
   🔥 AUTO PRICE HISTORY HANDLER
====================================== */
productSchema.pre("save", async function () {
  if (this.isModified("price_display") && !this.isNew) {
    this.old_price = this.old_price || this.$__.priorDoc?.price_display || 0;
  }
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
