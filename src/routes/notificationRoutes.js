// src/routes/notification.routes.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// POST /api/notifications/notify-me
router.post("/notify-me", notificationController.requestRestockNotification);

module.exports = router;