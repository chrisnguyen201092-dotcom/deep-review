const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../../storage/database');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Register webhook
router.post('/', require('../middleware/auth').authenticate, require('../middleware/auth').authorize('admin'),
  async (req, res) => {
    try {
      const { url, events, name } = req.body;
      if (!url || !events || !Array.isArray(events)) {
        return res.status(400).json({ error: 'URL and events array required' });
      }
      const secret = crypto.randomBytes(32).toString('hex');
      const result = await db.query(
        'INSERT INTO webhooks (name, url, events, secret, created_by) VALUES (?, ?, ?, ?, ?)',
        [name || 'Untitled', url, JSON.stringify(events), secret, req.user.id]
      );
      res.status(201).json({ id: result.insertId, secret });
    } catch (err) { res.status(500).json({ error: 'Failed to create webhook' }); }
  }
);

// Incoming webhook handler (from external services)
router.post('/incoming/:source', async (req, res) => {
  try {
    const { source } = req.params;
    const signature = req.headers['x-webhook-signature'];

    if (WEBHOOK_SECRET && signature) {
      const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(req.body)).digest('hex');
      if (signature !== `sha256=${expected}`) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Process webhook based on source
    await db.query(
      'INSERT INTO webhook_events (source, payload, received_at) VALUES (?, ?, NOW())',
      [source, JSON.stringify(req.body)]
    );

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// List webhooks
router.get('/', require('../middleware/auth').authenticate, require('../middleware/auth').authorize('admin'),
  async (req, res) => {
    try {
      const webhooks = await db.query(
        'SELECT id, name, url, events, created_at FROM webhooks ORDER BY created_at DESC'
      );
      res.json(webhooks.map(w => ({ ...w, events: JSON.parse(w.events) })));
    } catch (err) { res.status(500).json({ error: 'Failed to list webhooks' }); }
  }
);

module.exports = router;
