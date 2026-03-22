/**
 * Response formatting utilities
 * Standardizes API output shape for consistency
 */

/**
 * Format a user record for API response
 * Strips sensitive fields, normalizes structure
 */
function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/**
 * Format a product record for API response
 * Converts price from cents to dollars for display
 */
function formatProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    price: product.price / 100,
    priceFormatted: `$${(product.price / 100).toFixed(2)}`,
    category: product.category,
    stock: product.stock,
    inStock: product.stock > 0,
    createdAt: product.created_at,
  };
}

/**
 * Wrap results in a paginated envelope
 */
function formatPaginated(items, total, page, limit) {
  return {
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

module.exports = { formatUser, formatProduct, formatPaginated };
