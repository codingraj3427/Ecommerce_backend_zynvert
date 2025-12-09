// src/controllers/adminController.js

// ✅ Get the REAL Sequelize instance from your config
const { sequelize } = require('../config/db.postgres');

// ✅ Get helpers (Op, fn, col, literal) from the Sequelize library
const { Op, fn, col, literal } = require('sequelize');

const { Inventory, Order, User, OrderItem } = require('../models/postgres/index');
const Product = require('../models/mongo/Product');
const Category = require('../models/mongo/Category');


// 1. Create Product (Polyglot Transaction)
exports.createProduct = async (req, res) => {
  let t;

  try {
    // Start Postgres Transaction
    t = await sequelize.transaction();
  } catch (error) {
    console.error("Failed to start transaction:", error);
    return res
      .status(500)
      .json({ message: "Failed to start DB transaction", error: error.message });
  }

  try {
    console.log("Incoming createProduct body:", req.body);

    let {
      product_id,
      sku,
      stock_level,
      current_price,
      category_id,
      name,
      description,
      images,
      technical_specs,
      display_flags,
    } = req.body;

    // Normalize & validate category_id
      if (!category_id) {
        return res.status(400).json({ message: "category_id is required" });
      }

      category_id = String(category_id).trim();

      const categoryDoc = await Category.findOne({ category_id });
      if (!categoryDoc) {
        return res.status(400).json({
          message: `Invalid category_id: ${category_id}. Please select a valid category.`,
        });
      }


    // ---------- Normalize / defaults so DB doesn't explode ----------

    // Product ID: always a string, auto-generate if empty
    if (!product_id) {
      product_id = `prod_${Date.now()}`;
    } else {
      product_id = String(product_id);
    }

    // Basic validation
    if (!name) {
      throw new Error("Product name is required");
    }

    // Numbers: make sure they are numeric
    stock_level =
      stock_level === undefined || stock_level === null || stock_level === ""
        ? 0
        : Number(stock_level);

    current_price =
      current_price === undefined ||
      current_price === null ||
      current_price === ""
        ? 0
        : Number(current_price);

    if (Number.isNaN(stock_level)) {
      throw new Error("Invalid stock_level (must be a number)");
    }
    if (Number.isNaN(current_price)) {
      throw new Error("Invalid current_price (must be a number)");
    }

    // Images: ensure array of strings
    if (!images) {
      images = [];
    } else if (!Array.isArray(images)) {
      images = [images];
    }
    images = images.map((img) => String(img));

    // Technical specs: ensure object
    if (!technical_specs || typeof technical_specs !== "object") {
      technical_specs = { description: technical_specs ?? "" };
    }

    // Display flags: ensure object with booleans
   // Display flags: ensure array of strings, e.g. ['featured', 'home']
if (!display_flags) {
  display_flags = [];
} else if (Array.isArray(display_flags)) {
  display_flags = display_flags.map(String);
} else {
  // single value → wrap as array
  display_flags = [String(display_flags)];
}

    // ---------- A. Create Inventory in Postgres ----------
    const inventoryRow = await Inventory.create(
      {
        product_id,
        sku: sku || null,
        stock_level,
        current_price,
      },
      { transaction: t }
    );

    // ---------- B. Create Product in Mongo ----------
    const newProduct = new Product({
      product_id,
      category_id: category_id || null,
      name,
      description: description || "",
      stock_level,
      price_display: current_price,
      images,
      technical_specs,
      display_flags,
    });

    await newProduct.save();

    await t.commit();

    // Return combined info (or just a success message if you prefer)
    return res.status(201).json({
      message: "Product created successfully in both databases",
      product: newProduct,
      inventory: inventoryRow,
    });
  } catch (error) {
    console.error("createProduct error:", error);
    if (t) {
      await t.rollback();
    }

    return res
      .status(500)
      .json({ message: error.message || "Failed to create product" });
  }
};


// 2. Update Product Details (Mongo Only)
exports.updateProductDetails = async (req, res) => {
  try {
    const { id } = req.params; // Expecting product_id (e.g., "prod_zynvert_100")
    const updateData = req.body;

    const updatedProduct = await Product.findOneAndUpdate(
      { product_id: id }, 
      updateData, 
      { new: true }
    );

    if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });

    res.json({ message: 'Product details updated', product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Update Inventory (Postgres Only)
exports.updateInventory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { stock_level, current_price } = req.body;

    const inventoryItem = await Inventory.findOne({ where: { product_id: productId } });

    if (!inventoryItem) return res.status(404).json({ message: 'Inventory record not found' });

    if (stock_level !== undefined) inventoryItem.stock_level = stock_level;
    if (current_price !== undefined) inventoryItem.current_price = current_price;

    await inventoryItem.save();

    // Optional: Update cosmetic price in Mongo to match
    if (current_price !== undefined) {
      await Product.findOneAndUpdate({ product_id: productId }, { price_display: current_price });
    }

    res.json({ message: 'Inventory updated', inventory: inventoryItem });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Delete Product (Both DBs)
// adminController.js

// ... (Make sure you have imported sequelize)
// 4. Delete Product (Both DBs)
// 4. Delete Product (Both DBs)
exports.deleteProduct = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params; // The product_id to delete

    // 1. Check for active/pending orders referencing this product_id
    const activeOrdersCount = await OrderItem.count({
      where: { product_id: id },
      include: [
        {
          model: Order,
          where: {
            status: {
              // ✅ use Op.notIn, not sequelize.Op.notIn
              [Op.notIn]: ['DELIVERED', 'CANCELLED', 'RETURNED'],
            },
          },
          required: true,
        },
      ],
      transaction: t,
    });

    if (activeOrdersCount > 0) {
      await t.rollback();
      return res.status(400).json({
        message: `Deletion failed: Product ${id} is part of ${activeOrdersCount} active or pending orders.`,
      });
    }

    // 2. Delete from Postgres (Inventory)
    const deletedCount = await Inventory.destroy({
      where: { product_id: id },
      transaction: t,
    });

    if (deletedCount === 0) {
      await t.rollback();
      return res.status(404).json({ message: 'Product not found in inventory' });
    }

    // 3. Delete from Mongo (Catalog)
    await Product.findOneAndDelete({ product_id: id });

    await t.commit();
    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    await t.rollback();
    return res.status(500).json({
      message: 'Failed to delete product due to an internal error.',
      error: error.message,
    });
  }
};


// 5. Get All Orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      order: [['created_at', 'DESC']],
      include: [
        { model: User, attributes: ['email', 'first_name', 'last_name'] }
      ]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 6. Update Order Status (Shipping)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, tracking_number, carrier_name, tracking_url } = req.body;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    if (tracking_number) order.tracking_number = tracking_number;
    if (carrier_name) order.carrier_name = carrier_name;
    if (tracking_url) order.tracking_url = tracking_url;

    await order.save();

    // TODO: Trigger Email Notification Service here

    res.json({ message: 'Order status updated', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 7. Get All Customers
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.findAll({
      attributes: { exclude: ['is_admin'] } // Don't verify admins here
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// Add to adminController.js
// 8. Get All Products (with Pagination, Search, Filter)
exports.getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, category } = req.query;
        const query = {};
        const skip = (parseInt(page) - 1) * parseInt(limit);

        if (search) {
            query.name = { $regex: search, $options: 'i' }; // Case-insensitive search
        }
        if (category) {
            query.category_id = category; // Assuming category_id is stored
        }

        const products = await Product.find(query)
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ name: 1 });
            
        const total = await Product.countDocuments(query);

        res.json({
            products,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add to adminController.js
// 9. Get Order Details (with Items and User)
exports.getOrderById= async (req, res) => {
  try {
    const { id } = req.params; // Order primary key ID

    const order = await Order.findByPk(id, {
      include: [
        { 
          model: User, 
          attributes: ['email', 'first_name', 'last_name', 'phone'] 
        },
        { 
          model: OrderItem, 
          // Include all item details to show what was purchased
          attributes: ['product_id', 'quantity', 'price_at_purchase', 'sku'] 
        }
        // You may also want to include ShippingAddress and PaymentInfo models here if they exist
      ]
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Add to adminController.js
// Don't forget to import the Category model:
// const Category = require('../models/mongo/Category'); // Assuming this path

// 10. Create Category
exports.createCategory = async (req, res) => {
  try {
    const newCategory = new Category(req.body);
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 11. Get All Categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ sort_order: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 12. Update Category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params; // category_id from the URL
    const updatedCategory = await Category.findOneAndUpdate(
      { category_id: id },
      req.body,
      { new: true }
    );
    if (!updatedCategory) return res.status(404).json({ message: 'Category not found' });
    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 13. Delete Category
exports.deleteCategory = async (req, res) => {
  // IMPORTANT: Add a check here to ensure no products are using this category_id
  try {
    const { id } = req.params;
    
    const productsUsingCategory = await Product.countDocuments({ category_id: id });
    if (productsUsingCategory > 0) {
      return res.status(400).json({ message: `Cannot delete category: ${productsUsingCategory} products still use it.` });
    }

    await Category.findOneAndDelete({ category_id: id });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Add this to your adminController.js

/**
 * Get Product By ID (Combined Mongo & Postgres Data)
 * Fetches catalog details from MongoDB and inventory/pricing from PostgreSQL.
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params; // Expecting the shared product_id

    // 1. Fetch from MongoDB (Catalog/Display Data)
    const productMongo = await Product.findOne({ product_id: id });
    
    // 2. Fetch from PostgreSQL (Inventory/Stock Data)
    const inventoryPostgres = await Inventory.findOne({ 
      where: { product_id: id },
      // Select only the attributes the admin needs for inventory/editing
      attributes: ['sku', 'stock_level', 'current_price', 'created_at', 'updated_at'] 
    });

    if (!productMongo) {
      // If the catalog entry is missing, the product cannot be viewed
      return res.status(404).json({ message: 'Product not found in catalog.' });
    }

    // Combine the data using the spread operator
    const fullProduct = {
      ...productMongo.toObject(), // Convert Mongoose document to a plain object
      inventory: inventoryPostgres ? inventoryPostgres.toJSON() : null // Attach inventory data
    };

    res.json(fullProduct);
  } catch (error) {
    console.error('Error fetching combined product:', error);
    res.status(500).json({ message: 'Internal server error while retrieving product.', error: error.message });
  }
};


// ===== Helper: Parse date range from query (for analytics) =====
const parseDateRange = (req) => {
  let { from, to } = req.query; // expected format: YYYY-MM-DD (optional)

  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days by default

  // Normalize to day boundaries
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// GET /api/admin/analytics/overview
// Query params (optional): from=YYYY-MM-DD, to=YYYY-MM-DD
exports.getOverviewStats = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);

    // 👇 IMPORTANT: adjust 'total_amount' and 'status' field names
    // if your Order model uses different column names.
    const paidOrderWhere = {
      status: 'Paid', // e.g., 'Paid', 'Completed' – adjust to your enum
      createdAt: { [Op.between]: [start, end] },
    };

    const allOrderWhere = {
      createdAt: { [Op.between]: [start, end] },
    };

    const [
      revenueRow,
      totalOrders,
      paidOrders,
      pendingOrders,
      cancelledOrders,
      distinctCustomers,
      totalCustomers,
      newCustomers,
    ] = await Promise.all([
      // Total revenue from paid orders
      Order.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('total_amount')), 0), 'totalRevenue']],
        where: paidOrderWhere,
        raw: true,
      }),

      // Total orders (all statuses)
      Order.count({ where: allOrderWhere }),

      // Paid orders
      Order.count({ where: paidOrderWhere }),

      // Pending payment
      Order.count({
        where: {
          ...allOrderWhere,
          status: 'Pending Payment',
        },
      }),

      // Cancelled orders
      Order.count({
        where: {
          ...allOrderWhere,
          status: 'Cancelled',
        },
      }),

      // Unique customers who ordered in this period
      Order.count({
        where: allOrderWhere,
        distinct: true,
        col: 'user_id',
      }),

      // Total customers in system
      User.count(),

      // New customers created in this period
      User.count({
        where: {
          createdAt: { [Op.between]: [start, end] },
        },
      }),
    ]);

    const totalRevenue = parseFloat(revenueRow?.totalRevenue || 0);
    const averageOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    return res.json({
      range: {
        from: start,
        to: end,
      },
      revenue: {
        totalRevenue,
        averageOrderValue,
      },
      orders: {
        totalOrders,
        paidOrders,
        pendingOrders,
        cancelledOrders,
      },
      customers: {
        distinctCustomersInRange: distinctCustomers,
        totalCustomers,
        newCustomersInRange: newCustomers,
      },
    });
  } catch (error) {
    console.error('getOverviewStats error:', error);
    return res
      .status(500)
      .json({ message: 'Failed to load overview stats', error: error.message });
  }
};


// GET /api/admin/analytics/revenue-by-day
// Query params (optional): from=YYYY-MM-DD, to=YYYY-MM-DD
exports.getRevenueByDay = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);

    const rows = await Order.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('SUM', col('total_amount')), 'revenue'],
        [fn('COUNT', col('order_id')), 'orders'],
      ],
      where: {
        status: 'Paid', // adjust if needed
        createdAt: { [Op.between]: [start, end] },
      },
      group: [literal('DATE("Order"."createdAt")')],
      order: [literal('date ASC')],
      raw: true,
    });

    const result = rows.map((r) => ({
      date: r.date, // 'YYYY-MM-DD' from DB
      revenue: parseFloat(r.revenue),
      orders: parseInt(r.orders, 10),
    }));

    return res.json({
      range: { from: start, to: end },
      days: result,
    });
  } catch (error) {
    console.error('getRevenueByDay error:', error);
    return res
      .status(500)
      .json({ message: 'Failed to load revenue by day', error: error.message });
  }
};



// GET /api/admin/analytics/top-products
// Query params: from, to, limit (optional, default 10)
exports.getTopProducts = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const limit = parseInt(req.query.limit || '10', 10);

    const rows = await OrderItem.findAll({
      include: [
        {
          model: Order,
          attributes: [],
          where: {
            status: 'Paid', // adjust if needed
            createdAt: { [Op.between]: [start, end] },
          },
        },
      ],
      attributes: [
        'product_id',
        [fn('SUM', col('quantity')), 'totalQuantity'],
        [
          fn(
            'SUM',
            literal('"OrderItem"."quantity" * "OrderItem"."unit_price"')
          ),
          'totalRevenue',
        ],
      ],
      group: ['OrderItem.product_id'],
      order: [[literal('totalRevenue'), 'DESC']],
      limit,
      raw: true,
    });

    const productIds = rows.map((r) => r.product_id);

    // Product basic info from Mongo
    const products = await Product.find(
      { product_id: { $in: productIds } },
      { product_id: 1, name: 1, category_id: 1 }
    ).lean();

    const productMap = {};
    products.forEach((p) => {
      productMap[p.product_id] = p;
    });

    // Inventory info from Postgres (SKU, current price, stock)
    const inventories = await Inventory.findAll({
      where: { product_id: productIds },
      raw: true,
    });

    const inventoryMap = {};
    inventories.forEach((inv) => {
      inventoryMap[inv.product_id] = inv;
    });

    const result = rows.map((row) => {
      const p = productMap[row.product_id] || {};
      const inv = inventoryMap[row.product_id] || {};
      return {
        product_id: row.product_id,
        name: p.name || null,
        category_id: p.category_id || null,
        sku: inv.sku || null,
        current_price: inv.current_price ? parseFloat(inv.current_price) : null,
        totalQuantity: parseInt(row.totalQuantity, 10),
        totalRevenue: parseFloat(row.totalRevenue),
      };
    });

    return res.json({
      range: { from: start, to: end },
      items: result,
    });
  } catch (error) {
    console.error('getTopProducts error:', error);
    return res
      .status(500)
      .json({ message: 'Failed to load top products', error: error.message });
  }
};

// GET /api/admin/analytics/top-customers
// Query params: from, to, limit (optional)
exports.getTopCustomers = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const limit = parseInt(req.query.limit || '10', 10);

    const rows = await Order.findAll({
      attributes: [
        'user_id',
        [fn('SUM', col('total_amount')), 'totalSpent'],
        [fn('COUNT', col('order_id')), 'orderCount'],
      ],
      where: {
        status: 'Paid',
        createdAt: { [Op.between]: [start, end] },
      },
      group: ['user_id'],
      order: [[literal('totalSpent'), 'DESC']],
      limit,
      raw: true,
    });

    const userIds = rows.map((r) => r.user_id);
    const users = await User.findAll({
      where: { id: userIds },
      raw: true,
    });

    const userMap = {};
    users.forEach((u) => {
      userMap[u.id] = u;
    });

    const result = rows.map((row) => {
      const u = userMap[row.user_id] || {};
      return {
        user_id: row.user_id,
        name: u.name || u.full_name || null,
        email: u.email || null,
        totalSpent: parseFloat(row.totalSpent),
        orderCount: parseInt(row.orderCount, 10),
      };
    });

    return res.json({
      range: { from: start, to: end },
      customers: result,
    });
  } catch (error) {
    console.error('getTopCustomers error:', error);
    return res
      .status(500)
      .json({ message: 'Failed to load top customers', error: error.message });
  }
};

