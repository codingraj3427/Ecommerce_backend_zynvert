// routes/batteryRoute.js
const express = require("express");
const router = express.Router();
const batteryController = require('../controllers/batteryController'); // Ensure path matches your file structure

// Existing calculation route
router.post("/estimate", batteryController.calculateBatteryCost);

// ⭐️ NEW: Email sending route
router.post("/send-inquiry", batteryController.sendInquiry);

module.exports = router;