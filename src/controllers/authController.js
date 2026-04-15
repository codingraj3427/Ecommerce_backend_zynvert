const User = require("../models/postgres/User");

exports.syncUser = async (req, res) => {
  // 1. Data from Firebase Middleware
  const {
    uid,
    email: tokenEmail,
    name: tokenName,
    phone_number: tokenPhone,
  } = req.user;

  // 2. Data explicitly sent from React (Profile Form)
  const { firstName, lastName, phone, email: bodyEmail } = req.body;

  // 3. THE FIX: Provide a placeholder email for Phone Auth so Postgres doesn't crash
  const finalEmail = bodyEmail || tokenEmail || `${uid}@pending.zynventics.com`;
  const finalPhone = phone || tokenPhone || null;

  let finalFirstName = firstName;
  let finalLastName = lastName;

  if (!finalFirstName && tokenName) {
    const parts = tokenName.split(" ");
    finalFirstName = parts[0];
    finalLastName = parts.slice(1).join(" ");
  }

  try {
    // 4. Upsert User in Postgres
    const [user, created] = await User.findOrCreate({
      where: { user_id: uid },
      defaults: {
        email: finalEmail,
        first_name: finalFirstName || "",
        last_name: finalLastName || "",
        phone_number: finalPhone,
      },
    });

    // 5. Update fields if they submitted the Profile Completion form
    let wasUpdated = false;
    if (!created) {
      if (finalFirstName && user.first_name !== finalFirstName) {
        user.first_name = finalFirstName;
        wasUpdated = true;
      }
      if (finalLastName && user.last_name !== finalLastName) {
        user.last_name = finalLastName;
        wasUpdated = true;
      }
      if (finalPhone && user.phone_number !== finalPhone) {
        user.phone_number = finalPhone;
        wasUpdated = true;
      }
      // Overwrite the placeholder email with their real email once submitted
      if (bodyEmail && user.email !== bodyEmail) {
        user.email = bodyEmail;
        wasUpdated = true;
      }

      if (wasUpdated) await user.save();
    }

    // 6. THE FIX: Tell React the profile is incomplete if they have the placeholder email
    const missingFields = [];
    if (!user.email || user.email.includes("@pending.zynventics.com")) {
      missingFields.push("email");
    }
    if (!user.first_name) missingFields.push("first_name");
    if (!user.last_name) missingFields.push("last_name");

    const isProfileComplete = missingFields.length === 0;

    res.status(200).json({
      message: created ? "User registered" : "User synced",
      user,
      isProfileComplete,
      missingFields,
    });
  } catch (error) {
    console.error("Sync Error:", error);
    res
      .status(500)
      .json({ message: "Database sync failed", error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ where: { user_id: req.user.uid } });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
