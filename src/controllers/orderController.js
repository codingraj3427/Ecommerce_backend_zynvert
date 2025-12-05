const { sequelize } = require('../config/db.postgres');
const { Order, OrderItem, Inventory, Payment } = require('../models/postgres/index');
const razorpayService = require('../services/razorpayService');

// 1. Initiate Checkout (Create Order + Razorpay ID)
exports.createOrder = async (req, res) => {
  const { items, shippingAddress } = req.body; // items: [{ product_id, quantity }]
  const userId = req.user.uid; // From Auth Middleware

  const t = await sequelize.transaction(); // Start Postgres Transaction

  try {
    let totalAmount = 0;
    
    // Calculate total & Check Stock (Critical Step)
    for (const item of items) {
      const product = await Inventory.findOne({ where: { product_id: item.product_id } });
      if (!product || product.stock_level < item.quantity) {
        throw new Error(`Product ${item.product_id} is out of stock`);
      }
      totalAmount += parseFloat(product.current_price) * item.quantity;
    }

    // Create Razorpay Order
    const rzpOrder = await razorpayService.createRazorpayOrder(totalAmount);

    // Create Pending Order in Postgres
    const newOrder = await Order.create({
      user_id: userId,
      shipping_name: shippingAddress.full_name,
      shipping_line1: shippingAddress.line1,
      shipping_city: shippingAddress.city,
      shipping_pincode: shippingAddress.pincode,
      total_amount: totalAmount,
      status: 'Pending Payment'
    }, { transaction: t });

    // Store Razorpay Order ID reference
    await Payment.create({
      order_id: newOrder.order_id,
      razorpay_order_id: rzpOrder.id,
      amount: totalAmount,
      status: 'Created'
    }, { transaction: t });

    await t.commit(); // Commit the Pending Order
    
    res.json({ 
      orderId: newOrder.order_id, 
      razorpayOrderId: rzpOrder.id, 
      amount: totalAmount,
      currency: rzpOrder.currency 
    });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// 2. Verify Payment & Confirm Order
exports.verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, signature, orderId } = req.body;

  const isValid = razorpayService.verifySignature(razorpayOrderId, razorpayPaymentId, signature);

  if (!isValid) {
    return res.status(400).json({ message: 'Invalid Signature' });
  }

  const t = await sequelize.transaction();

  try {
    // Update Payment Status
    await Payment.update(
      { status: 'Success', razorpay_payment_id: razorpayPaymentId },
      { where: { razorpay_order_id: razorpayOrderId }, transaction: t }
    );

    // Update Order Status
    await Order.update(
      { status: 'Paid' },
      { where: { order_id: orderId }, transaction: t }
    );

    // TODO: Deduct Stock Logic Here (Loop through items and decrement Inventory)

    await t.commit();
    res.json({ message: 'Payment Verified, Order Placed!' });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};