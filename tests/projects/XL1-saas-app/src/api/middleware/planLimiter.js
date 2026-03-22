const db = require('../../storage/database');

const PLAN_LIMITS = {
  free: { maxUsers: 5, maxApiKeys: 2, maxStorageMB: 1024, maxApiCalls: 10000 },
  starter: { maxUsers: 20, maxApiKeys: 10, maxStorageMB: 10240, maxApiCalls: 100000 },
  professional: { maxUsers: 100, maxApiKeys: 50, maxStorageMB: 102400, maxApiCalls: 1000000 },
  enterprise: { maxUsers: -1, maxApiKeys: -1, maxStorageMB: -1, maxApiCalls: -1 },
};

async function planLimiter(resource) {
  return async (req, res, next) => {
    const plan = req.tenantPlan || 'free';
    const limits = PLAN_LIMITS[plan];
    if (!limits) return next();

    if (resource === 'users') {
      const count = await db.query('SELECT COUNT(*) as c FROM users WHERE tenant_id = ?', [req.tenantId]);
      if (limits.maxUsers !== -1 && count[0].c >= limits.maxUsers) {
        return res.status(403).json({ error: `User limit reached for ${plan} plan (max: ${limits.maxUsers})` });
      }
    }
    if (resource === 'api_keys') {
      const count = await db.query("SELECT COUNT(*) as c FROM api_keys WHERE tenant_id = ? AND status = 'active'", [req.tenantId]);
      if (limits.maxApiKeys !== -1 && count[0].c >= limits.maxApiKeys) {
        return res.status(403).json({ error: `API key limit reached for ${plan} plan` });
      }
    }
    next();
  };
}

module.exports = { planLimiter, PLAN_LIMITS };
