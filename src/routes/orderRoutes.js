const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// ❌ OLD (Caused Error if export is default):
// const { verifyToken } = require('../middlewares/authMiddleware');

// ✅ NEW (Correct based on your CartRoute.js):
const verifyToken = require("../middlewares/authMiddleware");

// 🔐 Protect ALL order routes
// This was crashing because verifyToken was undefined. Now it should work.
router.use(verifyToken);

/* ============================================================
   ✅ 1. GET ALL ORDERS FOR CURRENT USER
   Usage: GET /api/orders
   ============================================================ */
router.get("/", orderController.getMyOrders);

/* ============================================================
   ✅ 2. GET SINGLE ORDER DETAILS
   Usage: GET /api/orders/:id
   ============================================================ */
router.get("/:id", orderController.getOrderById);

// ✅ NEW: The Cancellation Route
router.put("/:id/cancel", verifyToken, orderController.cancelOrder);

// Add this with your other order routes
router.put("/:id/fail", verifyToken, orderController.markPaymentFailed);


module.exports = router;
