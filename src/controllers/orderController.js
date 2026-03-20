// src/controllers/orderController.js

// ✅ Added 'sequelize' for the transaction
const {
  Order,
  OrderItem,
  Inventory,
  Payment,
  sequelize,
} = require("../models/postgres/index");
// ✅ Import MongoDB Product model to restore stock there too
const Product = require("../models/mongo/Product");
// ✅ Import the refund helper from paymentController
const { processRefund } = require("./paymentController");

/* ============================================================
   1. GET MY ORDERS (For User Account Page)
   ============================================================ */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.uid;

    const orders = await Order.findAll({
      where: { user_id: userId },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: OrderItem,
        },
      ],
    });

    res.json(orders);
  } catch (error) {
    console.error("Get My Orders Error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

/* ============================================================
   2. GET ORDER DETAILS (For Order Success / Details Page)
   ============================================================ */
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id } = req.params;

    const order = await Order.findOne({
      where: {
        order_id: id,
        user_id: userId,
      },
      include: [
        {
          model: OrderItem,
          // ✅ FETCH THE LOCKED TAX RATES FOR THE INVOICE
          attributes: [
            "product_id",
            "quantity",
            "unit_price",
            "hsn_code",
            "gst_rate",
          ],
          include: [
            {
              model: Inventory,
              attributes: ["name", "sku", "image_url"],
            },
          ],
        },
      ],
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

/* ============================================================
   3. CANCEL ORDER (NEW)
   ============================================================ */
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id } = req.params;

    // Start a managed transaction using sequelize
    const result = await sequelize.transaction(async (t) => {
      // 1. Fetch the order and ensure it belongs to this user
      const order = await Order.findOne({
        where: {
          order_id: id,
          user_id: userId,
        },
        include: [{ model: OrderItem }],
        transaction: t,
      });

      if (!order) throw new Error("ORDER_NOT_FOUND");

      // 2. Prevent cancellation if it's too late
      const nonCancellableStatuses = ["Shipped", "Delivered", "Cancelled"];
      if (nonCancellableStatuses.includes(order.status)) {
        throw new Error(`STATUS_INVALID_${order.status}`);
      }

      // 3. Handle Refunds (Only if the order was paid online)
      // ✅ UPGRADED code for cancelOrder
      if (order.payment_method === "ONLINE" && order.status === "Paid") {
        await processRefund(order.order_id, order.total_amount, t);
      }

      // 4. Restock Inventory in BOTH PostgreSQL and MongoDB
      if (order.OrderItems && order.OrderItems.length > 0) {
        for (const item of order.OrderItems) {
          // A. Update PostgreSQL Inventory
          const inventoryItem = await Inventory.findOne({
            where: { product_id: item.product_id },
            transaction: t,
          });

          if (inventoryItem) {
            // Restore the stock level
            inventoryItem.stock_level =
              inventoryItem.stock_level + item.quantity;
            await inventoryItem.save({ transaction: t });

            // B. Update MongoDB Product (matches your confirmPayment logic)
            await Product.findOneAndUpdate(
              { product_id: item.product_id },
              { $set: { stock_level: inventoryItem.stock_level } },
            );
          }
        }
      }

      // 5. Update Order Status
      order.status = "Cancelled";

      // Optional: Save the cancellation reason if sent from the frontend
      if (req.body.reason) {
        order.cancellation_reason = req.body.reason;
      }

      await order.save({ transaction: t });

      return order; // Returning commits the transaction
    });

    // If the transaction succeeds, send the success response
    res.status(200).json({
      message: "Order cancelled successfully.",
      order: result,
    });
  } catch (error) {
    // Check custom errors thrown inside the transaction
    if (error.message === "ORDER_NOT_FOUND") {
      return res
        .status(404)
        .json({ message: "Order not found or unauthorized." });
    }
    if (error.message.startsWith("STATUS_INVALID_")) {
      const status = error.message.split("_").pop();
      return res.status(400).json({
        message: `Order cannot be cancelled as it is already ${status}.`,
      });
    }
    if (error.message === "GATEWAY_REFUND_FAILED") {
      return res
        .status(500)
        .json({
          message:
            "Failed to process refund with the payment gateway. Order not cancelled.",
        });
    }

    console.error("Cancel Order Error:", error);
    res
      .status(500)
      .json({ message: "Failed to cancel the order. Please try again." });
  }
};
