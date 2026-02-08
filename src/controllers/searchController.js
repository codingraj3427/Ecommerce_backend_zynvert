const Product = require("../models/mongo/Product");

exports.searchProducts = async (req, res) => {
  try {
    const q = (req.query.q || "").toLowerCase().trim();
    if (!q) return res.json([]);

    // -------- Extract specs from query --------
    const voltageMatch = q.match(/(\d+)\s*v/);     // 12v, 24v
    const ahMatch = q.match(/(\d+)\s*ah/);         // 100ah
    const chemistry =
      q.includes("lifepo4") ? "lifepo4" :
      q.includes("lithium") ? "lithium" :
      null;

    // -------- Build query --------
    const mongoQuery = {
      $and: [
        {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
            { "technical_specs.Voltage": voltageMatch ? { $regex: voltageMatch[1], $options: "i" } : /.*/ },
            { "technical_specs.Capacity": ahMatch ? { $regex: ahMatch[1], $options: "i" } : /.*/ },
          ]
        },
        chemistry
          ? { description: { $regex: chemistry, $options: "i" } }
          : {}
      ]
    };

    const products = await Product.find(mongoQuery)
      .select("product_id name price_display old_price images stock_level category_id")
      .limit(10);

    // -------- Format response for UI --------
    const formatted = products.map(p => ({
      id: p.product_id,
      name: p.name,
      price: p.price_display,
      oldPrice: p.old_price,
      image: p.images?.[0],
      stock: p.stock_level,
      category: p.category_id
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
};
