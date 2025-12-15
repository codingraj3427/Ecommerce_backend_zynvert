const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/categories', productController.getCategories);
router.get('/featured', productController.getFeaturedProducts);
router.get('/:id', productController.getProductById);
router.get(
  "/display/:flag",
  productController.getProductsByDisplayFlag
);

module.exports = router;