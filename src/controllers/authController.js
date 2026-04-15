const User = require("../models/postgres/User");

exports.syncUser = async (req, res) => {
  // 1. Data from Firebase Middleware (Decoded Token)
  const {
    uid,
    email: tokenEmail,
    name: tokenName,
    phone_number: tokenPhone,
  } = req.user;

  // 2. Data explicitly sent from React (e.g., when linking a phone number)
  const { firstName, lastName, phone, email: bodyEmail } = req.body;

  // 3. Determine final values (Explicit body data overrides token data)
  const finalEmail = bodyEmail || tokenEmail || null;
  const finalPhone = phone || tokenPhone || null;

  let finalFirstName = firstName;
  let finalLastName = lastName;

  // Parse Google Display Name if no explicit names are provided
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

    // 5. If user exists, update fields if they just verified them (Profile Completion)
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
      if (finalEmail && user.email !== finalEmail) {
        user.email = finalEmail;
        wasUpdated = true;
      }

      if (wasUpdated) await user.save();
    }

    // 6. Completeness Check (Tell React what UI to show)
    const missingFields = [];
    if (!user.email) missingFields.push("email");
    if (!user.phone_number) missingFields.push("phone_number");

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
