const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Get user's cart
router.get('/', async (req, res) => {
  try {
    const items = await db.query(
      `SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price, p.stock, p.image_url
       FROM cart_items ci JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?
       ORDER BY ci.created_at DESC`,
      [req.user.id]
    );

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({
      items: items.map(item => ({
        id: item.id,
        productId: item.product_id,
        name: item.name,
        price: item.price / 100,
        quantity: item.quantity,
        subtotal: (item.price * item.quantity) / 100,
        inStock: item.stock >= item.quantity,
        imageUrl: item.image_url,
      })),
      total: total / 100,
      totalFormatted: `$${(total / 100).toFixed(2)}`,
      itemCount: items.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add item to cart
router.post('/items', async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Valid productId and quantity required' });
    }

    // Check product exists and has stock
    const products = await db.query(
      'SELECT id, stock, price FROM products WHERE id = ?',
      [productId]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (products[0].stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Check if already in cart
    const existing = await db.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );

    if (existing.length > 0) {
      await db.query(
        'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
        [quantity, existing[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [req.user.id, productId, quantity]
      );
    }

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

// Update cart item quantity
router.put('/items/:itemId', async (req, res) => {
  try {
    const { quantity } = req.body;
    const { itemId } = req.params;

    if (!quantity || quantity < 0) {
      return res.status(400).json({ error: 'Valid quantity required' });
    }

    if (quantity === 0) {
      await db.query('DELETE FROM cart_items WHERE id = ?', [itemId]);
      return res.json({ success: true, deleted: true });
    }

    const result = await db.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [quantity, itemId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove item from cart
router.delete('/items/:itemId', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM cart_items WHERE id = ?',
      [req.params.itemId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Clear entire cart
router.delete('/', async (req, res) => {
  try {
    await db.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
