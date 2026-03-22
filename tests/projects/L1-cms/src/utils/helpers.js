/**
 * Utility functions
 */

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 100);
}

function sanitizeHtml(html) {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(text, maxLen = 200) {
  if (!text || text.length <= maxLen) return text;
  return text.substring(0, maxLen).replace(/\s\S*$/, '') + '...';
}

function formatDate(date) {
  return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
}

function generateSlug(text, existingSlugs = []) {
  let slug = slugify(text);
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${slugify(text)}-${counter++}`;
  }
  return slug;
}

module.exports = { slugify, sanitizeHtml, truncate, formatDate, generateSlug };
