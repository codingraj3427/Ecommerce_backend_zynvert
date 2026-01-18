const express = require("express");
const router = express.Router();
const batteryEstimator=require('../controllers/batteryController')


router.post("/estimate", batteryEstimator.calculateBatteryCost);

module.exports = router;
