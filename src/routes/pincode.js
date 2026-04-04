const express = require("express");
const router = express.Router();
const { checkServiceability } = require("../services/shiprocketServices");

router.post("/check-pincode", async (req, res) => {
  const { pincode, weight } = req.body;

  if (!pincode || pincode.length !== 6) {
    return res.json({
      success: false,
      message: "Invalid pincode",
    });
  }

  const result = await checkServiceability(pincode, weight);

  if (result.success) {
    return res.json({
      success: true,
      message: `Expected Delivery in ${result.eta}`,
      courier: result.courier,
    });
  } else {
    return res.json({
      success: false,
      message: "Delivery not available",
    });
  }
});

module.exports = router;
