const express = require('express');
const router = express.Router();
const db = require('../models/db');
const Order = require('../models/order');
const { processPayment } = require('../services/payment');

// Create order from cart
router.post('/', async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;

    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({ error: 'Shipping address and payment method required' });
    }

    // Get cart items
    const cartItems = await db.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
       FROM cart_items ci JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [req.user.id]
    );

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Check stock availability
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.name}. Available: ${item.stock}`,
        });
      }
    }

    // Calculate total
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // Apply discount if coupon is provided
    let discount = 0;
    if (req.body.couponCode) {
      const coupon = await db.query(
        'SELECT * FROM coupons WHERE code = ? AND expires_at > NOW()',
        [req.body.couponCode]
      );
      if (coupon.length > 0) {
        discount = subtotal * (coupon[0].percent_off / 100);
      }
    }

    const tax = (subtotal - discount) * 0.08;
    const shippingCost = subtotal > 5000 ? 0 : 500; // Free shipping over $50
    const total = subtotal - discount + tax + shippingCost;

    // Process payment
    const paymentResult = await processPayment({
      amount: total,
      method: paymentMethod,
      userId: req.user.id,
    });

    if (!paymentResult.success) {
      return res.status(402).json({ error: 'Payment failed', details: paymentResult.error });
    }

    // Create order
    const orderResult = await db.query(
      `INSERT INTO orders (user_id, subtotal, discount, tax, shipping, total, 
       shipping_address, payment_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [req.user.id, subtotal, discount, tax, shippingCost, total,
       JSON.stringify(shippingAddress), paymentResult.paymentId]
    );

    const orderId = orderResult.insertId;

    // Create order items and update stock
    for (const item of cartItems) {
      await db.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );
      await db.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // Clear cart
    await db.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

    res.status(201).json({
      orderId,
      total: total / 100,
      totalFormatted: `$${(total / 100).toFixed(2)}`,
      discount: discount / 100,
      tax: tax / 100,
      status: 'confirmed',
      paymentId: paymentResult.paymentId,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Get order history
router.get('/orders', async (req, res) => {
  try {
    const orders = await db.query(
      `SELECT id, subtotal, discount, tax, shipping, total, status, created_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(orders.map(Order.format));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order details
router.get('/orders/:orderId', async (req, res) => {
  try {
    const orders = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.orderId, req.user.id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await db.query(
      `SELECT oi.*, p.name, p.image_url FROM order_items oi
       JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
      [req.params.orderId]
    );

    res.json({ ...Order.format(orders[0]), items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

module.exports = router;
