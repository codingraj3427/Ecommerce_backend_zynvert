const express = require("express");
const router = express.Router();
const favouriteController = require("../controllers/favoriteController");

// Import your exact middleware
const verifyToken = require("../middlewares/authMiddleware"); // Adjust the path if needed

// Apply the middleware to all routes in this file
// This ensures no one can add/view favourites without being logged in
router.use(verifyToken); 

// Your endpoints
router.post("/add", favouriteController.addFavourite);
router.delete("/remove/:product_id", favouriteController.removeFavourite);
router.get("/", favouriteController.getFavourites);

module.exports = router;