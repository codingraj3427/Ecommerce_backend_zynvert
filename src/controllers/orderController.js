const { Order, OrderItem, Inventory, Payment } = require('../models/postgres/index');

/* ============================================================
   1. GET MY ORDERS (For User Account Page)
   - Fetches all orders for the logged-in user
   - Sorts by newest first
   ============================================================ */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.uid; // From Auth Middleware

    const orders = await Order.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']], // Newest first
      include: [
        {
          model: OrderItem,
          // Optional: Include product details if you want to show images in the list
          // include: [{ model: Inventory, attributes: ['sku'] }] 
        }
      ]
    });

    res.json(orders);
  } catch (error) {
    console.error("Get My Orders Error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

/* ============================================================
   2. GET ORDER DETAILS (For Order Success / Details Page)
   - Fetches a specific order by ID
   - Security: Ensures the order belongs to the requesting user
   ============================================================ */
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id } = req.params;

    const order = await Order.findOne({
      where: { 
        order_id: id,
        user_id: userId // 🔒 Security: User can only see their own orders
      },
      include: [
        {
          model: OrderItem,
          include: [{ 
            model: Inventory,
            attributes: ['product_id', 'sku', 'current_price'] // Fetch SKU/Price for display
          }]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Get Order Details Error:", error);
    res.status(500).json({ message: "Failed to fetch order details" });
  }
};

/* NOTE: 
   The 'createOrder' and 'verifyPayment' functions are NO LONGER NEEDED here.
   
   - Order Creation is now handled in `paymentController.createCheckoutSession`.
   - Payment Confirmation is now handled in `paymentController.confirmPayment`.
*/