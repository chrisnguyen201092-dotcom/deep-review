const db = require('../../storage/database');

class SearchIndexer {
  async reindex() {
    // MySQL FULLTEXT indexes are maintained automatically
    // This is for custom search features like tag aggregation
    const tags = await db.query('SELECT DISTINCT tag, COUNT(*) as count FROM content_tags GROUP BY tag ORDER BY count DESC');
    return { tags, indexedAt: new Date().toISOString() };
  }
}

module.exports = SearchIndexer;
