const db = require('../../storage/database');

class SearchService {
  async search(query, filters = {}, options = {}) {
    const { page = 1, limit = 20 } = options;
    let conditions = ["MATCH(c.title, c.body) AGAINST(? IN NATURAL LANGUAGE MODE)"];
    let params = [query];
    if (filters.status) { conditions.push('c.status = ?'); params.push(filters.status); }
    if (filters.type) { conditions.push('c.type = ?'); params.push(filters.type); }
    const where = 'WHERE ' + conditions.join(' AND ');
    const items = await db.query(
      `SELECT c.id, c.title, c.slug, c.type, c.status, c.published_at, c.views,
       MATCH(c.title, c.body) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
       FROM content c ${where}
       ORDER BY relevance DESC LIMIT ? OFFSET ?`,
      [query, ...params, limit, (page - 1) * limit]
    );
    return { data: items, query, page, limit };
  }

  async suggest(query, maxResults = 10) {
    const rows = await db.query(
      "SELECT DISTINCT title FROM content WHERE title LIKE ? AND status = 'published' LIMIT ?",
      [`%${query}%`, maxResults]
    );
    return rows.map(r => r.title);
  }
}

module.exports = SearchService;
