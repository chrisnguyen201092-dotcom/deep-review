const express = require('express');
const { validateInput, sanitizeHtml } = require('./validator');
const { formatUser, formatProduct, formatPaginated } = require('./formatter');
const cache = require('./cache');
const db = require('./db');

const app = express();
app.use(express.json());

// ----- User endpoints -----

app.get('/api/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const users = await db.query(
      'SELECT id, name, email, role FROM users LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const total = await db.query('SELECT COUNT(*) as count FROM users');
    res.json(formatPaginated(users, total[0].count, page, limit));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const { name, email, role } = req.query;
    let conditions = [];
    let params = [];

    if (name) {
      conditions.push(`name LIKE '%${name}%'`);
    }
    if (email) {
      conditions.push('email = ?');
      params.push(email);
    }
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }

    const where = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const users = await db.query(
      `SELECT id, name, email, role FROM users ${where}`,
      params
    );
    res.json(users.map(formatUser));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', async (req, res) => {
  const { name, email, password, role } = req.body;

  const errors = validateInput({ name, email, password });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const result = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [sanitizeHtml(name), email, password, role || 'user']
    );
    res.status(201).json({ id: result.insertId, name, email });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----- Product endpoints -----

app.get('/api/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const cacheKey = `products:${page}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const products = await db.query(
      'SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const total = await db.query('SELECT COUNT(*) as count FROM products');
    const result = formatPaginated(products.map(formatProduct), total[0].count, page, limit);
    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `product:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const products = await db.query(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const formatted = formatProduct(products[0]);
    cache.set(cacheKey, formatted, 600);
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, description, price, category, stock } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO products (name, description, price, category, stock) VALUES (?, ?, ?, ?, ?)',
      [sanitizeHtml(name), sanitizeHtml(description || ''), price, category || 'general', stock || 0]
    );
    cache.invalidatePattern('products:');
    res.status(201).json({ id: result.insertId, name, price });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----- Export endpoint -----

app.get('/api/export/users', async (req, res) => {
  const format = req.query.format || 'json';

  try {
    const users = await db.query('SELECT id, name, email, role FROM users');

    if (format === 'csv') {
      const header = 'id,name,email,role\n';
      const rows = users.map(u => `${u.id},${u.name},${u.email},${u.role}`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.send(header + rows);
    } else {
      res.json(users.map(formatUser));
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----- Health & config -----

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
