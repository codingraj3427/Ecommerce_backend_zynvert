const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// ✅ IMPORT POSTGRES MODELS
const { Order, OrderItem, Cart, CartItem, Inventory } = require("../models/postgres");

// ✅ IMPORT MONGO MODEL (For frontend display sync)
const Product = require("../models/mongo/Product");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/* ============================================================
   1. CREATE CHECKOUT SESSION
   - Creates a "Pending" Order in DB immediately
   - Passes Order ID to Stripe
   ============================================================ */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { cartItems, shippingAddress } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    if (!shippingAddress) {
      return res.status(400).json({ message: "Shipping address missing" });
    }

    // 1️⃣ CREATE ORDER (UNCHANGED)
    const order = await Order.create({
      user_id: userId,
      shipping_name: shippingAddress.name,
      shipping_line1: shippingAddress.line1,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_pincode: shippingAddress.postal_code,
      total_amount: cartItems.reduce((s, i) => s + i.price * i.quantity, 0),
      status: "Pending Payment",
    });

    // 2️⃣ CREATE ORDER ITEMS (UNCHANGED)
    for (const item of cartItems) {
      await OrderItem.create({
        order_id: order.order_id,
        product_id: item.productId || item.product_id || item.id,
        quantity: item.quantity,
        unit_price: item.price,
      });
    }

    // 3️⃣ CREATE RAZORPAY ORDER (NEW)
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.total_amount * 100), // paise
      currency: "INR",
      receipt: `order_${order.order_id}`,
      notes: {
        order_id: order.order_id.toString(),
        user_id: userId,
      },
    });

    // 4️⃣ SEND DATA TO FRONTEND
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
   2. CONFIRM PAYMENT
   - Verify Stripe Session
   - Update Order Status -> 'Paid'
   - Deduct Inventory (Postgres + Mongo)
   - Clear Cart
   ============================================================ */
exports.confirmPayment = async (req, res) => {
  const { orderId } = req.body;
  const userId = req.user.uid;

  try {
    if (!orderId) {
      return res.status(400).json({ message: "Order ID missing" });
    }

    // 1️⃣ FETCH ORDER
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Prevent double processing
    if (order.status !== "Paid") {
      order.status = "Paid";
      await order.save();

      // 2️⃣ INVENTORY DEDUCTION (UNCHANGED)
      const orderItems = await OrderItem.findAll({
        where: { order_id: orderId },
      });

      for (const item of orderItems) {
        const inventoryItem = await Inventory.findOne({
          where: { product_id: item.product_id },
        });

        if (inventoryItem) {
          const newStock = Math.max(
            0,
            inventoryItem.stock_level - item.quantity
          );

          inventoryItem.stock_level = newStock;
          await inventoryItem.save();

          // Sync Mongo
          await Product.findOneAndUpdate(
            { product_id: item.product_id },
            { $set: { stock_level: newStock } }
          );
        }
      }
    }

    // 3️⃣ CLEAR CART (UNCHANGED)
    const cart = await Cart.findOne({ where: { user_id: userId } });
    if (cart) {
      await CartItem.destroy({ where: { cart_id: cart.cart_id } });
    }

    res.status(200).json({
      success: true,
      message: "Order processed successfully",
    });
  } catch (error) {
    console.error("Confirm Payment Error:", error);
    res.status(500).json({ message: "Failed to confirm payment" });
  }
};
