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

