const User = require('../models/postgres/User');

// 1. Sync User (Call this immediately after Firebase Login/Register on Frontend)
exports.syncUser = async (req, res) => {
  // Data from Firebase Middleware (Token)
  const { uid, email, name: tokenName } = req.user;
  
  // Data from Client Request Body (For Registration forms)
  // We extract firstName, lastName, phone from the request body
  const { firstName, lastName, phone } = req.body;

  // Logic: Use Body data if available (Manual Register), fallback to Token data (Google Login)
  let finalFirstName = firstName;
  let finalLastName = lastName;
  let finalPhone = phone || req.user.phone_number || null;

  // If manual names aren't provided, try to parse the Firebase display name (e.g. from Google)
  if (!finalFirstName && tokenName) {
    const parts = tokenName.split(' ');
    finalFirstName = parts[0];
    finalLastName = parts.slice(1).join(' ');
  }

  try {
    // Upsert: Create if not exists, otherwise update
    const [user, created] = await User.findOrCreate({
      where: { user_id: uid },
      defaults: {
        email,
        first_name: finalFirstName || '', 
        last_name: finalLastName || '',   
        phone_number: finalPhone
      },
    });

    // If user already existed, update fields if they are explicitly provided in this request
    // This handles the case where a user might "complete their profile" later
    if (!created && (firstName || lastName || phone)) {
      if (firstName) user.first_name = firstName;
      if (lastName) user.last_name = lastName;
      if (phone) user.phone_number = phone;
      await user.save();
    }

    res.status(200).json({ 
      message: created ? 'User registered successfully' : 'User logged in successfully', 
      user 
    });
  } catch (error) {
    console.error("Sync Error:", error);
    res.status(500).json({ message: 'Database sync failed', error: error.message });
  }
};

// 2. Get Current User Profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.uid);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};