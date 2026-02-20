const Product = require("../models/mongo/Product");

/* ===============================
   ADD REVIEW
================================= */
exports.addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment, name } = req.body;

    const product = await Product.findOne({ product_id: productId });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Prevent duplicate review
    const alreadyReviewed = product.reviews.find(
      (r) => r.user_id === req.user.uid,

    );

    if (alreadyReviewed) {
      return res.status(400).json({
        message: "You already reviewed this product",
      });
    }

     const review = {
      user_id: req.user.uid,   // 🔥 FIXED HERE
      name: req.user.name || "User",
      rating: Number(req.body.rating),
      comment: req.body.comment,
      image: req.file ? req.file.path : "",
    };

    product.reviews.push(review);

    // Recalculate rating
    product.total_reviews = product.reviews.length;

    product.average_rating =
      product.reviews.reduce((acc, item) => acc + item.rating, 0) /
      product.total_reviews;

    await product.save();

    res.status(201).json(product);

  } catch (error) {
    console.error("addReview error:", error);
    res.status(500).json({ message: "Failed to add review" });
  }
};


/* ===============================
   GET REVIEWS
================================= */
exports.getProductReviews = async (req, res) => {
  try {
    const product = await Product.findOne({
      product_id: req.params.productId,
    }).select("reviews average_rating total_reviews");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};
