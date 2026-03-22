/**
 * Order model helpers
 */

function format(order) {
  return {
    id: order.id,
    subtotal: order.subtotal / 100,
    discount: order.discount / 100,
    tax: order.tax / 100,
    shipping: order.shipping / 100,
    total: order.total / 100,
    totalFormatted: `$${(order.total / 100).toFixed(2)}`,
    status: order.status,
    createdAt: order.created_at,
  };
}

module.exports = { format };
