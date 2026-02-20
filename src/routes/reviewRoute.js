const express = require("express");
const router = express.Router();

const reviewController = require("../controllers/reviewController");
const authMiddleware = require("../middlewares/authMiddleware"); // adjust path
const upload = require("../middlewares/upload");

// ADD REVIEW
router.post(
  "/:productId",
  authMiddleware,
  (req, res, next) => {
    req.uploadFolder = "reviews"; // 🔥 tells upload.js to use reviews folder
    next();
  },
  upload.single("image"),
  reviewController.addReview
);

// GET REVIEWS
router.get("/:productId", reviewController.getProductReviews);

module.exports = router;
