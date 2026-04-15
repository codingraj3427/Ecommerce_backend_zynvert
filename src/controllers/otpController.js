const axios = require("axios");
require("dotenv").config();

let otpStore = {}; // TEMP (replace with Redis later)

// ✅ SEND OTP
exports.sendOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Phone is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);

  otpStore[phone] = {
    otp,
    expires: Date.now() + 5 * 60 * 1000, // 5 mins
  };

  try {
    await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "otp",
        variables_values: otp,
        numbers: phone,
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ success: true, message: "OTP sent" });
  } catch (error) {
    console.error("OTP Send Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

// ✅ VERIFY OTP
exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;

  const record = otpStore[phone];

  if (!record) {
    return res.status(400).json({ message: "No OTP found" });
  }

  if (Date.now() > record.expires) {
    return res.status(400).json({ message: "OTP expired" });
  }

  if (record.otp != otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  delete otpStore[phone];

  // 👉 THIS IS IMPORTANT (LOGIN FLOW)
  res.json({
    success: true,
    message: "OTP verified",
    phone,
  });
};