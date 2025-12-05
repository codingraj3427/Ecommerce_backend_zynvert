const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middlewares/authMiddleware');
const verifyAdmin = require('../middlewares/adminMiddleware');

// 🔒 GLOBAL PROTECTION:
// All routes in this file require:
// 1. A valid Firebase Token (verifyToken)
// 2. The user's 'is_admin' flag to be TRUE in Postgres (verifyAdmin)
router.use(verifyToken, verifyAdmin);

// ==========================================
// 📦 PRODUCT & INVENTORY MANAGEMENT
// ==========================================

/**
 * @route   POST /api/admin/products
 * @desc    Create a new product (Syncs MongoDB Catalog + PostgreSQL Inventory)
 */
router.post('/products', adminController.createProduct);

/**
 * @route   PUT /api/admin/products/:id
 * @desc    Update Product Details (MongoDB only - Name, Desc, Images, Specs)
 */
router.put('/products/:id', adminController.updateProductDetails);

/**
 * @route   PUT /api/admin/inventory/:productId
 * @desc    Update Stock Level & Price (PostgreSQL only)
 */
router.put('/inventory/:productId', adminController.updateInventory);

/**
 * @route   DELETE /api/admin/products/:id
 * @desc    Delete a product completely (Removes from both DBs)
 */
router.delete('/products/:id', adminController.deleteProduct);


// ==========================================
// 🚚 ORDER MANAGEMENT
// ==========================================

/**
 * @route   GET /api/admin/orders
 * @desc    Get all orders (with User details)
 */
router.get('/orders', adminController.getAllOrders);

/**
 * @route   PUT /api/admin/orders/:id/status
 * @desc    Update Order Status (e.g., mark as 'Shipped' with tracking number)
 */
router.put('/orders/:id/status', adminController.updateOrderStatus);


// ==========================================
// 👥 USER MANAGEMENT
// ==========================================

/**
 * @route   GET /api/admin/customers
 * @desc    Get list of all registered customers
 */
router.get('/customers', adminController.getAllCustomers);

module.exports = router;