const express = require('express');
const router = express.Router();
const db = require('../../storage/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'saas-platform-dev-key';

// Register tenant + admin user
router.post('/register', async (req, res) => {
  try {
    const { tenantName, adminName, adminEmail, adminPassword, plan } = req.body;
    if (!tenantName || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const slug = tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    // Check existing
    const existing = await db.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existing.length > 0) return res.status(409).json({ error: 'Tenant name already taken' });

    // Create tenant
    const tenantResult = await db.query(
      'INSERT INTO tenants (name, slug, plan, status, settings) VALUES (?, ?, ?, ?, ?)',
      [tenantName, slug, plan || 'free', 'active', JSON.stringify({ maxUsers: 5, maxStorage: 1073741824 })]
    );
    const tenantId = tenantResult.insertId;

    // Create admin user
    const hashed = await bcrypt.hash(adminPassword, 12);
    const userResult = await db.query(
      'INSERT INTO users (tenant_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [tenantId, adminName, adminEmail, hashed, 'admin']
    );

    // Generate API key for this tenant
    const apiKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
    await db.query(
      'INSERT INTO api_keys (tenant_id, name, key_hash, prefix, created_by) VALUES (?, ?, ?, ?, ?)',
      [tenantId, 'Default Key', crypto.createHash('sha256').update(apiKey).digest('hex'), apiKey.substring(0, 7), userResult.insertId]
    );

    const token = jwt.sign({ id: userResult.insertId, tenantId, email: adminEmail, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ tenant: { id: tenantId, name: tenantName, slug }, token, apiKey });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, tenantSlug } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    let query = 'SELECT u.*, t.slug as tenant_slug, t.status as tenant_status FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = ?';
    const params = [email];
    if (tenantSlug) { query += ' AND t.slug = ?'; params.push(tenantSlug); }

    const users = await db.query(query, params);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    if (user.tenant_status !== 'active') return res.status(403).json({ error: 'Tenant is suspended' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, tenantId: user.tenant_id, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '30d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantSlug: user.tenant_slug } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Invite user to tenant
router.post('/invite', authenticate, async (req, res) => {
  try {
    const { email, role, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can invite' });

    // Generate invitation token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashed = await bcrypt.hash(tempPassword, 10);

    await db.query(
      'INSERT INTO users (tenant_id, name, email, password, role, invite_token, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.tenantId, name || email.split('@')[0], email, hashed, role || 'member', inviteToken, 'invited']
    );

    // In production, send invitation email with token
    res.status(201).json({ success: true, inviteToken });
  } catch (err) {
    res.status(500).json({ error: 'Invite failed' });
  }
});

// Get tenant info
router.get('/me', authenticate, async (req, res) => {
  try {
    const tenants = await db.query('SELECT * FROM tenants WHERE id = ?', [req.user.tenantId]);
    if (tenants.length === 0) return res.status(404).json({ error: 'Tenant not found' });

    const tenant = tenants[0];
    tenant.settings = JSON.parse(tenant.settings || '{}');
    delete tenant.stripe_customer_id; // Don't expose to non-billing users... but still in memory

    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

module.exports = router;
