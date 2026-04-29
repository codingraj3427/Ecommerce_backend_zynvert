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
  Coupon,
  Invoice, // ✅ ADDED INVOICE MODEL
  sequelize,
} = require("../models/postgres");

const Product = require("../models/mongo/Product");

// ✅ IMPORT THE INVOICE HELPER WE CREATED
const { generateNextInvoiceNumber } = require("../utils/invoiceHelper");

/* ============================================================
   1. CREATE CHECKOUT SESSION (ONLINE PAYMENT)
   ============================================================ */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.uid;
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

    let discountAmount = 0;
    let appliedCouponId = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        where: { code: couponCode.toUpperCase(), is_active: true },
      });

      if (coupon && itemsTotal >= Number(coupon.min_order_value)) {
        if (coupon.discount_type === "percentage") {
          discountAmount = (itemsTotal * Number(coupon.discount_value)) / 100;
          if (coupon.max_discount_amount) {
            discountAmount = Math.min(
              discountAmount,
              Number(coupon.max_discount_amount),
            );
          }
        } else {
          discountAmount = Number(coupon.discount_value);
        }

        discountAmount = Math.min(discountAmount, itemsTotal);
        appliedCouponId = coupon.coupon_id;
      }
    }

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
      discount_amount: discountAmount,
      coupon_id: appliedCouponId,
      status: "Pending Payment",
      payment_method: "ONLINE",
    });

    await order.reload();

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
      orderNumber: order.order_number,
      amount: razorpayOrder.amount,
    });
  } catch (err) {
    console.error("Razorpay Order Error:", err);
    res.status(500).json({ message: "Payment initialization failed" });
  }
};

/* ============================================================
   2. CONFIRM PAYMENT (WITH AUTO-INVOICE GENERATOR)
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

      // Fetch items including Inventory to get Name, SKU, and Tax rules
      const orderItems = await OrderItem.findAll({
        where: { order_id: orderId },
        include: [{ model: Inventory }],
      });

      let itemsTotalAmount = 0;

      // 1. Update Inventory Stock
      for (const item of orderItems) {
        itemsTotalAmount += Number(item.quantity) * Number(item.unit_price);

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

      // 🌟 2. AUTO-GENERATE OFFICIAL INVOICE 🌟
      try {
        let totalTaxable = 0,
          totalCGST = 0,
          totalSGST = 0;

        const invoiceItems = orderItems.map((item) => {
          const qty = Number(item.quantity);
          const priceIncl = Number(item.unit_price);
          const gstRate = Number(
            item.gst_rate || item.Inventory?.gst_rate || 18,
          );

          const taxable = (priceIncl * qty) / (1 + gstRate / 100);
          const gstAmt = priceIncl * qty - taxable;

          totalTaxable += taxable;
          totalCGST += gstAmt / 2;
          totalSGST += gstAmt / 2;

          return {
            name: item.Inventory?.name || "Zynvert Product",
            sku: item.Inventory?.sku || "N/A",
            hsn: item.hsn_code || item.Inventory?.hsn_code || "N/A",
            qty: qty,
            unit_price: (taxable / qty).toFixed(2), // Store the base Excl-Tax price
            gst_rate: gstRate,
            taxable: taxable.toFixed(2),
            cgst: (gstAmt / 2).toFixed(2),
            sgst: (gstAmt / 2).toFixed(2),
            total: (priceIncl * qty).toFixed(2),
          };
        });

        // Calculate Shipping Fee dynamically based on order total
        const discountVal = Number(order.discount_amount || 0);
        const shippingFee =
          Number(order.total_amount) - itemsTotalAmount + discountVal;

        if (shippingFee > 0) {
          const shipTaxable = shippingFee / 1.18;
          const shipGst = shippingFee - shipTaxable;
          totalTaxable += shipTaxable;
          totalCGST += shipGst / 2;
          totalSGST += shipGst / 2;
        }

        const invoiceNumber = await generateNextInvoiceNumber();

        await Invoice.create({
          invoice_number: invoiceNumber,
          invoice_type: "ECOMMERCE",
          order_id: String(order.order_id),
          user_id: userId,
          customer_name: order.shipping_name,
          customer_phone: order.shipping_phone || "N/A",
          billing_address: `${order.shipping_line1}, ${order.shipping_city}, ${order.shipping_pincode}`,
          place_of_supply: order.shipping_state,
          total_taxable_value: totalTaxable.toFixed(2),
          total_cgst: totalCGST.toFixed(2),
          total_sgst: totalSGST.toFixed(2),
          shipping_fee: Math.max(0, shippingFee).toFixed(2),
          discount_amount: discountVal.toFixed(2),
          grand_total: Number(order.total_amount).toFixed(2),
          items: invoiceItems,
          status: "GENERATED",
        });
        console.log(
          `[Billing] Invoice ${invoiceNumber} created for Order #${order.order_id}`,
        );
      } catch (invErr) {
        console.error(
          "Failed to auto-generate Invoice for Online payment:",
          invErr,
        );
      }
    }

    // 3. Clear Cart
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
   3. CASH ON DELIVERY (WITH AUTO-INVOICE GENERATOR)
   ============================================================ */
exports.placeCODOrder = async (req, res) => {
  try {
    const userId = req.user.uid;
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

    let discountAmount = 0;
    let appliedCouponId = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        where: { code: couponCode.toUpperCase(), is_active: true },
      });

      if (coupon && itemsTotal >= Number(coupon.min_order_value)) {
        if (coupon.discount_type === "percentage") {
          discountAmount = (itemsTotal * Number(coupon.discount_value)) / 100;
          if (coupon.max_discount_amount) {
            discountAmount = Math.min(
              discountAmount,
              Number(coupon.max_discount_amount),
            );
          }
        } else {
          discountAmount = Number(coupon.discount_value);
        }

        discountAmount = Math.min(discountAmount, itemsTotal);
        appliedCouponId = coupon.coupon_id;
      }
    }

    const finalAmount = itemsTotal - discountAmount + Number(shippingFee);

    const order = await Order.create({
      user_id: userId,
      shipping_name: shippingAddress.name,
      shipping_phone: user.phone_number,
      shipping_line1: shippingAddress.line1,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_pincode: shippingAddress.postal_code,
      discount_amount: discountAmount,
      coupon_id: appliedCouponId,
      total_amount: finalAmount,
      status: "COD",
      payment_method: "COD",
    });

    // 👇 1. ADD THIS LINE: Fetch the generated OD400001 from Supabase
    await order.reload();

    for (const item of cart.CartItems) {
      const finalHsn = item.Inventory?.hsn_code || "85076000";
      const finalGst = Number(item.Inventory?.gst_rate) || 18;

      await OrderItem.create({
        order_id: order.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.Inventory.current_price),
        hsn_code: finalHsn,
        gst_rate: finalGst,
      });

      // Update Stock immediately for COD
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

    // 🌟 AUTO-GENERATE OFFICIAL INVOICE 🌟
    try {
      let totalTaxable = 0,
        totalCGST = 0,
        totalSGST = 0;

      const invoiceItems = cart.CartItems.map((item) => {
        const qty = Number(item.quantity);
        const priceIncl = Number(item.Inventory.current_price);
        const gstRate = Number(item.Inventory.gst_rate) || 18;

        const taxable = (priceIncl * qty) / (1 + gstRate / 100);
        const gstAmt = priceIncl * qty - taxable;

        totalTaxable += taxable;
        totalCGST += gstAmt / 2;
        totalSGST += gstAmt / 2;

        return {
          name: item.Inventory.name || "Zynventics Product",
          sku: item.Inventory.sku || "N/A",
          hsn: item.Inventory.hsn_code || "85076000",
          qty: qty,
          unit_price: (taxable / qty).toFixed(2),
          gst_rate: gstRate,
          taxable: taxable.toFixed(2),
          cgst: (gstAmt / 2).toFixed(2),
          sgst: (gstAmt / 2).toFixed(2),
          total: (priceIncl * qty).toFixed(2),
        };
      });

      const sf = Number(shippingFee);
      if (sf > 0) {
        const shipTaxable = sf / 1.18;
        const shipGst = sf - shipTaxable;
        totalTaxable += shipTaxable;
        totalCGST += shipGst / 2;
        totalSGST += shipGst / 2;
      }

      const invoiceNumber = await generateNextInvoiceNumber();

      await Invoice.create({
        invoice_number: invoiceNumber,
        invoice_type: "ECOMMERCE",
        order_id: order.order_number || String(order.order_id),
        user_id: userId,
        customer_name: order.shipping_name,
        customer_phone: user.phone_number || "N/A",
        billing_address: `${order.shipping_line1}, ${order.shipping_city}, ${order.shipping_pincode}`,
        place_of_supply: order.shipping_state,
        total_taxable_value: totalTaxable.toFixed(2),
        total_cgst: totalCGST.toFixed(2),
        total_sgst: totalSGST.toFixed(2),
        shipping_fee: sf.toFixed(2),
        discount_amount: Number(discountAmount).toFixed(2),
        grand_total: Number(finalAmount).toFixed(2),
        items: invoiceItems,
        status: "GENERATED",
      });
      console.log(
        `[Billing] COD Invoice ${invoiceNumber} created for Order #${order.order_id}`,
      );
    } catch (invErr) {
      console.error("Failed to auto-generate Invoice for COD order:", invErr);
    }

    await CartItem.destroy({ where: { cart_id: cart.cart_id } });

    res.json({
      success: true,
      orderId: order.order_id,
      orderNumber: order.order_number,
    });
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
      where: { order_id: orderId, status: "Success" },
      transaction,
    });

    if (!paymentRecord) {
      console.warn(
        `No successful payment record found for order ${orderId}. This might be a COD order or payment failed.`,
      );
      return false;
    }

    if (!paymentRecord.razorpay_payment_id) {
      console.warn(
        `Payment record found for order ${orderId}, but no Razorpay payment ID is present.`,
      );
      return false;
    }

    console.log(
      `[Gateway] Initiating refund of ₹${amount} for Razorpay Payment ID: ${paymentRecord.razorpay_payment_id}`,
    );

    const refund = await razorpay.payments.refund(
      paymentRecord.razorpay_payment_id,
      {
        amount: Math.round(amount * 100),
      },
    );

    paymentRecord.status = "Refunded";
    await paymentRecord.save({ transaction });

    return true;
  } catch (error) {
    console.error("Razorpay Refund Processing Error:", error);
    throw new Error("GATEWAY_REFUND_FAILED");
  }
};
