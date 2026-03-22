const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../../storage/database');

const JWT_SECRET = process.env.JWT_SECRET || 'saas-platform-dev-key';

async function authenticate(req, res, next) {
  // Try JWT
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.substring(7), JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Try API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keys = await db.query(
      "SELECT ak.*, t.status as tenant_status FROM api_keys ak JOIN tenants t ON ak.tenant_id = t.id WHERE ak.key_hash = ? AND ak.status = 'active'",
      [keyHash]
    );
    if (keys.length > 0) {
      const key = keys[0];
      if (key.tenant_status !== 'active') return res.status(403).json({ error: 'Tenant suspended' });

      await db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [key.id]);
      req.user = { id: key.created_by, tenantId: key.tenant_id, role: 'api_key', permissions: JSON.parse(key.permissions || '[]') };
      return next();
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = { authenticate };
