const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const verifyToken = require('../middlewares/authMiddleware'); // Protected Routes

// All cart operations require the user to be logged in
router.use(verifyToken);

// 1. Get the current user's cart
router.get('/', cartController.getCart);

// 2. Add an item to the cart (or update quantity if exists)
router.post('/items', cartController.addToCart);

// 3. Update item quantity (e.g., change from 1 to 2)
router.put('/items/:itemId', cartController.updateCartItem);

// 4. Remove an item from the cart
router.delete('/items/:itemId', cartController.removeCartItem);

// 5. Clear the entire cart (e.g., after checkout)
router.delete('/', cartController.clearCart);

module.exports = router;