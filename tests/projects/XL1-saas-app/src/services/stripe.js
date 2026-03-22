/**
 * Stripe integration service (mock for testing)
 */

class StripeService {
  constructor() {
    this.apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_fake';
  }

  async createCustomer(name, email) {
    // In production: stripe.customers.create({ name, email })
    return `cus_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  async createSubscription(customerId, plan, priceInCents) {
    // In production: stripe.subscriptions.create(...)
    return { id: `sub_${Date.now()}`, status: 'active', plan, amount: priceInCents };
  }

  async addPaymentMethod(customerId, cardDetails) {
    // In production: use Stripe.js on frontend, then attach payment method
    // This mock accepts raw card details which is a PCI violation
    return { id: `pm_${Date.now()}`, last4: cardDetails.cardNumber.slice(-4) };
  }

  async cancelSubscription(subscriptionId) {
    return { id: subscriptionId, status: 'cancelled' };
  }

  async createInvoice(customerId, items) {
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    return { id: `inv_${Date.now()}`, total, status: 'paid' };
  }
}

module.exports = StripeService;
