const express = require("express");
const router = express.Router();

const cartController = require("../controllers/cartController");
const verifyToken = require("../middlewares/authMiddleware");

// 🔐 Protect ALL cart routes
router.use(verifyToken);

// ✅ GET /api/cart
router.get("/", cartController.getCart);

// ✅ POST /api/cart/items
router.post("/items", cartController.addToCart);

// ✅ PUT /api/cart/items/:itemId
router.put("/items/:itemId", cartController.updateCartItem);

// ✅ DELETE cart item /api/cart/items/:itemId
router.delete("/items/:itemId", cartController.removeCartItem);

// ✅ DELETE /api/cart
router.delete("/clear", cartController.clearCart);

module.exports = router;
