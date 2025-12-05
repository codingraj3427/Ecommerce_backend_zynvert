const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
// const authMiddleware = require('../middlewares/authMiddleware'); // Uncomment when Auth is ready

// router.use(authMiddleware); // Protect all order routes

router.post('/create', orderController.createOrder);
router.post('/verify', orderController.verifyPayment);

module.exports = router;