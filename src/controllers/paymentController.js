const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    // 1️⃣ CREATE ORDER IN DATABASE (Status: Pending Payment)
    const order = await Order.create({
      user_id: userId,
      
      // ✅ MAP FRONTEND ADDRESS TO DB COLUMNS CORRECTLY
      shipping_name: shippingAddress.name,
      shipping_line1: shippingAddress.line1,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state, // ✅ NEW: Matches your updated Schema
      shipping_pincode: shippingAddress.postal_code, 
      
      total_amount: cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
      status: "Pending Payment",
    });

    // 2️⃣ CREATE ORDER ITEMS
    for (const item of cartItems) {
      await OrderItem.create({
        order_id: order.order_id,
        product_id: item.productId || item.product_id || item.id, // Handle potential key variations
        quantity: item.quantity,
        unit_price: item.price,
      });
    }

    // 3️⃣ PREPARE STRIPE LINE ITEMS
    const lineItems = cartItems.map((item) => ({
      price_data: {
        currency: "inr",
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : [],
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // 4️⃣ CREATE STRIPE SESSION
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      locale: 'en', 
      line_items: lineItems,
      shipping_address_collection: {
        allowed_countries: ["IN"],
      },
      customer_email: req.user.email,
      
      // ✅ PASS ORDER ID TO STRIPE METADATA
      metadata: {
        order_id: order.order_id.toString(),
        user_id: userId,
      },

      success_url: `${FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cart`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Checkout Error:", err);
    res.status(500).json({ message: "Stripe error: " + err.message });
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
  const { sessionId } = req.body;
  const userId = req.user.uid; 

  try {
    // 1️⃣ Verify Session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const orderId = session.metadata.order_id;
    if (!orderId) {
        return res.status(400).json({ message: "Invalid session metadata" });
    }

    // 2️⃣ Update Order Status to 'Paid'
    const order = await Order.findByPk(orderId);
    if (!order) {
        return res.status(404).json({ message: "Order not found" });
    }

    // Only process if not already paid (prevents double deduction on refresh)
    if (order.status !== 'Paid') {
        order.status = 'Paid';
        await order.save();

        // 3️⃣ Deduct Inventory
        const orderItems = await OrderItem.findAll({ where: { order_id: orderId } });

        for (const item of orderItems) {
            // A. Update Postgres Inventory
            const inventoryItem = await Inventory.findOne({ where: { product_id: item.product_id } });
            
            if (inventoryItem) {
                const newStock = Math.max(0, inventoryItem.stock_level - item.quantity);
                inventoryItem.stock_level = newStock;
                await inventoryItem.save();

                // B. Sync to Mongo Product (For frontend cards)
                await Product.findOneAndUpdate(
                    { product_id: item.product_id },
                    { $set: { stock_level: newStock } }
                );
            }
        }
    }

    // 4️⃣ Clear The User's Cart
    const cart = await Cart.findOne({ where: { user_id: userId } });
    if (cart) {
      await CartItem.destroy({ where: { cart_id: cart.cart_id } });
    }

    res.status(200).json({ success: true, message: "Order processed successfully" });
  } catch (error) {
    console.error("Confirm Payment Error:", error);
    res.status(500).json({ message: "Failed to confirm payment" });
  }
};