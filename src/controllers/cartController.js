const { Cart, CartItem, Inventory } = require('../models/postgres/index');

// Helper: Find or Create Cart for User
const getUserCart = async (userId) => {
  let cart = await Cart.findOne({ where: { user_id: userId } });
  if (!cart) {
    cart = await Cart.create({ user_id: userId });
  }
  return cart;
};

// 1. Get Cart Logic
exports.getCart = async (req, res) => {
  try {
    const userId = req.user.uid;
    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          include: [{ model: Inventory, attributes: ['product_id', 'sku', 'current_price', 'stock_level'] }] 
        }
      ]
    });

    if (!cart) {
      return res.json({ cartId: null, items: [] });
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Add to Cart Logic
exports.addToCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user.uid;

  try {
    // A. Validate Product Exists & Stock
    const product = await Inventory.findOne({ where: { product_id: productId } });
    if (!product) {
      return res.status(404).json({ message: 'Product not found in inventory' });
    }
    if (product.stock_level < quantity) {
      return res.status(400).json({ message: 'Insufficient stock available' });
    }

    // B. Get User's Cart
    const cart = await getUserCart(userId);

    // C. Check if Item already in Cart
    let cartItem = await CartItem.findOne({
      where: { cart_id: cart.cart_id, product_id: productId }
    });

    if (cartItem) {
      // Update Quantity
      cartItem.quantity += quantity;
      await cartItem.save();
    } else {
      // Add New Item
      await CartItem.create({
        cart_id: cart.cart_id,
        product_id: productId,
        quantity: quantity
      });
    }

    res.status(200).json({ message: 'Item added to cart' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Update Quantity Logic
exports.updateCartItem = async (req, res) => {
  const { quantity } = req.body; // New absolute quantity (e.g., 5)
  const { itemId } = req.params;

  try {
    if (quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const item = await CartItem.findByPk(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.quantity = quantity;
    await item.save();

    res.json({ message: 'Cart updated', item });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Remove Item Logic
exports.removeCartItem = async (req, res) => {
  try {
    const deleted = await CartItem.destroy({ where: { cart_item_id: req.params.itemId } });
    if (!deleted) return res.status(404).json({ message: 'Item not found' });
    
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Clear Cart Logic
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user.uid;
    const cart = await Cart.findOne({ where: { user_id: userId } });
    
    if (cart) {
      await CartItem.destroy({ where: { cart_id: cart.cart_id } });
    }
    
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};