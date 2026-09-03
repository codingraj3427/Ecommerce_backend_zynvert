const Product = require("../models/mongo/Product");

exports.searchProducts = async (req, res) => {
  try {
    let q = (req.query.q || "").toLowerCase().trim();
    if (!q) return res.json([]);

    // =======================================================
    // 1. THE ADVANCED NORMALIZER (Batteries, Chargers, Inverters)
    // =======================================================

    // 1a. Normalize Voltage: "60 volt", "60volts", "60 v" -> "60v"
    q = q.replace(/(\d+)\s*(volt|volts|v)\b/g, "$1v");

    // 1b. Normalize Power (Inverters): "1000 watt", "1000watts", "1000 w" -> "1000w"
    q = q.replace(/(\d+)\s*(watt|watts|w)\b/g, "$1w");

    // 1c. Normalize Capacity (Batteries): "30 amp hour", "30 ah" -> "30ah"
    // (Do this BEFORE Amps to prevent "amp hour" from becoming "a hour")
    q = q.replace(/(\d+)\s*(ah|amp\s*hour|amp\s*hours)\b/g, "$1ah");

    // 1d. Normalize Current (Chargers): "6 amp", "6 amps", "6 ampere", "6 a" -> "6a"
    q = q.replace(/(\d+)\s*(amp|amps|ampere|amperes|a)\b/g, "$1a");

    // 1e. Normalize Chemistry Typos
    q = q.replace(/life\s*po4/g, "lifepo4");
    q = q.replace(/li\s*ion/g, "lithium");

    // =======================================================
    // 2. BUILD THE DYNAMIC QUERY
    // =======================================================

    // Split the cleaned query into individual words
    const terms = q.split(/\s+/).filter((t) => t.length > 0);

    // Create a strict rule that EVERY typed word must exist SOMEWHERE
    const andConditions = terms.map((term) => {
      // Default: Check if the word is in the Name or Description
      const orBlock = [
        { name: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
      ];

      // VOLTAGE (e.g., "60v")
      const vMatch = term.match(/^(\d+)v$/);
      if (vMatch) {
        orBlock.push({
          "technical_specs.Voltage": { $regex: vMatch[1], $options: "i" },
        });
      }

      // CAPACITY (e.g., "30ah")
      const ahMatch = term.match(/^(\d+)ah$/);
      if (ahMatch) {
        orBlock.push({
          "technical_specs.Capacity": { $regex: ahMatch[1], $options: "i" },
        });
      }

      // CURRENT/AMPS (e.g., "6a")
      const aMatch = term.match(/^(\d+)a$/);
      if (aMatch) {
        orBlock.push({
          "technical_specs.Current": { $regex: aMatch[1], $options: "i" },
        });
        // Layman typo forgiveness: If they typed "30a battery", check Capacity too
        orBlock.push({
          "technical_specs.Capacity": { $regex: aMatch[1], $options: "i" },
        });
      }

      // WATTAGE (e.g., "1000w" for inverters)
      const wMatch = term.match(/^(\d+)w$/);
      if (wMatch) {
        orBlock.push({
          "technical_specs.Wattage": { $regex: wMatch[1], $options: "i" },
        });
        orBlock.push({
          "technical_specs.Power": { $regex: wMatch[1], $options: "i" },
        }); // Fallback if your DB uses 'Power' instead of 'Wattage'
      }

      return { $or: orBlock };
    });

    const mongoQuery = { $and: andConditions };

    // =======================================================
    // 3. FETCH AND RETURN DATA
    // =======================================================

    const products = await Product.find(mongoQuery)
      .select(
        "product_id name price_display old_price images stock_level category_id",
      )
      .limit(10); // Limits to top 10 relevant results for snappy UI dropdowns

    const formatted = products.map((p) => ({
      id: p.product_id,
      name: p.name,
      price: p.price_display,
      oldPrice: p.old_price,
      image: p.images?.[0],
      stock: p.stock_level,
      category: p.category_id,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
};
