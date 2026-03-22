const express = require('express');
const router = express.Router();
const db = require('../../storage/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'cms-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'Email taken' });
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashed, 'viewer']
    );
    const token = jwt.sign({ id: result.insertId, email, role: 'viewer' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: result.insertId, name, email, role: 'viewer' } });
  } catch (err) { res.status(500).json({ error: 'Registration failed' }); }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, users[0].password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: users[0].id, email, role: users[0].role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: users[0].id, name: users[0].name, email, role: users[0].role } });
  } catch (err) { res.status(500).json({ error: 'Login failed' }); }
});

// Get profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const users = await db.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(users[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Admin: list users
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const users = await db.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, (page - 1) * limit]
    );
    res.json({ users, page, limit });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Admin: update role
router.put('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['viewer', 'editor', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
