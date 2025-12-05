const crypto = require('crypto');
const { sequelize } = require('../config/db.postgres');
const { Order, Payment, Inventory, OrderItem } = require('../models/postgres/index');
require('dotenv').config();

// Helper: Verify Razorpay Webhook Signature
const verifyRazorpaySignature = (body, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return true; // Bypass if secret not set (Dev mode)

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');

  return expectedSignature === signature;
};

// ==========================================
// 1. RAZORPAY WEBHOOK HANDLER
// ==========================================
exports.handleRazorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  
  // 1. Security Check
  if (!verifyRazorpaySignature(req.body, signature)) {
    return res.status(400).json({ message: 'Invalid Webhook Signature' });
  }

  const { event, payload } = req.body;

  // We respond immediately to Razorpay to prevent timeouts
  res.json({ status: 'ok' });

  // Start Background Processing
  const t = await sequelize.transaction();

  try {
    if (event === 'order.paid') {
      const razorpayOrderId = payload.order.entity.id;
      const paymentId = payload.payment.entity.id;
      
      // A. Find the Order in our DB
      // We look up via the Payment table because it links Order <-> RazorpayOrderID
      const paymentRecord = await Payment.findOne({ 
        where: { razorpay_order_id: razorpayOrderId },
        include: [{ model: Order }]
      });

      if (!paymentRecord) {
        console.error(`⚠️ Webhook: Payment record not found for Order ${razorpayOrderId}`);
        await t.rollback();
        return;
      }

      const order = paymentRecord.Order;

      // Idempotency Check: If already paid, ignore
      if (order.status === 'Paid' || order.status === 'Processing') {
        await t.rollback();
        return;
      }

      // B. Update Payment Status
      paymentRecord.razorpay_payment_id = paymentId;
      paymentRecord.status = 'Success';
      await paymentRecord.save({ transaction: t });

      // C. Update Order Status
      order.status = 'Paid';
      await order.save({ transaction: t });

      // D. DEDUCT STOCK (Critical Business Logic)
      // We get all items in this order and decrement inventory
      const orderItems = await OrderItem.findAll({ where: { order_id: order.order_id } });

      for (const item of orderItems) {
        await Inventory.decrement('stock_level', { 
          by: item.quantity,
          where: { product_id: item.product_id },
          transaction: t
        });
      }

      console.log(`✅ Webhook: Order ${order.order_id} marked as Paid. Inventory updated.`);
    } 
    
    else if (event === 'payment.failed') {
      const razorpayOrderId = payload.payment.entity.order_id;
      
      await Payment.update(
        { status: 'Failed' },
        { where: { razorpay_order_id: razorpayOrderId }, transaction: t }
      );
      console.log(`❌ Webhook: Payment failed for Razorpay Order ${razorpayOrderId}`);
    }

    await t.commit();

  } catch (error) {
    console.error('🔥 Webhook Error:', error);
    await t.rollback();
  }
};


// ==========================================
// 2. SHIPPING / TRACKING WEBHOOK HANDLER
// ==========================================
// Receives updates from aggregators like AfterShip / ClickPost
exports.handleShippingWebhook = async (req, res) => {
  // Example Payload: { tracking_number: "123", new_status: "Out for Delivery", timestamp: "..." }
  const { tracking_number, new_status, is_final_status } = req.body;

  if (!tracking_number || !new_status) {
    return res.status(400).json({ message: 'Invalid Payload' });
  }

  try {
    // 1. Find Order by Tracking Number
    const order = await Order.findOne({ where: { tracking_number } });

    if (!order) {
      return res.status(404).json({ message: 'Tracking number not found in system' });
    }

    // 2. Update Status
    // We Map external status to our internal Enums if necessary
    order.status = new_status; // e.g. "Shipped" -> "Out for Delivery"
    
    // If tracking says "Delivered", we might want to trigger a "Review Request" email logic here later
    if (is_final_status) {
        console.log(`📦 Order ${order.order_id} Delivered!`);
    }

    await order.save();

    res.json({ message: 'Tracking updated successfully' });

  } catch (error) {
    console.error('Tracking Webhook Error:', error);
    res.status(500).json({ message: error.message });
  }
};