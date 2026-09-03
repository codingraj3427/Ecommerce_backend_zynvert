const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const paymentController = require("../controllers/paymentController");

router.post(
  "/create-checkout-session",
  verifyToken,
  paymentController.createCheckoutSession,
);

router.post("/cod", verifyToken, paymentController.placeCODOrder);
// ✅ ADD THIS ROUTE:
router.get("/emi-plans", paymentController.getEmiPlans);

// ✅ Protect this route so req.user works
router.post("/confirm", verifyToken, paymentController.confirmPayment);

//For retry payment logic
router.post("/:orderId/retry", verifyToken, paymentController.retryPayment);

module.exports = router;
