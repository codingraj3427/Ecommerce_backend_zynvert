const Product = require('../models/mongo/Product');
const Category = require('../models/mongo/Category');


// Get all categories (for Homepage Cards)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ is_popular: true }).sort({ sort_order: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get Featured Products
exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ display_flags: 'featured' }).limit(10);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Product Detail
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ product_id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getProductsByDisplayFlag = async (req, res) => {
  try {
    const { flag } = req.params;

    // support single or multiple flags
    const flags = flag.split(","); // "popular,home" → ["popular","home"]

    const products = await Product.find({
      display_flags: { $in: flags }
    }).select("name product_id category_id images price_display display_flags");
    

    res.json(products);
    console.log(products)
  } catch (error) {
    console.error("Display flag fetch error:", error);
    res.status(500).json({
      message: "Failed to fetch products",
      error: error.message
    });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({})
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json(products);
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      message: "Failed to fetch products",
    });
  }
};







