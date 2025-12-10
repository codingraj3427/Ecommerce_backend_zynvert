// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middlewares/authMiddleware');
const verifyAdmin = require('../middlewares/adminMiddleware');
const auditLogger = require('../middlewares/auditLogMiddleware');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const upload = require("../middlewares/upload");

// All admin routes need: valid Firebase token + is_admin = true
router.use(verifyToken, verifyAdmin);

// ==========================
// PRODUCT & INVENTORY
// ==========================

// Create product (Postgres + Mongo)
router.post(
  '/products',
  auditLogger('CREATE_PRODUCT'),
  adminController.createProduct
);

// List all products (with inventory)
router.get('/products', adminController.getAllProducts);

// Get single product with inventory
router.get('/products/:id', adminController.getProductById);

// Update product details (Mongo only or combined as you implemented)
router.put(
  '/products/:id',
  auditLogger('UPDATE_PRODUCT'),
  adminController.updateProductDetails
);

// Delete product
router.delete(
  '/products/:id',
  auditLogger('DELETE_PRODUCT'),
  adminController.deleteProduct
);

// ==========================
// ORDERS
// ==========================

router.get('/orders', adminController.getAllOrders);
router.get('/orders/:id', adminController.getOrderById);

router.put(
  '/orders/:id/status',
  auditLogger('UPDATE_ORDER_STATUS'),
  adminController.updateOrderStatus
);


// ==========================
// CUSTOMERS
// ==========================

router.get('/customers', adminController.getAllCustomers);

// ==========================
// CATEGORIES (Mongo)
// ==========================

router.post(
  '/categories',
  auditLogger('CREATE_CATEGORY'),
  adminController.createCategory
);
router.get('/categories', adminController.getAllCategories);
router.put(
  '/categories/:id',
  auditLogger('UPDATE_CATEGORY'),
  adminController.updateCategory
);
router.delete(
  '/categories/:id',
  auditLogger('DELETE_CATEGORY'),
  adminController.deleteCategory
);

// ==========================
// ANALYTICS & REVENUE
// ==========================

// High-level stats (revenue, orders, customers, AOV)
router.get('/analytics/overview', adminAnalyticsController.getOverviewStats);

// Revenue and orders grouped by day (for charts)
router.get('/analytics/revenue-by-day', adminAnalyticsController.getRevenueByDay);

// Top products by revenue / quantity
router.get('/analytics/top-products', adminAnalyticsController.getTopProducts);

// Top customers by spend (optional)
router.get('/analytics/top-customers', adminAnalyticsController.getTopCustomers);

//Uplaod Image Route is here
// Upload a single product image to Cloudinary and return its URL
router.post(
  "/products/upload-image",
  upload.single("image"),
  adminController.uploadProductImage
);

// Delete a single product image (Cloudinary + Mongo)
router.delete(
  "/products/:productId/images",
  adminController.deleteProductImage
);



module.exports = router;
