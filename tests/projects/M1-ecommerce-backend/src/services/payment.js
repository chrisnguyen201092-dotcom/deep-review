/**
 * Payment processing service
 * Integrates with external payment gateway (Stripe-like)
 */

const crypto = require('crypto');

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'https://api.payment-gateway.example.com';
const GATEWAY_KEY = process.env.PAYMENT_GATEWAY_KEY || '';

/**
 * Process a payment
 * @param {Object} params
 * @param {number} params.amount - Amount in cents
 * @param {string} params.method - Payment method (card, wallet, etc.)
 * @param {number} params.userId - User ID for the payment
 * @returns {Object} { success, paymentId, error }
 */
async function processPayment({ amount, method, userId }) {
  try {
    // Generate idempotency key to prevent double charges
    const idempotencyKey = crypto.randomUUID();

    // In production, this would be an HTTP call to the payment gateway
    // For now, validate the payment parameters locally
    if (!amount || amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    if (!['card', 'wallet', 'bank_transfer'].includes(method)) {
      return { success: false, error: 'Invalid payment method' };
    }

    // Simulate gateway call
    // In production: const response = await fetch(GATEWAY_URL + '/charges', { ... })
    const paymentId = `pay_${crypto.randomBytes(16).toString('hex')}`;

    return {
      success: true,
      paymentId,
      amount,
      method,
      idempotencyKey,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Refund a payment
 * @param {string} paymentId - Original payment ID
 * @param {number} amount - Refund amount in cents (partial refund supported)
 * @returns {Object} { success, refundId, error }
 */
async function refundPayment(paymentId, amount) {
  try {
    if (!paymentId) {
      return { success: false, error: 'Payment ID required' };
    }

    const refundId = `ref_${crypto.randomBytes(16).toString('hex')}`;
    return { success: true, refundId, amount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { processPayment, refundPayment };
