// src/controllers/adminAnalyticsController.js

const { Op, fn, col, literal } = require('sequelize');
const { Order, OrderItem, User, Inventory } = require('../models/postgres/index');
const Product = require('../models/mongo/Product'); // keep if you have mongo Product model

// Helper: parse date range (from=YYYY-MM-DD, to=YYYY-MM-DD). Defaults to last 30 days.
const parseDateRange = (req) => {
  let { from, to } = req.query;
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  start.setHours(0,0,0,0);
  end.setHours(23,59,59,999);
  return { start, end };
};

// Paid statuses (matching real e-commerce platforms like Amazon, Flipkart)
const PAID_STATUSES = ['Paid', 'Processing', 'Shipped', 'Delivered'];

// GET /api/admin/analytics/overview
exports.getOverviewStats = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);

    // Query promises in parallel
    const [
      revenueRow,
      totalOrders,
      paidOrders,
      pendingOrders,
      cancelledOrders,
      distinctCustomers,
      totalCustomers,
      newCustomers,
      pendingRevenueRow
    ] = await Promise.all([
      // total revenue for PAID orders only (Paid, Processing, Shipped, Delivered)
      Order.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('total_amount')), 0), 'totalRevenue']],
        where: { 
          status: { [Op.in]: PAID_STATUSES },
          createdAt: { [Op.between]: [start, end] } 
        },
        raw: true
      }),
      // total orders (any status)
      Order.count({ where: { createdAt: { [Op.between]: [start, end] } } }),
      // paid orders
      Order.count({ where: { status: { [Op.in]: PAID_STATUSES }, createdAt: { [Op.between]: [start, end] } } }),
      // pending payment
      Order.count({ where: { status: 'Pending Payment', createdAt: { [Op.between]: [start, end] } } }),
      // cancelled
      Order.count({ where: { status: 'Cancelled', createdAt: { [Op.between]: [start, end] } } }),
      // distinct customers who placed PAID orders in range
      Order.count({ where: { status: { [Op.in]: PAID_STATUSES }, createdAt: { [Op.between]: [start, end] } }, distinct: true, col: 'user_id' }),
      // total customers in system
      User.count(),
      // new customers created in range
      User.count({ where: { createdAt: { [Op.between]: [start, end] } } }),
      // pending revenue (not counted as revenue, but informational)
      Order.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('total_amount')), 0), 'pendingRevenue']],
        where: { 
          status: 'Pending Payment',
          createdAt: { [Op.between]: [start, end] } 
        },
        raw: true
      })
    ]);

    const totalRevenue = parseFloat(revenueRow?.totalRevenue || 0);
    const pendingRevenue = parseFloat(pendingRevenueRow?.pendingRevenue || 0);
    const averageOrderValue = (paidOrders > 0) ? (totalRevenue / paidOrders) : 0;

    return res.json({
      range: { from: start.toISOString(), to: end.toISOString() },
      revenue: { 
        totalRevenue,  // Only PAID orders
        pendingRevenue,  // For reference
        averageOrderValue 
      },
      orders: { 
        totalOrders,  // All orders
        paidOrders,   // Only paid statuses
        pendingOrders, 
        cancelledOrders 
      },
      customers: { 
        distinctCustomersInRange: distinctCustomers, 
        totalCustomers, 
        newCustomersInRange: newCustomers 
      }
    });
  } catch (err) {
    console.error('getOverviewStats error', err);
    return res.status(500).json({ message: 'Failed to load overview stats', error: err.message });
  }
};

// GET /api/admin/analytics/revenue-by-day
exports.getRevenueByDay = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);

    const rows = await Order.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('SUM', col('total_amount')), 'revenue'],
        [fn('COUNT', col('order_id')), 'orders']
      ],
      where: { 
        status: { [Op.in]: PAID_STATUSES },  // Only PAID orders
        createdAt: { [Op.between]: [start, end] } 
      },
      group: [literal('DATE("Order"."createdAt")')],
      order: [literal('DATE("Order"."createdAt") ASC')],
      raw: true
    });

    const days = rows.map(r => ({ date: r.date, revenue: parseFloat(r.revenue), orders: parseInt(r.orders,10) }));
    return res.json({ range: { from: start.toISOString(), to: end.toISOString() }, days });
  } catch (err) {
    console.error('getRevenueByDay error', err);
    return res.status(500).json({ message: 'Failed to load revenue by day', error: err.message });
  }
};

// GET /api/admin/analytics/top-products?limit=10
exports.getTopProducts = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const limit = parseInt(req.query.limit || '10', 10);

    // aggregate by product_id using order_items + join orders (PAID orders only)
    const rows = await OrderItem.findAll({
      include: [{
        model: Order,
        attributes: [],
        where: { 
          status: { [Op.in]: PAID_STATUSES },  // Only PAID orders
          createdAt: { [Op.between]: [start, end] } 
        }
      }],
      attributes: [
        'product_id',
        [fn('SUM', col('quantity')), 'totalQuantity'],
        [fn('SUM', literal('"OrderItem"."quantity" * "OrderItem"."unit_price"')), 'totalRevenue']
      ],
      group: ['OrderItem.product_id'],
      order: [[literal('"totalRevenue"'), 'DESC']],
      limit,
      raw: true
    });

    const productIds = rows.map(r => r.product_id);

    // optional: fetch product names from Mongo Product collection if exists
    let products = [];
    if (Product) {
      products = await Product.find({ product_id: { $in: productIds } }, { product_id: 1, name: 1 }).lean();
    }
    const productMap = {};
    products.forEach(p => { productMap[p.product_id] = p; });

    // optional: fetch inventory rows for SKU/price/stock if needed
    const inventories = await Inventory.findAll({ where: { product_id: productIds }, raw: true }).catch(() => []);
    const invMap = {};
    inventories.forEach(i => { invMap[i.product_id] = i; });

    const items = rows.map(r => ({
      product_id: r.product_id,
      name: productMap[r.product_id]?.name || null,
      sku: invMap[r.product_id]?.sku || null,
      current_price: invMap[r.product_id]?.current_price ? parseFloat(invMap[r.product_id].current_price) : null,
      totalQuantity: parseInt(r.totalQuantity,10),
      totalRevenue: parseFloat(r.totalRevenue)
    }));

    return res.json({ range: { from: start.toISOString(), to: end.toISOString() }, items });
  } catch (err) {
    console.error('getTopProducts error', err);
    return res.status(500).json({ message: 'Failed to load top products', error: err.message });
  }
};

// GET /api/admin/analytics/top-customers?limit=10
exports.getTopCustomers = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const limit = parseInt(req.query.limit || '10', 10);

    const rows = await Order.findAll({
      attributes: [
        'user_id',
        [fn('SUM', col('total_amount')), 'totalSpent'],
        [fn('COUNT', col('order_id')), 'orderCount']
      ],
      where: { 
        status: { [Op.in]: PAID_STATUSES },  // Only PAID orders
        createdAt: { [Op.between]: [start, end] } 
      },
      group: ['user_id'],
      order: [[literal('"totalSpent"'), 'DESC']],
      limit,
      raw: true
    });

    const userIds = rows.map(r => r.user_id);
    const users = await User.findAll({ where: { user_id: userIds }, raw: true }).catch(() => []);
    const userMap = {};
    users.forEach(u => { userMap[u.user_id] = u; });

    const customers = rows.map(r => ({
      user_id: r.user_id,
      name: (userMap[r.user_id]?.first_name ? `${userMap[r.user_id].first_name} ${userMap[r.user_id].last_name || ''}`.trim() : null),
      email: userMap[r.user_id]?.email || null,
      totalSpent: parseFloat(r.totalSpent),
      orderCount: parseInt(r.orderCount, 10)
    }));

    return res.json({ range: { from: start.toISOString(), to: end.toISOString() }, customers });
  } catch (err) {
    console.error('getTopCustomers error', err);
    return res.status(500).json({ message: 'Failed to load top customers', error: err.message });
  }
};
