const express = require("express");
const router = express.Router();

const { checkServiceability } = require("../services/ekartServices");

router.post("/check-pincode", async (req, res) => {
  try {
    const pincode = req.body.pincode || req.body.destinationPincode;

    const weight = req.body.weight || 0.5;

    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        serviceable: false,
        message: "Invalid pincode",
      });
    }

    const result = await checkServiceability(pincode, weight);
    console.log(result);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        serviceable: false,
        message: "Delivery is currently unavailable to this location.",
      });
    }

    return res.json({
      success: true,
      serviceable: true,
      message: `Delivery available to ${pincode}`,
      estimatedDate: result.estimatedDate,
      estimatedDays: result.estimatedDays,
      courier: result.courier,
      district: result.district,
      state: result.state,
    });
  } catch (error) {
    console.error("Pincode Check Error:", error.message);

    return res.status(500).json({
      success: false,
      serviceable: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
