const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middlewares/authMiddleware');

// Protected Routes (Require valid Firebase Token)
router.post('/sync', verifyToken, authController.syncUser);
router.get('/me', verifyToken, authController.getProfile);

module.exports = router;