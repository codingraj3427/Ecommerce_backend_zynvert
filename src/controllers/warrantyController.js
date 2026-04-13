// src/controllers/warrantyController.js
const { ProductWarranty, Inventory } = require("../models/postgres/index");

exports.checkWarranty = async (req, res) => {
  try {
    const { serial_number } = req.params;

    if (!serial_number) {
      return res.status(400).json({ success: false, message: "Serial number is required." });
    }

    // 1. Find the warranty record
    const warranty = await ProductWarranty.findOne({
      where: { serial_number },
    });

    if (!warranty) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid Serial Number or Product not registered." 
      });
    }

    // 2. Try to fetch the image URL from the Inventory table using the SKU
    let image_url = null;
    if (warranty.sku) {
      const inventoryItem = await Inventory.findOne({
        where: { sku: warranty.sku },
        attributes: ['image_url']
      });
      if (inventoryItem && inventoryItem.image_url) {
        image_url = inventoryItem.image_url;
      }
    }

    // 3. Send the combined data back
    return res.status(200).json({
      success: true,
      data: {
        ...warranty.toJSON(),
        image_url, // Append the real image url!
      },
    });

  } catch (error) {
    console.error("Check Warranty Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error while verifying warranty." 
    });
  }
};