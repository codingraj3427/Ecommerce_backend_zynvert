// src/controllers/reviewController.js
const Product = require("../models/mongo/Product");

/* ===============================
   ADD OR UPDATE REVIEW (Upsert)
================================= */
exports.addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    const product = await Product.findOne({ product_id: productId });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Find the index of the existing review (if any)
    const existingReviewIndex = product.reviews.findIndex(
      (r) => r.user_id === req.user.uid
    );

    if (existingReviewIndex !== -1) {
      // 🔄 UPDATE EXISTING REVIEW
      product.reviews[existingReviewIndex].rating = Number(rating);
      product.reviews[existingReviewIndex].comment = comment;
      
      // Only update the image if a new one is uploaded
      if (req.file) {
        product.reviews[existingReviewIndex].image = req.file.path;
      }
      
      // Optionally update the name just in case it changed
      product.reviews[existingReviewIndex].name = req.user.name || product.reviews[existingReviewIndex].name;
      
    } else {
      // ➕ ADD NEW REVIEW
      const newReview = {
        user_id: req.user.uid,
        name: req.user.name || "User",
        rating: Number(rating),
        comment: comment,
        image: req.file ? req.file.path : "",
      };
      product.reviews.push(newReview);
    }

    // 🧮 Recalculate ratings
    product.total_reviews = product.reviews.length;
    product.average_rating =
      product.reviews.reduce((acc, item) => acc + item.rating, 0) /
      product.total_reviews;

    await product.save();

    // Send back 200 OK (since it handles both create and update now)
    res.status(200).json(product);

  } catch (error) {
    console.error("addReview error:", error);
    res.status(500).json({ message: "Failed to submit review" });
  }
};

/* ===============================
   GET REVIEWS
================================= */
exports.getProductReviews = async (req, res) => {
  // ... keep your existing getProductReviews code here ...
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