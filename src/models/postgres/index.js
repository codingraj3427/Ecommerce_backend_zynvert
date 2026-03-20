const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db.postgres");

/* =========================
   1. User Model
========================= */
const User = sequelize.define(
  "User",
  {
    user_id: { type: DataTypes.STRING(128), primaryKey: true },
    email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    first_name: DataTypes.STRING(100),
    last_name: DataTypes.STRING(100),
    phone_number: DataTypes.STRING(20),
    is_admin: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { tableName: "users", timestamps: true },
);

/* =========================
   2. Address Model
========================= */
const Address = sequelize.define(
  "Address",
  {
    address_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: { type: DataTypes.STRING(128), allowNull: false },
    full_name: DataTypes.STRING(150),
    phone: { type: DataTypes.STRING(20), allowNull: true },
    line1: { type: DataTypes.STRING(255), allowNull: false },
    line2: DataTypes.STRING(255),
    city: { type: DataTypes.STRING(100), allowNull: false },
    state: { type: DataTypes.STRING(100), allowNull: false },
    pincode: { type: DataTypes.STRING(20), allowNull: false },
    is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { tableName: "addresses", timestamps: true },
);

/* =========================
   3. Inventory Model 
========================= */
const Inventory = sequelize.define(
  "Inventory",
  {
    inventory_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_id: { type: DataTypes.STRING(128), unique: true, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    sku: { type: DataTypes.STRING(100), unique: true, allowNull: false },
    stock_level: { type: DataTypes.INTEGER, allowNull: false },

    current_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // Final MRP

    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    hsn_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "85076000",
    },
    gst_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 18,
    },
    product_dimension: { type: DataTypes.STRING(100), allowNull: true },
    product_weight: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

    image_url: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "inventory", timestamps: true },
);

/* =========================
   4. Cart Model 
========================= */
const Cart = sequelize.define(
  "Cart",
  {
    cart_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.STRING(128), allowNull: false },
  },
  { tableName: "carts", timestamps: true },
);

/* =========================
   5. CartItem Model
========================= */
const CartItem = sequelize.define(
  "CartItem",
  {
    cart_item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cart_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.STRING(128), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    image: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "cart_items", timestamps: false },
);

/* =========================
   6. Order Model (UPDATED: Added Coupon Tracking)
========================= */
const Order = sequelize.define(
  "Order",
  {
    order_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: { type: DataTypes.STRING(128), allowNull: false },
    shipping_name: { type: DataTypes.STRING(150), allowNull: false },
    shipping_phone: { type: DataTypes.STRING(20), allowNull: true },
    shipping_line1: { type: DataTypes.STRING(255), allowNull: false },
    shipping_city: { type: DataTypes.STRING(100), allowNull: false },
    shipping_state: { type: DataTypes.STRING(100), allowNull: false },
    shipping_pincode: { type: DataTypes.STRING(20), allowNull: false },

    // ✅ Order Pricing Details
    total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // Final amount paid
    discount_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // Amount saved
    coupon_id: { type: DataTypes.INTEGER, allowNull: true }, // Foreign key to Coupons
    payment_method: { type: DataTypes.STRING(50), allowNull: true }, // Payment method used
    status: { type: DataTypes.STRING(50), defaultValue: "Pending Payment" },
    tracking_number: DataTypes.STRING(100),
    carrier_name: DataTypes.STRING(50),
    tracking_url: DataTypes.TEXT,
  },
  { tableName: "orders", timestamps: true },
);

/* =========================
   7. OrderItem Model 
========================= */
const OrderItem = sequelize.define(
  "OrderItem",
  {
    order_item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.STRING(128), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },

    unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    hsn_code: { type: DataTypes.STRING(20), allowNull: true },
    gst_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  },
  { tableName: "order_items", timestamps: false },
);

/* =========================
   8. Payment Model
========================= */
const Payment = sequelize.define(
  "Payment",
  {
    payment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    razorpay_order_id: DataTypes.STRING(100),
    razorpay_payment_id: DataTypes.STRING(100),
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: { type: DataTypes.STRING(50), allowNull: false },
  },
  { tableName: "payments", timestamps: true },
);

/* =========================
   9. Favourite Model 
========================= */
const Favourite = sequelize.define(
  "Favourite",
  {
    favourite_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: { type: DataTypes.STRING(128), allowNull: false },
    product_id: { type: DataTypes.STRING(128), allowNull: false },
  },
  { tableName: "favourites", timestamps: true },
);

/* =========================
   10. Coupon Model (NEW)
========================= */
const Coupon = sequelize.define(
  "Coupon",
  {
    coupon_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    discount_type: {
      type: DataTypes.ENUM("percentage", "fixed"),
      allowNull: false,
    },
    discount_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    min_order_value: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    max_discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    usage_limit: {
      type: DataTypes.INTEGER,
      allowNull: true, // If null, infinite uses available
    },
    used_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  { tableName: "coupons", timestamps: true },
);

/* =========================
   RELATIONSHIPS
========================= */
User.hasMany(Address, { foreignKey: "user_id" });
Address.belongsTo(User, { foreignKey: "user_id" });

User.hasOne(Cart, { foreignKey: "user_id" });
Cart.belongsTo(User, { foreignKey: "user_id" });

Cart.hasMany(CartItem, { foreignKey: "cart_id", onDelete: "CASCADE" });
CartItem.belongsTo(Cart, { foreignKey: "cart_id" });

Inventory.hasMany(CartItem, {
  foreignKey: "product_id",
  sourceKey: "product_id",
});
CartItem.belongsTo(Inventory, {
  foreignKey: "product_id",
  targetKey: "product_id",
});

User.hasMany(Order, { foreignKey: "user_id" });
Order.belongsTo(User, { foreignKey: "user_id" });

Order.hasMany(OrderItem, { foreignKey: "order_id" });
OrderItem.belongsTo(Order, { foreignKey: "order_id" });

Inventory.hasMany(OrderItem, {
  foreignKey: "product_id",
  sourceKey: "product_id",
});
OrderItem.belongsTo(Inventory, {
  foreignKey: "product_id",
  targetKey: "product_id",
});

Order.hasMany(Payment, { foreignKey: "order_id" });
Payment.belongsTo(Order, { foreignKey: "order_id" });

User.hasMany(Favourite, { foreignKey: "user_id", onDelete: "CASCADE" });
Favourite.belongsTo(User, { foreignKey: "user_id" });

Inventory.hasMany(Favourite, {
  foreignKey: "product_id",
  sourceKey: "product_id",
  onDelete: "CASCADE",
});
Favourite.belongsTo(Inventory, {
  foreignKey: "product_id",
  targetKey: "product_id",
});

// ✅ NEW COUPON RELATIONSHIPS
Coupon.hasMany(Order, { foreignKey: "coupon_id" });
Order.belongsTo(Coupon, { foreignKey: "coupon_id" });

module.exports = {
  sequelize, // 👈 ADD THIS LINE RIGHT HERE
  User,
  Address,
  Inventory,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Payment,
  Favourite,
  Coupon,
};
