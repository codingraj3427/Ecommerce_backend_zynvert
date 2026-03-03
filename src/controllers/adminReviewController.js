const Product = require("../models/mongo/Product");

/* =================================================
   GET ALL PRODUCT REVIEWS (Admin Dashboard View)
================================================= */
exports.getAllReviews = async (req, res) => {
  try {
    console.log("Fetching admin reviews...");

    const products = await Product.find(
      {},
      {
        product_id: 1,
        name: 1,
        average_rating: 1,
        total_reviews: 1,
        reviews: 1,
      },
    ).lean();

    // Only return products that actually have reviews
    const productsWithReviews = products.filter(
      (p) => p.reviews && p.reviews.length > 0,
    );

    return res.json(productsWithReviews);
  } catch (error) {
    console.error("getAllReviews error:", error);
    return res.status(500).json({
      message: "Failed to load reviews",
      error: error.message,
    });
  }
};
/* =================================================
   DELETE REVIEW (Admin Only)
================================================= */
exports.deleteReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;

    const product = await Product.findOne({ product_id: productId });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.reviews = product.reviews.filter(
      (r) => r._id.toString() !== reviewId,
    );

    product.total_reviews = product.reviews.length;

    product.average_rating =
      product.total_reviews === 0
        ? 0
        : product.reviews.reduce((acc, r) => acc + r.rating, 0) /
          product.total_reviews;

    await product.save();

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("deleteReview error:", error);
    res.status(500).json({ message: "Failed to delete review" });
  }
};

/* =================================================
   UPDATE REVIEW (Admin Only)
================================================= */
exports.updateReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const { rating, comment } = req.body;

    const product = await Product.findOne({ product_id: productId });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const review = product.reviews.id(reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (rating !== undefined) review.rating = Number(rating);
    if (comment !== undefined) review.comment = comment;

    product.average_rating =
      product.reviews.reduce((acc, r) => acc + r.rating, 0) /
      product.reviews.length;

    await product.save();

    res.json({ message: "Review updated successfully" });
  } catch (error) {
    console.error("updateReview error:", error);
    res.status(500).json({ message: "Failed to update review" });
  }
};
