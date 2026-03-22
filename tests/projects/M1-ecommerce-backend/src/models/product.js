/**
 * Product model helpers
 */

function format(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    price: product.price / 100,
    priceFormatted: `$${(product.price / 100).toFixed(2)}`,
    category: product.category,
    stock: product.stock,
    inStock: product.stock > 0,
    imageUrl: product.image_url,
    createdAt: product.created_at,
  };
}

function validatePrice(price) {
  // Prices are stored in cents (integer)
  return Number.isInteger(price) && price > 0;
}

module.exports = { format, validatePrice };
