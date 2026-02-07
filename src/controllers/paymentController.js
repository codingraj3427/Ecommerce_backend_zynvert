const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Postgres models
const {
  User,          // ✅ ADD
  Order,
  OrderItem,
  Cart,
  CartItem,
  Inventory,
} = require("../models/postgres");

// Mongo sync
const Product = require("../models/mongo/Product");

/* ============================================================
   1. CREATE CHECKOUT SESSION (ONLINE PAYMENT)
   ============================================================ */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { shippingAddress, shippingFee = 0 } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({ message: "Shipping address missing" });
    }

    // ✅ FETCH USER PHONE (SOURCE OF TRUTH)
    const user = await User.findByPk(userId);

    if (!user || !user.phone_number) {
      return res.status(400).json({
        message:
          "Phone number is required. Please update your profile and try again.",
      });
    }

    // ✅ LOAD CART
    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [{ model: CartItem, include: [Inventory] }],
    });

    if (!cart || cart.CartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const itemsTotal = cart.CartItems.reduce(
      (sum, item) => sum + item.quantity * Number(item.Inventory.current_price),
      0
    );

    const finalAmount = itemsTotal + Number(shippingFee);

    // ✅ CREATE ORDER (PHONE FROM USER)
    const order = await Order.create({
      user_id: userId,
      shipping_name: shippingAddress.name,
      shipping_phone: user.phone_number, // ✅ FIX
      shipping_line1: shippingAddress.line1,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_pincode: shippingAddress.postal_code,
      total_amount: finalAmount,
      status: "Pending Payment",
    });

    for (const item of cart.CartItems) {
      await OrderItem.create({
        order_id: order.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.Inventory.current_price),
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
            inventoryItem.stock_level - item.quantity
          );
          await inventoryItem.save();

          await Product.findOneAndUpdate(
            { product_id: item.product_id },
            { $set: { stock_level: inventoryItem.stock_level } }
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
    const { shippingAddress, shippingFee = 0 } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({ message: "Shipping address missing" });
    }

    // ✅ FETCH USER PHONE
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
      0
    );

    const finalAmount = itemsTotal + Number(shippingFee);

    const order = await Order.create({
      user_id: userId,
      shipping_name: shippingAddress.name,
      shipping_phone: user.phone_number, // ✅ FIX
      shipping_line1: shippingAddress.line1,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_pincode: shippingAddress.postal_code,
      total_amount: finalAmount,
      status: "COD",
    });

    for (const item of cart.CartItems) {
      await OrderItem.create({
        order_id: order.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.Inventory.current_price),
      });
    }

    for (const item of cart.CartItems) {
      const inventoryItem = await Inventory.findOne({
        where: { product_id: item.product_id },
      });

      if (inventoryItem) {
        inventoryItem.stock_level = Math.max(
          0,
          inventoryItem.stock_level - item.quantity
        );
        await inventoryItem.save();

        await Product.findOneAndUpdate(
          { product_id: item.product_id },
          { $set: { stock_level: inventoryItem.stock_level } }
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
