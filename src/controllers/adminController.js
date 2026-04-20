// src/controllers/adminController.js

const { sequelize } = require("../config/db.postgres");
const { Op, fn, col, literal } = require("sequelize");

const {
  Inventory,
  Order,
  User,
  OrderItem,
  Payment, // ✅ ADDED Payment
  ProductWarranty, // 👈 MAKE SURE THIS IS IMPORTED HERE
  RestockRequest // 👈 ADD THIS LINE RIGHT HERE
} = require("../models/postgres/index");
const Product = require("../models/mongo/Product");
const Category = require("../models/mongo/Category");

// ✅ IMPORT the refund logic
const { processRefund } = require("./paymentController");

// 1. Create Product (Polyglot Transaction)
exports.createProduct = async (req, res) => {
  let t;

  try {
    t = await sequelize.transaction();
  } catch (error) {
    console.error("Failed to start transaction:", error);
    return res.status(500).json({
      message: "Failed to start DB transaction",
      error: error.message,
    });
  }

  try {
    console.log("Incoming createProduct body:", req.body);

    let {
      product_id,
      sku,
      stock_level,
      current_price,
      base_price,
      category_id,
      name,
      description,
      images,
      technical_specs,
      display_flags,
      hsn_code,
      gst_rate,
      country_of_origin,
      product_dimension, // ✅ NEW
      product_weight, // ✅ NEW
      is_visible, // ✅ NEW
    } = req.body;

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

    if (!product_id) {
      product_id = `prod_${Date.now()}`;
    } else {
      product_id = String(product_id);
    }

    if (!name) {
      throw new Error("Product name is required");
    }

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
    base_price =
      base_price === undefined || base_price === null || base_price === ""
        ? 0
        : Number(base_price);

    if (Number.isNaN(stock_level)) throw new Error("Invalid stock_level");
    if (Number.isNaN(current_price)) throw new Error("Invalid current_price");

    if (!images) {
      images = [];
    } else if (!Array.isArray(images)) {
      images = [images];
    }
    images = images.map((img) => String(img));
    const primaryImage = images.length > 0 ? images[0] : null;

    if (!technical_specs || typeof technical_specs !== "object") {
      technical_specs = { description: technical_specs ?? "" };
    }

    if (!display_flags) {
      display_flags = [];
    } else if (Array.isArray(display_flags)) {
      display_flags = display_flags.map(String);
    } else {
      display_flags = [String(display_flags)];
    }

    // ---------- A. Create Inventory in Postgres ----------
    const inventoryRow = await Inventory.create(
      {
        product_id,
        name,
        sku: sku || null,
        stock_level,
        current_price,
        base_price, // ✅ FIXED: Now saving base_price to Postgres
        hsn_code: hsn_code || "85076000", // ✅ FIXED: Saving HSN to Postgres
        gst_rate: Number(gst_rate) || 18, // ✅ FIXED: Saving GST to Postgres
        product_dimension: product_dimension || null, // ✅ NEW
        product_weight: product_weight ? Number(product_weight) : null, // ✅ NEW
        image_url: primaryImage,
      },
      { transaction: t },
    );

    // ---------- B. Create Product in Mongo ----------
    const newProduct = new Product({
      product_id,
      sku: sku || null,
      category_id: category_id || null,
      name,
      description: description || "",
      stock_level,
      price_display: current_price,
      base_price,
      hsn_code: hsn_code || "",
      gst_rate: Number(gst_rate) || 0,
      country_of_origin: country_of_origin || "India",
      product_dimension: product_dimension || "", // ✅ NEW
      product_weight: product_weight ? Number(product_weight) : 0, // ✅ NEW
      images,
      technical_specs,
      display_flags,
      is_visible: is_visible !== undefined ? Boolean(is_visible) : false,
    });

    await newProduct.save();
    await t.commit();

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
  delete req.body.price_display;
  delete req.body.old_price;
  delete req.body.current_price;

  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedProduct = await Product.findOneAndUpdate(
      { product_id: id },
      updateData,
      { new: true },
    );

    if (!updatedProduct)
      return res.status(404).json({ message: "Product not found" });

    if (updateData.images && updateData.images.length > 0) {
      await Inventory.update(
        { image_url: updateData.images[0] },
        { where: { product_id: id } },
      );
    }

    res.json({ message: "Product details updated", product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Update Inventory (Postgres Only)
exports.updateInventory = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      stock_level,
      current_price,
      base_price,
      product_weight,
      product_dimension,
    } = req.body;

    const inventory = await Inventory.findOne({
      where: { product_id: productId },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (stock_level !== undefined) inventory.stock_level = Number(stock_level);
    if (current_price !== undefined)
      inventory.current_price = Number(current_price);

    // Allow updating new fields via inventory updates too
    if (base_price !== undefined) inventory.base_price = Number(base_price);
    if (product_weight !== undefined)
      inventory.product_weight = Number(product_weight);
    if (product_dimension !== undefined)
      inventory.product_dimension = product_dimension;

    await inventory.save();

    if (current_price !== undefined) {
      const product = await Product.findOne({ product_id: productId });

      if (product && product.price_display !== Number(current_price)) {
        product.old_price = product.price_display;
        product.price_display = Number(current_price);
        await product.save();
      }
    }

    res.json({ message: "Inventory updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// 4. Delete Product (Both DBs)
exports.deleteProduct = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;

    const activeOrdersCount = await OrderItem.count({
      where: { product_id: id },
      include: [
        {
          model: Order,
          where: {
            status: {
              [Op.notIn]: ["DELIVERED", "CANCELLED", "RETURNED"],
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

    const deletedCount = await Inventory.destroy({
      where: { product_id: id },
      transaction: t,
    });

    if (deletedCount === 0) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "Product not found in inventory" });
    }

    await Product.findOneAndDelete({ product_id: id });
    await t.commit();
    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("deleteProduct error:", error);
    await t.rollback();
    return res.status(500).json({
      message: "Failed to delete product due to an internal error.",
      error: error.message,
    });
  }
};

// 5. Get All Orders (SUMMARY LIST ONLY)
// 5. Get All Orders (SUMMARY LIST ONLY)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      order: [["createdAt", "DESC"]],
      attributes: [
        "order_id",
        "createdAt",
        "status",
        "total_amount",
        "shipping_city",
        "shipping_name",
        "shipping_line1",
        "payment_method", // ✅ ADD THIS LINE SO THE FRONTEND CAN SEE IT
      ],
      include: [
        {
          model: User,
          attributes: ["email"],
        },
        {
          model: OrderItem,
          attributes: ["quantity", "product_id"],
        },
      ],
    });

    res.json(orders);
  } catch (error) {
    console.error("Get All Orders Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// 6. Update Order Status (Shipping)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, tracking_number, carrier_name, tracking_url } = req.body;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    if (tracking_number) order.tracking_number = tracking_number;
    if (carrier_name) order.carrier_name = carrier_name;
    if (tracking_url) order.tracking_url = tracking_url;

    await order.save();
    res.json({ message: "Order status updated", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 7. Get All Customers
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.findAll({
      attributes: { exclude: ["is_admin"] },
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 8. Get All Products (with Pagination, Search, Filter)
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category } = req.query;
    const query = {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (category) {
      query.category_id = category;
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
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 9. Get Order Full Details
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    let order = await Order.findOne({
      where: { order_id: id },
      include: [
        {
          model: User,
          attributes: ["email", "first_name", "last_name", "phone_number"],
        },
        {
          model: OrderItem,
          attributes: ["product_id", "quantity", "unit_price"],
          include: [
            {
              model: Inventory,
              attributes: ["name", "image_url", "sku", "hsn_code"],
            },
          ],
        },
      ],
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (error) {
    console.error("Get Order Details Error:", error);
    res.status(500).json({ message: error.message });
  }
};

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
    const { id } = req.params;
    const updatedCategory = await Category.findOneAndUpdate(
      { category_id: id },
      req.body,
      { new: true },
    );
    if (!updatedCategory)
      return res.status(404).json({ message: "Category not found" });
    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 13. Delete Category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const productsUsingCategory = await Product.countDocuments({
      category_id: id,
    });
    if (productsUsingCategory > 0) {
      return res.status(400).json({
        message: `Cannot delete category: ${productsUsingCategory} products still use it.`,
      });
    }

    await Category.findOneAndDelete({ category_id: id });
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get Product By ID (Combined Mongo & Postgres Data)
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const productMongo = await Product.findOne({ product_id: id });
    const inventoryPostgres = await Inventory.findOne({
      where: { product_id: id },
      attributes: [
        "sku",
        "stock_level",
        "current_price",
        "created_at",
        "updated_at",
      ],
    });

    if (!productMongo) {
      return res.status(404).json({ message: "Product not found in catalog." });
    }

    const fullProduct = {
      ...productMongo.toObject(),
      inventory: inventoryPostgres ? inventoryPostgres.toJSON() : null,
    };

    res.json(fullProduct);
  } catch (error) {
    console.error("Error fetching combined product:", error);
    res.status(500).json({
      message: "Internal server error while retrieving product.",
      error: error.message,
    });
  }
};

const parseDateRange = (req) => {
  let { from, to } = req.query;

  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

exports.getOverviewStats = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);

    const allOrderWhere = {
      createdAt: { [Op.between]: [start, end] },
    };

    const paidStatusList = ["Paid", "Delivered", "Processing", "Shipped"];
    const paidOrderWhere = {
      status: { [Op.in]: paidStatusList },
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
      Order.findOne({
        attributes: [
          [fn("COALESCE", fn("SUM", col("total_amount")), 0), "totalRevenue"],
        ],
        where: paidOrderWhere,
        raw: true,
      }),
      Order.count({ where: allOrderWhere }),
      Order.count({ where: paidOrderWhere }),
      Order.count({
        where: { ...allOrderWhere, status: "Pending Payment" },
      }),
      Order.count({
        where: { ...allOrderWhere, status: "Cancelled" },
      }),
      Order.count({
        where: allOrderWhere,
        distinct: true,
        col: "user_id",
      }),
      User.count(),
      User.count({
        where: { createdAt: { [Op.between]: [start, end] } },
      }),
    ]);

    const totalRevenue = parseFloat(revenueRow?.totalRevenue || 0);
    const averageOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    return res.json({
      range: { from: start, to: end },
      revenue: { totalRevenue, averageOrderValue },
      orders: { totalOrders, paidOrders, pendingOrders, cancelledOrders },
      customers: {
        distinctCustomersInRange: distinctCustomers,
        totalCustomers,
        newCustomersInRange: newCustomers,
      },
    });
  } catch (error) {
    console.error("getOverviewStats error:", error);
    return res
      .status(500)
      .json({ message: "Failed to load overview stats", error: error.message });
  }
};

exports.getRevenueByDay = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const paidStatusList = ["Paid", "Delivered", "Processing", "Shipped"];

    const rows = await Order.findAll({
      attributes: [
        [fn("DATE", col("createdAt")), "date"],
        [fn("SUM", col("total_amount")), "revenue"],
        [fn("COUNT", col("order_id")), "orders"],
      ],
      where: {
        status: { [Op.in]: paidStatusList },
        createdAt: { [Op.between]: [start, end] },
      },
      group: [literal('DATE("Order"."createdAt")')],
      order: [literal("date ASC")],
      raw: true,
    });

    const result = rows.map((r) => ({
      date: r.date,
      revenue: parseFloat(r.revenue),
      orders: parseInt(r.orders, 10),
    }));

    return res.json({ range: { from: start, to: end }, days: result });
  } catch (error) {
    console.error("getRevenueByDay error:", error);
    return res
      .status(500)
      .json({ message: "Failed to load revenue by day", error: error.message });
  }
};

exports.getTopProducts = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const limit = parseInt(req.query.limit || "10", 10);
    const paidStatusList = ["Paid", "Delivered", "Processing", "Shipped"];

    const rows = await OrderItem.findAll({
      include: [
        {
          model: Order,
          attributes: [],
          where: {
            status: { [Op.in]: paidStatusList },
            createdAt: { [Op.between]: [start, end] },
          },
        },
      ],
      attributes: [
        "product_id",
        [fn("SUM", col("quantity")), "totalQuantity"],
        [
          fn(
            "SUM",
            literal('"OrderItem"."quantity" * "OrderItem"."unit_price"'),
          ),
          "totalRevenue",
        ],
      ],
      group: ["OrderItem.product_id"],
      order: [[literal("totalRevenue"), "DESC"]],
      limit,
      raw: true,
    });

    const productIds = rows.map((r) => r.product_id);

    const products = await Product.find(
      { product_id: { $in: productIds } },
      { product_id: 1, name: 1, category_id: 1 },
    ).lean();

    const productMap = {};
    products.forEach((p) => {
      productMap[p.product_id] = p;
    });

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

    return res.json({ range: { from: start, to: end }, items: result });
  } catch (error) {
    console.error("getTopProducts error:", error);
    return res
      .status(500)
      .json({ message: "Failed to load top products", error: error.message });
  }
};

exports.getTopCustomers = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const limit = parseInt(req.query.limit || "10", 10);
    const paidStatusList = ["Paid", "Delivered", "Processing", "Shipped"];

    const rows = await Order.findAll({
      attributes: [
        "user_id",
        [fn("SUM", col("total_amount")), "totalSpent"],
        [fn("COUNT", col("order_id")), "orderCount"],
      ],
      where: {
        status: { [Op.in]: paidStatusList },
        createdAt: { [Op.between]: [start, end] },
      },
      group: ["user_id"],
      order: [[literal("totalSpent"), "DESC"]],
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
        name:
          u.first_name && u.last_name
            ? `${u.first_name} ${u.last_name}`
            : u.name || u.full_name || null,
        email: u.email || null,
        totalSpent: parseFloat(row.totalSpent),
        orderCount: parseInt(row.orderCount, 10),
      };
    });

    return res.json({ range: { from: start, to: end }, customers: result });
  } catch (error) {
    console.error("getTopCustomers error:", error);
    return res
      .status(500)
      .json({ message: "Failed to load top customers", error: error.message });
  }
};

exports.uploadProductImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const imageUrl = req.file.path;
    return res.status(201).json({ url: imageUrl });
  } catch (error) {
    console.error("uploadProductImage error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to upload image" });
  }
};

function extractCloudinaryPublicId(imageUrl) {
  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split("/");

    const uploadIndex = parts.findIndex((p) => p === "upload");
    if (uploadIndex === -1) {
      const last = parts[parts.length - 1];
      return last.split(".").slice(0, -1).join(".");
    }

    let publicIdParts = parts.slice(uploadIndex + 1);

    if (/^v\d+$/.test(publicIdParts[0])) {
      publicIdParts = publicIdParts.slice(1);
    }

    const last = publicIdParts[publicIdParts.length - 1];
    publicIdParts[publicIdParts.length - 1] = last
      .split(".")
      .slice(0, -1)
      .join(".");

    return publicIdParts.join("/");
  } catch (err) {
    console.error("Failed to parse Cloudinary public_id from URL:", err);
    return null;
  }
}

exports.deleteProductImage = async (req, res) => {
  const { productId } = req.params;
  const { imageUrl } = req.body;

  if (!imageUrl)
    return res.status(400).json({ message: "imageUrl is required" });

  try {
    const publicId = extractCloudinaryPublicId(imageUrl);
    if (publicId) {
      const cldRes = await cloudinary.uploader.destroy(publicId);
      console.log("Cloudinary destroy result:", cldRes);
    }

    let product = await Product.findOneAndUpdate(
      { product_id: productId },
      { $pull: { images: imageUrl } },
      { new: true },
    );

    if (!product) {
      product = await Product.findOneAndUpdate(
        { _id: productId },
        { $pull: { images: imageUrl } },
        { new: true },
      );
    }

    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json({ message: "Image deleted", product });
  } catch (err) {
    console.error("deleteProductImage error:", err);
    return res
      .status(500)
      .json({ message: err.message || "Failed to delete image" });
  }
};

// 14. Generate AWB & Assign Courier (100% ISOLATED TEST MODE)
exports.generateAWB = async (req, res) => {
  try {
    const { id } = req.params;
    const { weight, length, width, height } = req.body;

    if (!weight || !length || !width || !height) {
      return res
        .status(400)
        .json({ message: "Package dimensions and weight are required." });
    }

    const order = await Order.findOne({ where: { order_id: id } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const srResponse = {
      data: {
        awb_code: "AWB" + Math.floor(Math.random() * 1000000000),
        courier_name: "Test Courier (Delhivery)",
      },
    };

    if (srResponse.data && srResponse.data.awb_code) {
      order.tracking_number = srResponse.data.awb_code;
      order.carrier_name = srResponse.data.courier_name;
      order.tracking_url = `https://shiprocket.co/tracking/${srResponse.data.awb_code}`;
      order.status = "Shipped";

      await order.save();

      return res.json({
        message: "TEST MODE: AWB Generated Successfully",
        order,
        shiprocket_response: srResponse.data,
      });
    } else {
      throw new Error("Shiprocket did not return an AWB code.");
    }
  } catch (error) {
    console.error("Test API Error:", error.message);
    res.status(500).json({
      message: "Failed to generate test AWB",
      error: error.message,
    });
  }
};

//==========================================
// ✅ NEW: Admin Force Cancel Order
// ==========================================
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sequelize.transaction(async (t) => {
      // 1. Fetch the order (No user_id restriction because this is admin)
      const order = await Order.findOne({
        where: { order_id: id },
        include: [{ model: OrderItem }],
        transaction: t,
      });

      if (!order) throw new Error("ORDER_NOT_FOUND");

      // 2. Prevent cancellation if it's too late
      const nonCancellableStatuses = ["Shipped", "Delivered", "Cancelled"];
      if (nonCancellableStatuses.includes(order.status)) {
        throw new Error(`STATUS_INVALID_${order.status}`);
      }

      // 3. Process Refund if Paid
      if (order.status === "Paid") {
        // Calls the Razorpay refund helper
        await processRefund(order.order_id, order.total_amount, t);
      }

      // 4. Restock Inventory in BOTH PostgreSQL and MongoDB
      if (order.OrderItems && order.OrderItems.length > 0) {
        for (const item of order.OrderItems) {
          // Postgres
          const inventoryItem = await Inventory.findOne({
            where: { product_id: item.product_id },
            transaction: t,
          });

          if (inventoryItem) {
            inventoryItem.stock_level =
              inventoryItem.stock_level + item.quantity;
            await inventoryItem.save({ transaction: t });

            // Mongo
            await Product.findOneAndUpdate(
              { product_id: item.product_id },
              { $set: { stock_level: inventoryItem.stock_level } },
            );
          }
        }
      }

      // 5. Update Order Status
      order.status = "Cancelled";
      // Log that an admin forced this cancellation
      order.cancellation_reason = "Cancelled by Administrator";

      await order.save({ transaction: t });

      return order; // Commits the transaction
    });

    res.status(200).json({
      message: "Order cancelled successfully by Admin.",
      order: result,
    });
  } catch (error) {
    if (error.message === "ORDER_NOT_FOUND") {
      return res.status(404).json({ message: "Order not found." });
    }
    if (error.message.startsWith("STATUS_INVALID_")) {
      const status = error.message.split("_").pop();
      return res
        .status(400)
        .json({ message: `Cannot cancel an order that is already ${status}.` });
    }
    if (error.message === "GATEWAY_REFUND_FAILED") {
      return res.status(500).json({
        message: "Failed to process Razorpay refund. Order not cancelled.",
      });
    }

    console.error("Admin Cancel Order Error:", error);
    res.status(500).json({ message: "Failed to cancel the order." });
  }
};

// ==========================================
// ✅ NEW: Admin Register Product Warranty
// ==========================================
// Inside src/controllers/adminController.js
exports.registerWarranty = async (req, res) => {
  try {
    const {
      serial_number,
      product_id, // Now mandatory
      product_name,
      sku,
      purchase_date,
      warranty_start_date,
      warranty_end_date,
    } = req.body;

    // ✅ UPDATED: product_id is now in the required list
    if (
      !serial_number ||
      !product_id ||
      !product_name ||
      !sku ||
      !purchase_date ||
      !warranty_start_date ||
      !warranty_end_date
    ) {
      return res.status(400).json({
        message:
          "Missing required fields. Please ensure SKU is selected to auto-fill Product ID and Name.",
      });
    }

    const existingWarranty = await ProductWarranty.findOne({
      where: { serial_number },
    });

    if (existingWarranty) {
      return res.status(400).json({
        message: "A warranty for this serial number is already registered.",
      });
    }

    const newWarranty = await ProductWarranty.create({
      serial_number,
      product_id, // ✅ Saved directly
      product_name,
      sku,
      purchase_date: new Date(purchase_date),
      warranty_start_date: new Date(warranty_start_date),
      warranty_end_date: new Date(warranty_end_date),
    });

    return res.status(201).json({
      message: "Warranty registered successfully",
      warranty: newWarranty,
    });
  } catch (error) {
    console.error("registerWarranty error:", error);
    return res.status(500).json({
      message: "Failed to register warranty",
      error: error.message,
    });
  }
};

// ==========================================
// ✅ NEW: Fetch all Restock Requests
// ==========================================
exports.getAllRestockRequests = async (req, res) => {
  try {
    const { status } = req.query; // e.g. ?status=pending

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const requests = await RestockRequest.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      // Optional: If you linked Inventory, you can include it to show current stock
      // include: [{ model: Inventory, attributes: ['stock_level', 'sku'] }]
    });

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Error fetching restock requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load restock requests",
      error: error.message,
    });
  }
};

// ==========================================
// ✅ NEW: Update Restock Request Status (e.g. mark as notified)
// ==========================================
exports.updateRestockRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 

    if (!["pending", "notified"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'pending' or 'notified'.",
      });
    }

    const request = await RestockRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Restock request not found.",
      });
    }

    request.status = status;
    await request.save();

    res.status(200).json({
      success: true,
      message: `Restock request marked as ${status}.`,
      data: request,
    });
  } catch (error) {
    console.error("Error updating restock request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update restock request.",
      error: error.message,
    });
  }
};
