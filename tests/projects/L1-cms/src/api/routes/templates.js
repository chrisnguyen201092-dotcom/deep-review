const express = require('express');
const router = express.Router();
const db = require('../../storage/database');
const { authorize } = require('../middleware/auth');

// List templates
router.get('/', async (req, res) => {
  try {
    const templates = await db.query('SELECT * FROM templates ORDER BY name ASC');
    res.json(templates);
  } catch (err) { res.status(500).json({ error: 'Failed to list templates' }); }
});

// Get template by ID
router.get('/:id', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch template' }); }
});

// Create template (admin only)
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, body, type } = req.body;
    if (!name || !body) return res.status(400).json({ error: 'Name and body required' });
    const result = await db.query(
      'INSERT INTO templates (name, body, type, created_by) VALUES (?, ?, ?, ?)',
      [name, body, type || 'page', req.user.id]
    );
    res.status(201).json({ id: result.insertId, name, type });
  } catch (err) { res.status(500).json({ error: 'Failed to create template' }); }
});

// Render template with data (preview)
router.post('/:id/render', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const template = rows[0];
    // Simple template rendering — replace {{variables}} with provided data
    let rendered = template.body;
    const data = req.body.data || {};
    for (const [key, value] of Object.entries(data)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    res.json({ rendered });
  } catch (err) { res.status(500).json({ error: 'Render failed' }); }
});

module.exports = router;
