const express = require('express');
const router = express.Router();
const SearchService = require('../../core/search/searchService');

const searchService = new SearchService();

// Full-text search
router.get('/', async (req, res) => {
  try {
    const { q, type, page, limit } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const filters = {};
    if (type) filters.type = type;
    if (!req.user) filters.status = 'published';

    const results = await searchService.search(q, filters, {
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 50),
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Suggest/autocomplete
router.get('/suggest', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const suggestions = await searchService.suggest(q, 10);
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: 'Suggest failed' });
  }
});

module.exports = router;
