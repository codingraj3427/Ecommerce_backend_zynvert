const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// ❌ OLD (Caused Error if export is default): 
// const { verifyToken } = require('../middlewares/authMiddleware'); 

// ✅ NEW (Correct based on your CartRoute.js):
const verifyToken = require('../middlewares/authMiddleware'); 

// 🔐 Protect ALL order routes
// This was crashing because verifyToken was undefined. Now it should work.
router.use(verifyToken);

/* ============================================================
   ✅ 1. GET ALL ORDERS FOR CURRENT USER
   Usage: GET /api/orders
   ============================================================ */
router.get('/', orderController.getMyOrders);

/* ============================================================
   ✅ 2. GET SINGLE ORDER DETAILS
   Usage: GET /api/orders/:id
   ============================================================ */
router.get('/:id', orderController.getOrderById);

module.exports = router;