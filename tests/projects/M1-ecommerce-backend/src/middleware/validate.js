/**
 * Request validation middleware
 * Validates request body against predefined schemas
 */

const schemas = {
  createProduct: {
    required: ['name', 'price'],
    rules: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      price: { type: 'number', min: 1 },
      description: { type: 'string', maxLength: 5000 },
      category: { type: 'string', maxLength: 50 },
      stock: { type: 'number', min: 0 },
    },
  },
  createReview: {
    required: ['rating', 'comment'],
    rules: {
      rating: { type: 'number', min: 1, max: 5 },
      comment: { type: 'string', minLength: 10, maxLength: 2000 },
    },
  },
};

function validateRequest(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();

    const errors = [];
    const body = req.body || {};

    // Check required fields
    for (const field of schema.required || []) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`${field} is required`);
      }
    }

    // Validate field rules
    for (const [field, rules] of Object.entries(schema.rules || {})) {
      const value = body[field];
      if (value === undefined) continue;

      if (rules.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`);
          continue;
        }
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters`);
        }
      }

      if (rules.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${field} must be a number`);
          continue;
        }
        if (rules.min !== undefined && num < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && num > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    next();
  };
}

module.exports = { validateRequest };
