const express = require('express');
const cors = require('cors');

// Route imports
const tenantRoutes = require('./api/routes/tenants');
const subscriptionRoutes = require('./api/routes/subscriptions');
const billingRoutes = require('./api/routes/billing');
const apiKeyRoutes = require('./api/routes/apiKeys');
const auditRoutes = require('./api/routes/audit');
const usageRoutes = require('./api/routes/usage');

// Middleware
const { authenticate } = require('./api/middleware/auth');
const { tenantContext } = require('./api/middleware/tenantContext');
const { planLimiter } = require('./api/middleware/planLimiter');
const { auditLog } = require('./api/middleware/auditLog');

const db = require('./storage/database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(auditLog);

// Public
app.use('/api/tenants', tenantRoutes);

// Authenticated + tenant-scoped
app.use('/api/subscriptions', authenticate, tenantContext, subscriptionRoutes);
app.use('/api/billing', authenticate, tenantContext, billingRoutes);
app.use('/api/keys', authenticate, tenantContext, apiKeyRoutes);
app.use('/api/usage', authenticate, tenantContext, usageRoutes);
app.use('/api/audit', authenticate, tenantContext, auditRoutes);

// Admin routes — no tenantContext needed
app.get('/api/admin/tenants', authenticate, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  const tenants = await db.query('SELECT id, name, slug, plan, status, created_at FROM tenants ORDER BY created_at DESC');
  res.json(tenants);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'saas-platform' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SaaS Platform on port ${PORT}`));
module.exports = app;
