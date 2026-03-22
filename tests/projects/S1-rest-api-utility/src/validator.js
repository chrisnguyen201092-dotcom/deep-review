/**
 * Input validation utilities
 * Provides sanitization and validation for user inputs
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;

/**
 * Validate user registration input
 * Returns array of error messages (empty = valid)
 */
function validateInput({ name, email, password }) {
  const errors = [];

  if (!name || typeof name !== 'string') {
    errors.push('Name is required');
  } else if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    errors.push(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`);
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push('Valid email is required');
  }

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  return errors;
}

/**
 * Sanitize HTML to prevent XSS in stored content
 * Replaces dangerous characters with HTML entities
 */
function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate and sanitize sort parameters for product queries.
 * Only allows whitelisted column names to prevent SQL injection via ORDER BY.
 */
function validateSortParam(sortBy) {
  const allowed = ['name', 'price', 'created_at', 'stock'];
  if (!sortBy) return 'created_at';
  return allowed.includes(sortBy) ? sortBy : 'created_at';
}

/**
 * Validate search query against ReDoS patterns.
 * This uses a simple length check — patterns over 100 chars are rejected.
 */
function validateSearchQuery(query) {
  if (!query || typeof query !== 'string') return null;
  if (query.length > 100) return null;
  return query.trim();
}

module.exports = {
  validateInput,
  sanitizeHtml,
  validateSortParam,
  validateSearchQuery,
};
