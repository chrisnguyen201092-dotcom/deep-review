const express = require('express');
const router = express.Router();
const ContentService = require('../../core/content/contentService');
const { validateContent } = require('../../core/content/validator');
const { authorize } = require('../middleware/auth');

const contentService = new ContentService();

// List content with filtering
router.get('/', async (req, res) => {
  try {
    const { type, status, author, tag, page, limit, sortBy, order } = req.query;
    const filters = {};
    if (type) filters.type = type;
    if (status) {
      // Published content visible to all, drafts only to authenticated users
      if (status === 'draft' && !req.user) {
        return res.status(401).json({ error: 'Authentication required for drafts' });
      }
      filters.status = status;
    } else if (!req.user) {
      filters.status = 'published'; // Default to published for unauthenticated
    }
    if (author) filters.authorId = author;
    if (tag) filters.tag = tag;

    const result = await contentService.list(filters, {
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      sortBy: sortBy || 'published_at',
      order: order === 'asc' ? 'ASC' : 'DESC',
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list content' });
  }
});

// Get single content by ID or slug
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const content = await contentService.getByIdOrSlug(identifier);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Drafts require authentication
    if (content.status === 'draft' && !req.user) {
      return res.status(404).json({ error: 'Content not found' }); // Don't reveal existence
    }

    // Track view
    await contentService.trackView(content.id, req.ip);

    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Create content
router.post('/', authorize('editor', 'admin'), async (req, res) => {
  try {
    const { title, body, type, tags, metadata, status } = req.body;
    
    const errors = validateContent({ title, body, type });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const content = await contentService.create({
      title,
      body,
      type: type || 'article',
      tags: tags || [],
      metadata: metadata || {},
      status: status || 'draft',
      authorId: req.user.id,
    });

    res.status(201).json(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// Update content
router.put('/:id', authorize('editor', 'admin'), async (req, res) => {
  try {
    const existing = await contentService.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Editors can only edit their own content, admins can edit any
    if (req.user.role !== 'admin' && existing.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot edit content by other authors' });
    }

    const updated = await contentService.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// Publish content
router.post('/:id/publish', authorize('editor', 'admin'), async (req, res) => {
  try {
    const content = await contentService.publish(req.params.id, req.user.id);
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish' });
  }
});

// Delete content
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await contentService.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

// Get content versions (revision history)
router.get('/:id/versions', authorize('editor', 'admin'), async (req, res) => {
  try {
    const versions = await contentService.getVersions(req.params.id);
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

module.exports = router;
