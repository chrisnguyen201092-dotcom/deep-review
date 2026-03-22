/**
 * Content renderer - transforms markdown/rich text to HTML
 */
const { sanitizeHtml } = require('../../utils/helpers');

function renderMarkdown(markdown) {
  // Basic markdown rendering
  let html = markdown
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
  return html;
}

function renderContent(content) {
  if (content.type === 'article' || content.type === 'blog') {
    return { ...content, rendered: renderMarkdown(content.body) };
  }
  return { ...content, rendered: sanitizeHtml(content.body) };
}

module.exports = { renderMarkdown, renderContent };
