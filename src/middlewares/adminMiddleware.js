// src/middlewares/adminMiddleware.js
const { User } = require('../models/postgres');

const verifyAdmin = async (req, res, next) => {
  // 1. Check if user is attached and has an email (from Firebase)
  if (!req.user || !req.user.email) {
    return res
      .status(401)
      .json({ message: 'Authorization failed: User not authenticated.' });
  }

  try {
    // 2. Look up user in Postgres by email
    const user = await User.findOne({ where: { email: req.user.email } });

    if (!user) {
      return res
        .status(404)
        .json({ message: 'User record not found in the database.' });
    }

    // 3. Check the admin flag (boolean column: is_admin)
    if (user.is_admin === true) {
      req.adminUser = user; // optional: attach for controllers
      return next();
    }

    // Authenticated but not admin
    return res
      .status(403)
      .json({ message: 'Forbidden: Administrator privileges required.' });
  } catch (error) {
    console.error('Admin verification error:', error);
    return res
      .status(500)
      .json({ message: 'Internal server error during admin check.' });
  }
};

module.exports = verifyAdmin;
