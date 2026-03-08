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
    const products = await Product.find({ display_flags: "featured" }).limit(
      10,
    );
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Product Detail
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ product_id: req.params.id });
    if (!product) return res.status(404).json({ message: "Product not found" });
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
    }).select(
      // 👇 ADDED sku AND stock HERE 👇
      "name product_id category_id images old_price price_display display_flags sku stock",
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
    const products = await Product.find({}).sort({ createdAt: -1 }); // newest first

    res.status(200).json(products);
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      message: "Failed to fetch products",
    });
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    // 1️⃣ Guard clause
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    // 2️⃣ Query DB
    const products = await Inventory.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { sku: { [Op.iLike]: `%${q}%` } },
        ],
      },
      include: [
        {
          model: Category,
          attributes: ["category_id", "name"],
        },
      ],
      attributes: [
        "product_id",
        "name",
        "sku",
        "current_price",
        "images",
        "stock_level",
      ],
      limit: 10,
      order: [["updatedAt", "DESC"]],
    });

    // 3️⃣ Format response (VERY IMPORTANT for frontend)
    const formatted = products.map((p) => ({
      product_id: p.product_id,
      name: p.name,
      sku: p.sku,
      current_price: p.current_price,
      image: p.images?.[0] || null,
      stock: p.stock_level,
      category: p.Category?.name || null,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("❌ Search Products Error:", error);
    res.status(500).json({ message: "Search failed" });
  }
};
