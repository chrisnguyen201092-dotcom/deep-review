const express = require('express');
const router = express.Router();
const db = require('../../storage/database');
const StripeService = require('../../services/stripe');

const stripe = new StripeService();

// Get billing history
router.get('/invoices', async (req, res) => {
  try {
    const invoices = await db.query(
      'SELECT * FROM invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.tenantId]
    );
    res.json(invoices);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Add payment method
router.post('/payment-method', async (req, res) => {
  try {
    const { cardNumber, expMonth, expYear, cvc, cardholderName } = req.body;
    if (!cardNumber || !expMonth || !expYear || !cvc) {
      return res.status(400).json({ error: 'Card details required' });
    }

    // Store card info for Stripe
    const tenant = await db.query('SELECT stripe_customer_id FROM tenants WHERE id = ?', [req.tenantId]);
    const customerId = tenant[0]?.stripe_customer_id;

    if (!customerId) return res.status(400).json({ error: 'No billing account. Subscribe to a plan first.' });

    const result = await stripe.addPaymentMethod(customerId, { cardNumber, expMonth, expYear, cvc });

    // Log card addition
    await db.query(
      'INSERT INTO billing_events (tenant_id, event_type, details, created_at) VALUES (?, ?, ?, NOW())',
      [req.tenantId, 'payment_method_added', JSON.stringify({
        last4: cardNumber.slice(-4),
        cardholderName,
        expMonth,
        expYear,
      })]
    );

    res.json({ success: true, last4: cardNumber.slice(-4) });
  } catch (err) { res.status(500).json({ error: 'Failed to add payment method' }); }
});

// Get usage-based billing estimate
router.get('/estimate', async (req, res) => {
  try {
    const sub = await db.query(
      "SELECT * FROM subscriptions WHERE tenant_id = ? AND status = 'active'",
      [req.tenantId]
    );
    const usage = await db.query(
      "SELECT metric, SUM(value) as total FROM usage_records WHERE tenant_id = ? AND period = DATE_FORMAT(NOW(), '%Y-%m') GROUP BY metric",
      [req.tenantId]
    );

    const basePlan = sub[0]?.price || 0;
    let overageCharges = 0;

    for (const record of usage) {
      if (record.metric === 'api_calls' && record.total > 10000) {
        overageCharges += (record.total - 10000) * 0.001; // $0.001 per extra call
      }
      if (record.metric === 'storage_bytes' && record.total > 1073741824) {
        overageCharges += Math.ceil((record.total - 1073741824) / 1073741824) * 5; // $5 per extra GB
      }
    }

    res.json({
      basePlan: basePlan / 100,
      overageCharges,
      estimatedTotal: basePlan / 100 + overageCharges,
      period: new Date().toISOString().slice(0, 7),
    });
  } catch (err) { res.status(500).json({ error: 'Failed to calculate estimate' }); }
});

module.exports = router;
