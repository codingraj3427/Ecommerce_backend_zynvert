const { sequelize } = require('../config/db.postgres');
const { Inventory, Order, User, OrderItem } = require('../models/postgres/index');
const Product = require('../models/mongo/Product');

// 1. Create Product (Polyglot Transaction)
exports.createProduct = async (req, res) => {
  const t = await sequelize.transaction(); // Start Postgres Transaction
  
  try {
    const { 
      product_id, sku, stock_level, current_price, // Postgres Data
      category_id, name, description, images, technical_specs, display_flags // Mongo Data
    } = req.body;

    // A. Create Inventory Record (Postgres)
    // We do this inside a transaction first to ensure ID uniqueness and constraints
    await Inventory.create({
      product_id,
      sku,
      stock_level,
      current_price
    }, { transaction: t });

    // B. Create Catalog Document (MongoDB)
    // Note: Mongo doesn't share the SQL transaction, so we must manually rollback SQL if this fails.
    const newProduct = new Product({
      product_id,
      category_id,
      name,
      description,
      price_display: current_price, // Sync display price initially
      images,
      technical_specs,
      display_flags
    });
    
    await newProduct.save();

    await t.commit(); // Commit SQL only if Mongo succeeds
    res.status(201).json({ message: 'Product created successfully in both databases' });

  } catch (error) {
    await t.rollback(); // Rollback SQL if Mongo fails
    // If Mongo succeeded but SQL commit failed (rare), we ideally need a cleanup job.
    // For now, assume consistent failure handling.
    res.status(500).json({ message: 'Failed to create product', error: error.message });
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
exports.deleteProduct = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    // Delete from Postgres
    const deletedCount = await Inventory.destroy({ 
      where: { product_id: id },
      transaction: t 
    });

    if (deletedCount === 0) {
      await t.rollback();
      return res.status(404).json({ message: 'Product not found in inventory' });
    }

    // Delete from Mongo
    await Product.findOneAndDelete({ product_id: id });

    await t.commit();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
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