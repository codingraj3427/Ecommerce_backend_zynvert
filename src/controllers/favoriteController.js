// Adjust this path to point to your exported PostgreSQL models
const { Favourite, Inventory } = require("../models/postgres/index");

// ==========================================
// 1. ADD TO FAVOURITES
// ==========================================
exports.addFavourite = async (req, res) => {
  try {
    const { product_id } = req.body;
    const user_id = req.user.uid; // Provided by your verifyToken middleware

    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Optional but recommended: Verify the product actually exists in Inventory
    const productExists = await Inventory.findOne({ where: { product_id } });
    if (!productExists) {
      return res
        .status(404)
        .json({ message: "Product not found in inventory" });
    }

    // findOrCreate prevents duplicates if a user clicks the heart twice quickly
    const [favourite, created] = await Favourite.findOrCreate({
      where: { user_id, product_id },
      defaults: { user_id, product_id },
    });

    if (!created) {
      return res.status(200).json({
        message: "Product is already in your wishlist",
        favourite,
      });
    }

    res.status(201).json({ message: "Added to wishlist", favourite });
  } catch (error) {
    console.error("Add favourite error:", error);
    res
      .status(500)
      .json({ message: "Failed to add to wishlist", error: error.message });
  }
};

// ==========================================
// 2. REMOVE FROM FAVOURITES
// ==========================================
exports.removeFavourite = async (req, res) => {
  try {
    const { product_id } = req.params;
    const user_id = req.user.uid;

    const deletedCount = await Favourite.destroy({
      where: { user_id, product_id },
    });

    if (deletedCount === 0) {
      return res
        .status(404)
        .json({ message: "Product not found in your wishlist" });
    }

    res.status(200).json({ message: "Removed from wishlist" });
  } catch (error) {
    console.error("Remove favourite error:", error);
    res
      .status(500)
      .json({
        message: "Failed to remove from wishlist",
        error: error.message,
      });
  }
};

// ==========================================
// 3. GET ALL FAVOURITES FOR A USER
// ==========================================
exports.getFavourites = async (req, res) => {
  try {
    const user_id = req.user.uid;

    // Fetch favourites and JOIN with the Inventory table to get LIVE data
    const favourites = await Favourite.findAll({
      where: { user_id },
      include: [
        {
          model: Inventory,
          // We only need these specific columns to render the FavouritePage UI
          attributes: [
            "name",
            "sku",
            "current_price",
            "stock_level",
            "image_url",
          ],
        },
      ],
      order: [["createdAt", "DESC"]], // Puts the most recently liked items at the top
    });

    // Format the response to perfectly match what your React frontend expects
    const formattedFavourites = favourites.map((fav) => {
      const inv = fav.Inventory; // The joined inventory data

      return {
        id: fav.product_id, // Mapped to 'id' so your React key={product.id} keeps working
        favourite_id: fav.favourite_id,
        name: inv?.name || "Unknown Product",
        sku: inv?.sku || "N/A",
        price: parseFloat(inv?.current_price) || 0,
        image: inv?.image_url || null,
        stock: inv?.stock_level || 0,
      };
    });

    res.status(200).json(formattedFavourites);
  } catch (error) {
    console.error("Get favourites error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch wishlist", error: error.message });
  }
};
