const express = require('express');
const router = express.Router();
const db = require('../../storage/database');

// Get usage summary
router.get('/', async (req, res) => {
  try {
    const period = req.query.period || new Date().toISOString().slice(0, 7);
    const usage = await db.query(
      "SELECT metric, SUM(value) as total FROM usage_records WHERE tenant_id = ? AND period = ? GROUP BY metric",
      [req.tenantId, period]
    );
    // Get limits
    const tenant = await db.query('SELECT settings FROM tenants WHERE id = ?', [req.tenantId]);
    const limits = JSON.parse(tenant[0]?.settings || '{}');
    
    res.json({ usage, limits, period });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Track usage (called internally by services)
router.post('/track', async (req, res) => {
  try {
    const { metric, value } = req.body;
    if (!metric || value === undefined) return res.status(400).json({ error: 'Metric and value required' });
    const period = new Date().toISOString().slice(0, 7);
    
    // Upsert usage
    await db.query(
      `INSERT INTO usage_records (tenant_id, metric, value, period) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = value + ?`,
      [req.tenantId, metric, value, period, value]
    );
    res.json({ tracked: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
