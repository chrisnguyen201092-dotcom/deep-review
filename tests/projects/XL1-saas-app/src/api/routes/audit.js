const express = require('express');
const router = express.Router();
const db = require('../../storage/database');

// Get audit log
router.get('/', async (req, res) => {
  try {
    const { action, userId, page, limit } = req.query;
    let where = 'WHERE tenant_id = ?';
    const params = [req.tenantId];
    if (action) { where += ' AND action = ?'; params.push(action); }
    if (userId) { where += ' AND user_id = ?'; params.push(userId); }
    const p = parseInt(page) || 1;
    const l = Math.min(parseInt(limit) || 50, 200);
    const logs = await db.query(
      `SELECT a.*, u.name as user_name FROM audit_log a LEFT JOIN users u ON a.user_id = u.id ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, l, (p - 1) * l]
    );
    res.json({ data: logs, page: p, limit: l });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
