const express = require('express');
const router = express.Router();
const db = require('../../storage/database');
const crypto = require('crypto');

// List API keys
router.get('/', async (req, res) => {
  try {
    const keys = await db.query(
      'SELECT id, name, prefix, created_at, last_used_at, status FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.tenantId]
    );
    res.json(keys);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Create API key
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { name, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const key = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    await db.query(
      'INSERT INTO api_keys (tenant_id, name, key_hash, prefix, permissions, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [req.tenantId, name, keyHash, key.substring(0, 10), JSON.stringify(permissions || ['read']), req.user.id]
    );

    // Return the key ONCE — it won't be retrievable again
    res.status(201).json({ key, prefix: key.substring(0, 10), name });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Revoke API key
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    await db.query(
      "UPDATE api_keys SET status = 'revoked', revoked_at = NOW() WHERE id = ? AND tenant_id = ?",
      [req.params.id, req.tenantId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
