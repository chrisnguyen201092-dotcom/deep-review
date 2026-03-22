const express = require('express');
const router = express.Router();
const db = require('../../storage/database');
const StripeService = require('../../services/stripe');

const stripe = new StripeService();

// Get current subscription
router.get('/', async (req, res) => {
  try {
    const subs = await db.query(
      'SELECT * FROM subscriptions WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
      [req.tenantId, 'active']
    );
    res.json(subs[0] || { plan: 'free', status: 'active' });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Upgrade/downgrade plan
router.post('/change', async (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['free', 'starter', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    // Get current subscription
    const current = await db.query(
      'SELECT * FROM subscriptions WHERE tenant_id = ? AND status = ?',
      [req.tenantId, 'active']
    );

    const pricing = { free: 0, starter: 2900, professional: 9900, enterprise: 29900 };
    const currentPlan = current[0]?.plan || 'free';

    if (plan === currentPlan) return res.status(400).json({ error: 'Already on this plan' });

    // Process plan change via Stripe
    const tenant = await db.query('SELECT * FROM tenants WHERE id = ?', [req.tenantId]);
    let customerId = tenant[0]?.stripe_customer_id;

    if (!customerId && plan !== 'free') {
      customerId = await stripe.createCustomer(tenant[0].name, req.user.email);
      await db.query('UPDATE tenants SET stripe_customer_id = ? WHERE id = ?', [customerId, req.tenantId]);
    }

    if (plan !== 'free') {
      await stripe.createSubscription(customerId, plan, pricing[plan]);
    }

    // Update plan
    if (current[0]) {
      await db.query("UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?", [current[0].id]);
    }
    await db.query(
      'INSERT INTO subscriptions (tenant_id, plan, price, status, starts_at) VALUES (?, ?, ?, ?, NOW())',
      [req.tenantId, plan, pricing[plan], 'active']
    );
    await db.query('UPDATE tenants SET plan = ? WHERE id = ?', [plan, req.tenantId]);

    // Update plan limits
    const limits = {
      free: { maxUsers: 5, maxStorage: 1073741824 },
      starter: { maxUsers: 20, maxStorage: 10737418240 },
      professional: { maxUsers: 100, maxStorage: 107374182400 },
      enterprise: { maxUsers: -1, maxStorage: -1 },
    };
    await db.query('UPDATE tenants SET settings = ? WHERE id = ?',
      [JSON.stringify(limits[plan]), req.tenantId]);

    res.json({ plan, price: pricing[plan] / 100 });
  } catch (err) {
    console.error('Plan change error:', err);
    res.status(500).json({ error: 'Failed to change plan' });
  }
});

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    await db.query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE tenant_id = ? AND status = 'active'",
      [req.tenantId]
    );
    await db.query("UPDATE tenants SET plan = 'free' WHERE id = ?", [req.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Cancel failed' }); }
});

module.exports = router;
