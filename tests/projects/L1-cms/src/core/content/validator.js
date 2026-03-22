function validateContent({ title, body, type }) {
  const errors = [];
  if (!title || typeof title !== 'string' || title.trim().length < 3) errors.push('Title must be at least 3 characters');
  if (title && title.length > 300) errors.push('Title must not exceed 300 characters');
  if (!body || typeof body !== 'string' || body.trim().length < 10) errors.push('Body must be at least 10 characters');
  if (type && !['article', 'page', 'snippet', 'blog'].includes(type)) errors.push('Invalid content type');
  return errors;
}
module.exports = { validateContent };
