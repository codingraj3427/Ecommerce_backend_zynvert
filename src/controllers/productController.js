const Product = require("../models/mongo/Product");
const Category = require("../models/mongo/Category");

// Get all categories (for Homepage Cards)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ is_popular: true }).sort({
      sort_order: 1,
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Featured Products
exports.getFeaturedProducts = async (req, res) => {
  try {
    // ✅ ADDED is_visible: true
    const products = await Product.find({
      display_flags: "featured",
      is_visible: true,
    }).limit(10);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Product Detail
exports.getProductById = async (req, res) => {
  try {
    // ✅ ADDED is_visible: true (Returns 404 if a user tries to access a hidden product directly via URL)
    const product = await Product.findOne({
      product_id: req.params.id,
      is_visible: true,
    });

    if (!product)
      return res
        .status(404)
        .json({ message: "Product not found or unavailable" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProductsByDisplayFlag = async (req, res) => {
  try {
    const { flag } = req.params;
    const flags = flag.split(",");

    const products = await Product.find({
      display_flags: { $in: flags },
      is_visible: true,
    }).select(
      // ✅ Added is_visible to the list below
      "name product_id category_id images old_price price_display display_flags sku stock_level is_visible",
    );

    res.json(products);
  } catch (error) {
    console.error("Display flag fetch error:", error);
    res.status(500).json({
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};
exports.getAllProducts = async (req, res) => {
  try {
    // ✅ ADDED is_visible: true
    const products = await Product.find({ is_visible: true }).sort({
      createdAt: -1,
    }); // newest first

    res.status(200).json(products);
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      message: "Failed to fetch products",
    });
  }
};

// ✅ REWRITTEN TO USE MONGODB TO ENFORCE VISIBILITY
exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    // 1️⃣ Guard clause
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    // 2️⃣ Query MongoDB directly to respect is_visible
    const products = await Product.find({
      is_visible: true,
      $or: [
        { name: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
      ],
    })
      .limit(10)
      .sort({ updatedAt: -1 });

    // Optional: If you need category names, you can do a manual lookup or populate if you setup refs
    // For now, mapping the Category ID is safe, or you can fetch categories manually

    // 3️⃣ Format response (VERY IMPORTANT for frontend)
    const formatted = products.map((p) => ({
      product_id: p.product_id,
      name: p.name,
      sku: p.sku || "",
      current_price: p.price_display, // Mongo schema uses price_display
      image: p.images?.[0] || null,
      stock: p.stock_level, // Mongo schema uses stock_level
      category: p.category_id || null, // Will return the ID, frontend can map it if needed
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("❌ Search Products Error:", error);
    res.status(500).json({ message: "Search failed" });
  }
};
