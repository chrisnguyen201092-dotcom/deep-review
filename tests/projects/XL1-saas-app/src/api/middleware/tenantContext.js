const db = require('../../storage/database');

async function tenantContext(req, res, next) {
  if (!req.user || !req.user.tenantId) {
    return res.status(400).json({ error: 'Tenant context required' });
  }

  // Verify tenant exists and is active
  const tenants = await db.query('SELECT id, status, plan FROM tenants WHERE id = ?', [req.user.tenantId]);
  if (tenants.length === 0) return res.status(404).json({ error: 'Tenant not found' });
  if (tenants[0].status !== 'active') return res.status(403).json({ error: 'Tenant suspended' });

  req.tenantId = req.user.tenantId;
  req.tenantPlan = tenants[0].plan;
  next();
}

module.exports = { tenantContext };
