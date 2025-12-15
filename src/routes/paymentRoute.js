const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const paymentController = require("../controllers/paymentController");

router.post(
  "/create-checkout-session",
  verifyToken,
  paymentController.createCheckoutSession
);

// ✅ Protect this route so req.user works
router.post('/confirm', verifyToken, paymentController.confirmPayment);


module.exports = router;
