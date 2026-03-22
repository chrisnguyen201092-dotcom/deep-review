const express = require('express');
const router = express.Router();
const db = require('../models/db');
const Product = require('../models/product');
const { validateRequest } = require('../middleware/validate');

// List products with pagination, search, and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { category, minPrice, maxPrice, search, sortBy, order } = req.query;

    let conditions = [];
    let params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (minPrice) {
      conditions.push('price >= ?');
      params.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      conditions.push('price <= ?');
      params.push(parseFloat(maxPrice));
    }
    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    // Sort validation
    const allowedSort = ['name', 'price', 'created_at', 'stock'];
    const sortColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const [products, countResult] = await Promise.all([
      db.query(
        `SELECT id, name, description, price, category, stock, image_url, created_at 
         FROM products ${where} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.query(`SELECT COUNT(*) as total FROM products ${where}`, params),
    ]);

    const total = countResult[0].total;
    res.json({
      data: products.map(Product.format),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const products = await db.query(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(Product.format(products[0]));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product (admin only — auth handled by middleware in app.js for admin routes)
router.post('/', validateRequest('createProduct'), async (req, res) => {
  try {
    const { name, description, price, category, stock, image_url } = req.body;
    const result = await db.query(
      'INSERT INTO products (name, description, price, category, stock, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', price, category || 'general', stock || 0, image_url || null]
    );
    res.status(201).json({ id: result.insertId, name, price });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update stock (used internally by checkout)
router.patch('/:id/stock', async (req, res) => {
  try {
    const { quantity } = req.body;
    const result = await db.query(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [quantity, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Get product reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const reviews = await db.query(
      'SELECT r.*, u.name as author FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.created_at DESC',
      [req.params.id]
    );
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
