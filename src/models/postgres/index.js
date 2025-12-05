const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db.postgres');

// 1. User Model
const User = sequelize.define('User', {
  user_id: { type: DataTypes.STRING(128), primaryKey: true }, // Firebase UID
  email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
  first_name: DataTypes.STRING(100),
  last_name: DataTypes.STRING(100),
  phone_number: DataTypes.STRING(20),
  is_admin: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'users', timestamps: true });

// 2. Address Model
const Address = sequelize.define('Address', {
  address_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.STRING(128), allowNull: false },
  full_name: DataTypes.STRING(150),
  line1: { type: DataTypes.STRING(255), allowNull: false },
  line2: DataTypes.STRING(255),
  city: { type: DataTypes.STRING(100), allowNull: false },
  state: { type: DataTypes.STRING(100), allowNull: false },
  pincode: { type: DataTypes.STRING(20), allowNull: false },
  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'addresses', timestamps: true });

// 3. Inventory Model
const Inventory = sequelize.define('Inventory', {
  inventory_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.STRING(128), unique: true, allowNull: false }, // Link to Mongo
  sku: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  stock_level: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
  current_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, { tableName: 'inventory', timestamps: true });

// 4. Order Model
const Order = sequelize.define('Order', {
  order_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.STRING(128), allowNull: false },
  shipping_name: DataTypes.STRING(150),
  shipping_line1: DataTypes.STRING(255),
  shipping_city: DataTypes.STRING(100),
  shipping_pincode: DataTypes.STRING(20),
  total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: { type: DataTypes.STRING(50), defaultValue: 'Pending Payment' },
  tracking_number: DataTypes.STRING(100),
  carrier_name: DataTypes.STRING(50),
  tracking_url: DataTypes.TEXT,
}, { tableName: 'orders', timestamps: true });

// 5. OrderItem Model
const OrderItem = sequelize.define('OrderItem', {
  order_item_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.STRING(128), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // Snapshot price
}, { tableName: 'order_items', timestamps: false });

// 6. Payment Model
const Payment = sequelize.define('Payment', {
  payment_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  razorpay_order_id: DataTypes.STRING(100),
  razorpay_payment_id: DataTypes.STRING(100),
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: { type: DataTypes.STRING(50), allowNull: false },
}, { tableName: 'payments', timestamps: true });

// --- Relationships ---
User.hasMany(Address, { foreignKey: 'user_id' });
Address.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Order, { foreignKey: 'user_id' });
Order.belongsTo(User, { foreignKey: 'user_id' });

Order.hasMany(OrderItem, { foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

Inventory.hasMany(OrderItem, { foreignKey: 'product_id', sourceKey: 'product_id' });
OrderItem.belongsTo(Inventory, { foreignKey: 'product_id', targetKey: 'product_id' });

Order.hasMany(Payment, { foreignKey: 'order_id' });
Payment.belongsTo(Order, { foreignKey: 'order_id' });

module.exports = { User, Address, Inventory, Order, OrderItem, Payment };