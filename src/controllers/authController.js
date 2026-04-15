const User = require("../models/postgres/User");
const { Op } = require("sequelize");

exports.syncUser = async (req, res) => {
  const {
    uid,
    email: tokenEmail,
    name: tokenName,
    phone_number: tokenPhone,
  } = req.user;

  const { firstName, lastName, phone: bodyPhone, email: bodyEmail } = req.body;

  // 1. Normalize Data
  const finalEmail = bodyEmail || tokenEmail || `${uid}@pending.zynventics.com`;
  const rawPhone = bodyPhone || tokenPhone || null;

  let standardizedPhone = null;
  if (rawPhone) {
    const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length === 10) {
      standardizedPhone = `+91${cleanPhone}`;
    }
  }

  let finalFirstName = firstName;
  let finalLastName = lastName;
  if (!finalFirstName && tokenName) {
    const parts = tokenName.split(" ");
    finalFirstName = parts[0];
    finalLastName = parts.slice(1).join(" ");
  }

  try {
    // 2. Find the row for the CURRENT active login session
    let currentSessionRow = await User.findOne({ where: { user_id: uid } });

    // 3. Search for existing older accounts using Email or Phone
    let olderAccount = null;
    if (finalEmail && !finalEmail.includes("@pending")) {
      olderAccount = await User.findOne({ where: { email: finalEmail } });
    }
    if (!olderAccount && standardizedPhone) {
      olderAccount = await User.findOne({
        where: { phone_number: standardizedPhone },
      });
    }

    // 4. THE MERGE CONFLICT RESOLVER
    if (olderAccount && (!currentSessionRow || olderAccount.user_id !== uid)) {
      // WE FOUND A CONFLICT! The user verified an email that belongs to an older account.

      // Safely delete the temporary duplicate row using a static query
      if (currentSessionRow) {
        await User.destroy({ where: { user_id: currentSessionRow.user_id } });
      }

      // Hijack the older account and forcefully update the Primary Key
      await User.update(
        {
          user_id: uid,
          phone_number: standardizedPhone || olderAccount.phone_number,
          first_name: finalFirstName || olderAccount.first_name,
          last_name: finalLastName || olderAccount.last_name,
        },
        {
          where: { user_id: olderAccount.user_id },
        },
      );

      // Fetch the newly merged account
      currentSessionRow = await User.findOne({ where: { user_id: uid } });
    } else if (currentSessionRow) {
      // No conflict. Normal static update of the current row.
      await User.update(
        {
          email:
            finalEmail.includes("@pending") && currentSessionRow.email
              ? currentSessionRow.email
              : finalEmail,
          phone_number: standardizedPhone || currentSessionRow.phone_number,
          first_name: finalFirstName || currentSessionRow.first_name,
          last_name: finalLastName || currentSessionRow.last_name,
        },
        {
          where: { user_id: currentSessionRow.user_id },
        },
      );

      currentSessionRow = await User.findOne({ where: { user_id: uid } });
    } else {
      // Brand new user entirely
      currentSessionRow = await User.create({
        user_id: uid,
        email: finalEmail,
        phone_number: standardizedPhone,
        first_name: finalFirstName || "",
        last_name: finalLastName || "",
      });
    }

    // 5. CHECK COMPLETENESS
    const missingFields = [];
    if (
      !currentSessionRow.email ||
      currentSessionRow.email.includes("@pending.zynventics.com")
    )
      missingFields.push("email");
    if (!currentSessionRow.first_name) missingFields.push("first_name");
    if (!currentSessionRow.last_name) missingFields.push("last_name");
    if (!currentSessionRow.phone_number) missingFields.push("phone_number");

    const isProfileComplete = missingFields.length === 0;

    res.status(200).json({
      message: "User synced",
      user: currentSessionRow,
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
