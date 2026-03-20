const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const {
  Payment,
  User,
  Order,
  OrderItem,
  Cart,
  CartItem,
  Inventory,
  Coupon, // ✅ ADDED COUPON MODEL HERE
} = require("../models/postgres");

const Product = require("../models/mongo/Product");

/* ============================================================
   1. CREATE CHECKOUT SESSION (ONLINE PAYMENT)
   ============================================================ */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.uid;
    // ✅ FIXED: Extracted couponCode from req.body
    const { shippingAddress, shippingFee = 0, couponCode } = req.body; 

    if (!shippingAddress) {
      return res.status(400).json({ message: "Shipping address missing" });
    }

    const user = await User.findByPk(userId);

    if (!user || !user.phone_number) {
      return res.status(400).json({
        message:
          "Phone number is required. Please update your profile and try again.",
      });
    }

    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [{ model: CartItem, include: [Inventory] }],
    });

    if (!cart || cart.CartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const itemsTotal = cart.CartItems.reduce(
      (sum, item) => sum + item.quantity * Number(item.Inventory.current_price),
      0,
    );

    // ✅ NEW SERVER-SIDE COUPON MATH
    // ==========================================
    let discountAmount = 0;
    let appliedCouponId = null;

    if (couponCode) {
      // ✅ Using the top-level Coupon import
      const coupon = await Coupon.findOne({ where: { code: couponCode.toUpperCase(), is_active: true } });
      
      if (coupon && itemsTotal >= Number(coupon.min_order_value)) {
        if (coupon.discount_type === 'percentage') {
          discountAmount = (itemsTotal * Number(coupon.discount_value)) / 100;
          if (coupon.max_discount_amount) {
            discountAmount = Math.min(discountAmount, Number(coupon.max_discount_amount));
          }
        } else {
          discountAmount = Number(coupon.discount_value);
        }
        
        discountAmount = Math.min(discountAmount, itemsTotal); // Prevent negative totals
        appliedCouponId = coupon.coupon_id;
        
        // (Optional) Increment coupon usage count here or in confirmPayment
        // coupon.used_count += 1;
        // await coupon.save();
      }
    }

    // Calculate final amount SECURELY
    const finalAmount = itemsTotal - discountAmount + Number(shippingFee);

    const order = await Order.create({
      user_id: userId,
      shipping_name: shippingAddress.name,
      shipping_phone: user.phone_number,
      shipping_line1: shippingAddress.line1,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_pincode: shippingAddress.postal_code,
      total_amount: finalAmount,
      discount_amount: discountAmount,     // ✅ Tracked discount
      coupon_id: appliedCouponId,          // ✅ Linked to coupon
      status: "Pending Payment",
      payment_method: "ONLINE",
    });

    for (const item of cart.CartItems) {
      await OrderItem.create({
        order_id: order.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.Inventory.current_price),
        hsn_code: item.Inventory.hsn_code || "85076000", 
        gst_rate: Number(item.Inventory.gst_rate) || 18, 
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `order_${order.order_id}`,
      notes: {
        order_id: String(order.order_id),
        user_id: userId,
      },
    });

    res.json({
      razorpayOrderId: razorpayOrder.id,
      orderId: order.order_id,
      amount: razorpayOrder.amount,
    });
  } catch (err) {
    console.error("Razorpay Order Error:", err);
    res.status(500).json({ message: "Payment initialization failed" });
  }
};

/* ============================================================
   2. CONFIRM PAYMENT (NO CHANGE NEEDED)
   ============================================================ */
exports.confirmPayment = async (req, res) => {
  const { orderId } = req.body;
  const userId = req.user.uid;

  try {
    if (!orderId) {
      return res.status(400).json({ message: "Order ID missing" });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "Paid") {
      order.status = "Paid";
      await order.save();

      const orderItems = await OrderItem.findAll({
        where: { order_id: orderId },
      });

      for (const item of orderItems) {
        const inventoryItem = await Inventory.findOne({
          where: { product_id: item.product_id },
        });

        if (inventoryItem) {
          inventoryItem.stock_level = Math.max(
            0,
            inventoryItem.stock_level - item.quantity,
          );
          await inventoryItem.save();

          await Product.findOneAndUpdate(
            { product_id: item.product_id },
            { $set: { stock_level: inventoryItem.stock_level } },
          );
        }
      }
    }

    const cart = await Cart.findOne({ where: { user_id: userId } });
    if (cart) {
      await CartItem.destroy({ where: { cart_id: cart.cart_id } });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Confirm Payment Error:", err);
    res.status(500).json({ message: "Failed to confirm payment" });
  }
};

/* ============================================================
   3. CASH ON DELIVERY
   ============================================================ */
exports.placeCODOrder = async (req, res) => {
  try {
    const userId = req.user.uid;
    // ✅ FIXED: Extracted couponCode from req.body
    const { shippingAddress, shippingFee = 0, couponCode } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({ message: "Shipping address missing" });
    }

    const user = await User.findByPk(userId);

    if (!user || !user.phone_number) {
      return res.status(400).json({
        message:
          "Phone number is required. Please update your profile and try again.",
      });
    }

    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [{ model: CartItem, include: [Inventory] }],
    });

    if (!cart || cart.CartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const itemsTotal = cart.CartItems.reduce(
      (sum, item) => sum + item.quantity * Number(item.Inventory.current_price),
      0,
    );

   // ✅ NEW SERVER-SIDE COUPON MATH
    // ==========================================
    let discountAmount = 0;
    let appliedCouponId = null;

    if (couponCode) {
      // ✅ Using the top-level Coupon import
      const coupon = await Coupon.findOne({ where: { code: couponCode.toUpperCase(), is_active: true } });
      
      if (coupon && itemsTotal >= Number(coupon.min_order_value)) {
        if (coupon.discount_type === 'percentage') {
          discountAmount = (itemsTotal * Number(coupon.discount_value)) / 100;
          if (coupon.max_discount_amount) {
            discountAmount = Math.min(discountAmount, Number(coupon.max_discount_amount));
          }
        } else {
          discountAmount = Number(coupon.discount_value);
        }
        
        discountAmount = Math.min(discountAmount, itemsTotal); // Prevent negative totals
        appliedCouponId = coupon.coupon_id;
        
        // (Optional) Increment coupon usage count here or in confirmPayment
        // coupon.used_count += 1;
        // await coupon.save();
      }
    }

    // Calculate final amount SECURELY
    const finalAmount = itemsTotal - discountAmount + Number(shippingFee);


    const order = await Order.create({
      user_id: userId,
      shipping_name: shippingAddress.name,
      shipping_phone: user.phone_number,
      shipping_line1: shippingAddress.line1,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_pincode: shippingAddress.postal_code,
      discount_amount: discountAmount,     // ✅ Tracked discount
      coupon_id: appliedCouponId,          // ✅ Linked to coupon
      total_amount: finalAmount,
      status: "COD",
      payment_method: "COD"
     
    });

    for (const item of cart.CartItems) {
      const finalHsn = item.Inventory?.hsn_code || "85076000";
      const finalGst = Number(item.Inventory?.gst_rate) || 18;

      console.log("🔥 ABOUT TO SAVE ORDER ITEM:", {
        orderId: order.order_id,
        productId: item.product_id,
        hsn: finalHsn,
        gst: finalGst,
      });

      await OrderItem.create({
        order_id: order.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.Inventory.current_price),
        hsn_code: finalHsn,
        gst_rate: finalGst,
      });
    }

    for (const item of cart.CartItems) {
      const inventoryItem = await Inventory.findOne({
        where: { product_id: item.product_id },
      });

      if (inventoryItem) {
        inventoryItem.stock_level = Math.max(
          0,
          inventoryItem.stock_level - item.quantity,
        );
        await inventoryItem.save();

        await Product.findOneAndUpdate(
          { product_id: item.product_id },
          { $set: { stock_level: inventoryItem.stock_level } },
        );
      }
    }

    await CartItem.destroy({ where: { cart_id: cart.cart_id } });

    res.json({ success: true, orderId: order.order_id });
  } catch (err) {
    console.error("COD Order Error:", err);
    res.status(500).json({ message: "Failed to place COD order" });
  }
};


/* ============================================================
   4. PROCESS REFUND (HELPER FUNCTION FOR ORDER CANCELLATION)
   ============================================================ */
exports.processRefund = async (orderId, amount, transaction) => {
  try {
    const paymentRecord = await Payment.findOne({ 
      where: { order_id: orderId, status: 'Success' }, // Ensure your confirmPayment sets status to 'Success' or 'Paid'
      transaction 
    });

    if (!paymentRecord) {
      console.warn(`No successful payment record found for order ${orderId}. This might be a COD order or payment failed.`);
      return false; 
    }

    // 👇 FIXED: Using razorpay_payment_id to match your database schema
    if (!paymentRecord.razorpay_payment_id) {
       console.warn(`Payment record found for order ${orderId}, but no Razorpay payment ID is present.`);
       return false;
    }

    console.log(`[Gateway] Initiating refund of ₹${amount} for Razorpay Payment ID: ${paymentRecord.razorpay_payment_id}`);
    
    // Call Razorpay API to issue the refund
    const refund = await razorpay.payments.refund(paymentRecord.razorpay_payment_id, {
      amount: Math.round(amount * 100) 
    });

    paymentRecord.status = 'Refunded';
    await paymentRecord.save({ transaction });

    return true;
  } catch (error) {
    console.error("Razorpay Refund Processing Error:", error);
    throw new Error("GATEWAY_REFUND_FAILED");
  }
};