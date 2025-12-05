const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Razorpay Webhook (Configure this URL in Razorpay Dashboard)
// Endpoint: POST /api/webhooks/razorpay
router.post('/razorpay', webhookController.handleRazorpayWebhook);

// Shipping Webhook (Configure this in ShipStation/ClickPost)
// Endpoint: POST /api/webhooks/shipping
router.post('/shipping', webhookController.handleShippingWebhook);

module.exports = router;