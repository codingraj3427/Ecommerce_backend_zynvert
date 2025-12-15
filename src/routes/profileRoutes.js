// src/routes/profileRoutes.js
const express = require('express');
const { getProfileDetails, updateProfileDetails, getAddresses, saveAddress,deleteAddress, updateAddress} = require('../controllers/profileController');
// Assuming authMiddleware uses module.exports = authMiddleware;
const authMiddleware = require('../middlewares/authMiddleware'); // ⭐️ FIX: Import the function directly

const router = express.Router();

// Apply authMiddleware to secure all profile routes
router.use(authMiddleware); 

// === PROFILE DETAILS (using /api/profile/details) ===
router.get('/details', getProfileDetails);
router.put('/details', updateProfileDetails);

// === ADDRESS MANAGEMENT (using /api/profile/addresses) ===
router.get('/addresses', getAddresses);
router.post('/addresses', saveAddress);

// ⭐️ NEW ROUTES FOR EDIT/DELETE:
// PUT/PATCH /api/profile/addresses/123
router.put('/addresses/:id', updateAddress); 

// DELETE /api/profile/addresses/123
router.delete('/addresses/:id', deleteAddress);

module.exports = router;



