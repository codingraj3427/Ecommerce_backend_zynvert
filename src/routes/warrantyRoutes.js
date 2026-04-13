// src/routes/warrantyRoutes.js
const express = require("express");
const router = express.Router();
const warrantyController = require("../controllers/warrantyController");

// Public route to check warranty via serial number
// GET /api/warranty/check/:serial_number
router.get("/check/:serial_number", warrantyController.checkWarranty);

module.exports = router;
