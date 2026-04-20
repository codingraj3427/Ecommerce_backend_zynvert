const { RestockRequest } = require("../models/postgres/index"); // Adjust import path to your models if needed

exports.requestRestockNotification = async (req, res) => {
  try {
    const { productId, productName, email } = req.body;

    // 1. Basic Validation
    if (!email || !productId) {
      return res.status(400).json({
        success: false,
        message: "Email and Product ID are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }

    // 2. Check for existing request
    // FIXED: Mapped productId to product_id to match the database column
    const existingRequest = await RestockRequest.findOne({
      where: {
        product_id: productId,
        email: email,
        status: "pending",
      },
    });

    if (existingRequest) {
      return res.status(200).json({
        success: true,
        message: "You are already on the notification list for this product.",
      });
    }

    // 3. Save to Database
    // FIXED: Mapped keys to match your Sequelize model's snake_case properties
    await RestockRequest.create({
      product_id: productId,
      product_name: productName,
      email: email,
      status: "pending",
    });

    // 4. Send Success Response
    return res.status(201).json({
      success: true,
      message: "Successfully subscribed to restock notifications.",
    });
  } catch (error) {
    console.error("❌ Error in requestRestockNotification:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Could not save notification request.",
    });
  }
};
