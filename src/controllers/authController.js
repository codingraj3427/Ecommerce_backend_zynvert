const User = require('../models/postgres/User');

// 1. Sync User (Call this immediately after Firebase Login on Frontend)
exports.syncUser = async (req, res) => {
  const { uid, email, name } = req.user; // From Middleware
  const [firstName, ...lastNameParts] = (name || '').split(' ');
  const lastName = lastNameParts.join(' ');

  try {
    // Upsert: Create if not exists, otherwise do nothing (or update)
    const [user, created] = await User.findOrCreate({
      where: { user_id: uid },
      defaults: {
        email,
        first_name: firstName,
        last_name: lastName,
      },
    });

    res.status(200).json({ 
      message: created ? 'User registered' : 'User logged in', 
      user 
    });
  } catch (error) {
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