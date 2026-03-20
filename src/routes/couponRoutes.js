// src/routes/couponRoutes.js
const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');

// ⚠️ IMPORTANT: Replace this line with however you normally import your auth middleware!
// For example, it might be: const verifyToken = require('../middleware/auth');
const verifyToken  = require('../middlewares/authMiddleware'); 

router.post('/validate', verifyToken, couponController.validateCoupon);

module.exports = router;