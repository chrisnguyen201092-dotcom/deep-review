const db = require('../../storage/database');
const slugify = require('../../utils/helpers').slugify;

class ContentService {
  async list(filters = {}, options = {}) {
    const { page = 1, limit = 20, sortBy = 'created_at', order = 'DESC' } = options;
    let conditions = [];
    let params = [];
    if (filters.status) { conditions.push('c.status = ?'); params.push(filters.status); }
    if (filters.type) { conditions.push('c.type = ?'); params.push(filters.type); }
    if (filters.authorId) { conditions.push('c.author_id = ?'); params.push(filters.authorId); }
    if (filters.tag) { conditions.push("c.id IN (SELECT content_id FROM content_tags WHERE tag = ?)"); params.push(filters.tag); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const allowedSort = ['created_at', 'published_at', 'title', 'views'];
    const sort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const [items, countResult] = await Promise.all([
      db.query(`SELECT c.*, u.name as author_name FROM content c LEFT JOIN users u ON c.author_id = u.id ${where} ORDER BY c.${sort} ${order} LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]),
      db.query(`SELECT COUNT(*) as total FROM content c ${where}`, params),
    ]);
    return { data: items, pagination: { page, limit, total: countResult[0].total } };
  }

  async getById(id) {
    const rows = await db.query('SELECT c.*, u.name as author_name FROM content c LEFT JOIN users u ON c.author_id = u.id WHERE c.id = ?', [id]);
    return rows[0] || null;
  }

  async getByIdOrSlug(identifier) {
    const rows = await db.query('SELECT c.*, u.name as author_name FROM content c LEFT JOIN users u ON c.author_id = u.id WHERE c.id = ? OR c.slug = ?', [identifier, identifier]);
    return rows[0] || null;
  }

  async create(data) {
    const slug = slugify(data.title);
    const result = await db.query(
      'INSERT INTO content (title, slug, body, type, status, author_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.title, slug, data.body, data.type, data.status, data.authorId, JSON.stringify(data.metadata || {})]
    );
    if (data.tags && data.tags.length > 0) {
      for (const tag of data.tags) {
        await db.query('INSERT INTO content_tags (content_id, tag) VALUES (?, ?)', [result.insertId, tag]);
      }
    }
    return this.getById(result.insertId);
  }

  async update(id, data) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
      if (['title', 'body', 'type', 'status', 'metadata'].includes(key)) {
        fields.push(`${key} = ?`);
        params.push(key === 'metadata' ? JSON.stringify(value) : value);
      }
    }
    if (data.title) { fields.push('slug = ?'); params.push(slugify(data.title)); }
    if (fields.length > 0) {
      fields.push('updated_at = NOW()');
      params.push(id);
      await db.query(`UPDATE content SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    // Save version for revision history
    const content = await this.getById(id);
    if (content) {
      await db.query('INSERT INTO content_versions (content_id, title, body, saved_by) VALUES (?, ?, ?, ?)',
        [id, content.title, content.body, data.savedBy || content.author_id]);
    }
    return this.getById(id);
  }

  async publish(id, userId) {
    await db.query("UPDATE content SET status = 'published', published_at = NOW() WHERE id = ?", [id]);
    return this.getById(id);
  }

  async delete(id) {
    await db.query('DELETE FROM content_tags WHERE content_id = ?', [id]);
    await db.query('DELETE FROM content_versions WHERE content_id = ?', [id]);
    await db.query('DELETE FROM content WHERE id = ?', [id]);
  }

  async trackView(contentId, ip) {
    // Debounce: only count 1 view per IP per hour
    const recent = await db.query(
      "SELECT id FROM content_views WHERE content_id = ? AND ip = ? AND viewed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
      [contentId, ip]
    );
    if (recent.length === 0) {
      await db.query('INSERT INTO content_views (content_id, ip, viewed_at) VALUES (?, ?, NOW())', [contentId, ip]);
      await db.query('UPDATE content SET views = views + 1 WHERE id = ?', [contentId]);
    }
  }

  async getVersions(contentId) {
    return db.query('SELECT id, title, saved_by, created_at FROM content_versions WHERE content_id = ? ORDER BY created_at DESC', [contentId]);
  }
}

module.exports = ContentService;
