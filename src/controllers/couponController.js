// src/controllers/couponController.js
const { Coupon } = require('../models/postgres/index');

exports.validateCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({ valid: false, message: "Coupon code is required" });
    }

    // 1. Find the coupon in PostgreSQL
    const coupon = await Coupon.findOne({ where: { code: code.toUpperCase() } });

    // 2. Run validations
    if (!coupon) {
      return res.status(404).json({ valid: false, message: "Invalid coupon code" });
    }
    if (!coupon.is_active) {
      return res.status(400).json({ valid: false, message: "This coupon is no longer active" });
    }
    if (coupon.expires_at && new Date() > new Date(coupon.expires_at)) {
      return res.status(400).json({ valid: false, message: "This coupon has expired" });
    }
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ valid: false, message: "Coupon usage limit reached" });
    }
    if (Number(cartTotal) < Number(coupon.min_order_value)) {
      return res.status(400).json({ 
        valid: false, 
        message: `Cart total must be at least ₹${coupon.min_order_value} to use this coupon` 
      });
    }

    // 3. Calculate Discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (Number(cartTotal) * Number(coupon.discount_value)) / 100;
      // Apply max discount cap if it exists
      if (coupon.max_discount_amount && discountAmount > Number(coupon.max_discount_amount)) {
        discountAmount = Number(coupon.max_discount_amount);
      }
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = Number(coupon.discount_value);
    }

    // Don't let discount exceed cart total
    discountAmount = Math.min(discountAmount, Number(cartTotal));

    res.json({
      valid: true,
      message: "Coupon applied successfully!",
      couponId: coupon.coupon_id,
      code: coupon.code,
      discountAmount: Math.round(discountAmount)
    });

  } catch (error) {
    console.error("Coupon Validation Error:", error);
    res.status(500).json({ valid: false, message: "Server error validating coupon" });
  }
};