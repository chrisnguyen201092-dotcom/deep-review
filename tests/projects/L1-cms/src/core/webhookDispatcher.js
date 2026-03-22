/**
 * Webhook dispatcher — sends outgoing webhooks when events occur
 */
const crypto = require('crypto');
const db = require('../storage/database');

async function dispatch(event, payload) {
  const webhooks = await db.query(
    "SELECT * FROM webhooks WHERE events LIKE ?",
    [`%"${event}"%`]
  );
  for (const webhook of webhooks) {
    try {
      const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
      const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
      
      // Fire and forget — don't block on webhook delivery
      fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
        },
        body,
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    } catch (err) {
      console.error(`[Webhook] Failed to dispatch to ${webhook.url}: ${err.message}`);
    }
  }
}

module.exports = { dispatch };
