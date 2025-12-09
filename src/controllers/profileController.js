// src/controllers/profileController.js
// Use require() to import models based on your index.js 'module.exports'
const db = require('../models/postgres/index'); 
const { User, Address } = db; 

// ===============================================
// PROFILE MANAGEMENT (User Table)
// ===============================================

/**
 * GET /api/profile/details
 * Fetches user profile data from the Postgres 'users' table.
 */
exports.getProfileDetails = async (req, res) => {
    // Firebase UID (req.user is populated by authMiddleware)
    const userId = req.user.uid; 

    try {
        // Find user details, selecting only the necessary columns
        const userResult = await User.findOne({
            where: { user_id: userId },
            attributes: ['email', 'first_name', 'last_name', 'phone_number']
        });

        if (!userResult) {
            // Should not happen if user registration/sync works, but handle gracefully
            return res.status(404).json({ message: "User profile not found in database." });
        }
        
        // Map Sequelize result (snake_case) to camelCase for the frontend
        return res.status(200).json({
            email: userResult.email,
            firstName: userResult.first_name,
            lastName: userResult.last_name,
            phone: userResult.phone_number,
        });

    } catch (error) {
        console.error("Database Error fetching profile:", error);
        return res.status(500).json({ message: "Failed to fetch profile details." });
    }
};

/**
 * PUT /api/profile/details
 * Updates user profile details (first_name, last_name, phone_number).
 */
exports.updateProfileDetails = async (req, res) => {
    const userId = req.user.uid;
    const { firstName, lastName, phone } = req.body; 

    try {
        // Update the 'users' table
        const [updatedRowsCount] = await User.update(
            {
                first_name: firstName,
                last_name: lastName,
                phone_number: phone,
                updatedAt: new Date()
            },
            {
                where: { user_id: userId }
            }
        );

        if (updatedRowsCount === 0) {
            return res.status(404).json({ message: "User not found or no changes made." });
        }

        return res.status(200).json({ message: "Profile updated successfully." });

    } catch (error) {
        console.error("Database Error updating profile:", error);
        return res.status(500).json({ message: "Failed to update profile details." });
    }
};

// ===============================================
// ADDRESS MANAGEMENT (Addresses Table)
// ===============================================

/**
 * GET /api/profile/addresses
 * Fetches all saved addresses for the current user.
 */
exports.getAddresses = async (req, res) => {
    const userId = req.user.uid;

    try {
        // Fetch addresses associated with this user_id
        const results = await Address.findAll({
            where: { user_id: userId },
            order: [['is_default', 'DESC'], ['createdAt', 'DESC']]
        });

        // Map Sequelize results (snake_case) to camelCase for the frontend
        const addresses = results.map(row => ({
            id: row.address_id,
            fullName: row.full_name,
            addressLine1: row.line1,
            addressLine2: row.line2,
            city: row.city,
            state: row.state,
            pincode: row.pincode,
            isDefault: row.is_default,
        }));

        return res.status(200).json(addresses);

    } catch (error) {
        console.error("Database Error fetching addresses:", error);
        return res.status(500).json({ message: "Failed to fetch addresses." });
    }
};

/**
 * POST /api/profile/addresses
 * Saves a new address to the 'addresses' table.
 */
exports.saveAddress = async (req, res) => {
    const userId = req.user.uid;
    const { name, addressLine1, addressLine2, city, state, pincode } = req.body; 
    
    // Set is_default to false unless explicit logic is added later
    const isDefault = false; 
    
    // Use the provided 'name' or fallback to user info
    const fullName = name || req.user.displayName || 'Customer'; 

    // 1. Basic validation
    if (!addressLine1 || !city || !state || !pincode) {
        return res.status(400).json({ message: "Missing required address fields." });
    }

    try {
        // 2. Insert new address using Sequelize Address model
        const newAddress = await Address.create({
            user_id: userId,
            full_name: fullName,
            line1: addressLine1,
            line2: addressLine2,
            city: city,
            state: state,
            pincode: pincode,
            is_default: isDefault,
            // createdAt and updatedAt are automatically handled if set in model options
        });

        // 3. Map result to camelCase for the frontend response
        return res.status(201).json({
            id: newAddress.address_id,
            fullName: newAddress.full_name,
            addressLine1: newAddress.line1,
            addressLine2: newAddress.line2,
            city: newAddress.city,
            state: newAddress.state,
            pincode: newAddress.pincode,
            isDefault: newAddress.is_default,
        });

    } catch (error) {
        console.error("Database Error saving address:", error);
        // Check for specific Sequelize validation errors if necessary
        return res.status(500).json({ message: "Failed to save address." });
    }
};


// ... (existing code for getAddresses and saveAddress) ...

/**
 * PUT /api/profile/addresses/:id
 * Updates an existing address in the 'addresses' table.
 */
exports.updateAddress = async (req, res) => {
    const userId = req.user.uid;
    const addressId = req.params.id;
    const { fullName, addressLine1, addressLine2, city, state, pincode, isDefault } = req.body; 

    // 1. Basic validation
    if (!addressLine1 || !city || !state || !pincode) {
        return res.status(400).json({ message: "Missing required address fields." });
    }

    try {
        // 2. Update address using Sequelize, restricting by both address_id and user_id for security
        const [updatedRowsCount] = await Address.update(
            {
                full_name: fullName,
                line1: addressLine1,
                line2: addressLine2,
                city: city,
                state: state,
                pincode: pincode,
                is_default: isDefault,
                updatedAt: new Date()
            },
            {
                where: { address_id: addressId, user_id: userId }
            }
        );

        if (updatedRowsCount === 0) {
            return res.status(404).json({ message: "Address not found or no changes made." });
        }

        return res.status(200).json({ message: "Address updated successfully." });

    } catch (error) {
        console.error("Database Error updating address:", error);
        return res.status(500).json({ message: "Failed to update address." });
    }
};

/**
 * DELETE /api/profile/addresses/:id
 * Deletes an address from the 'addresses' table.
 */
exports.deleteAddress = async (req, res) => {
    const userId = req.user.uid;
    const addressId = req.params.id;

    try {
        // 1. Delete address using Sequelize, restricted by both address_id and user_id for security
        const deletedRowsCount = await Address.destroy({
            where: { address_id: addressId, user_id: userId }
        });

        if (deletedRowsCount === 0) {
            return res.status(404).json({ message: "Address not found." });
        }

        return res.status(204).send(); // HTTP 204: No Content (successful deletion)

    } catch (error) {
        console.error("Database Error deleting address:", error);
        return res.status(500).json({ message: "Failed to delete address." });
    }
};