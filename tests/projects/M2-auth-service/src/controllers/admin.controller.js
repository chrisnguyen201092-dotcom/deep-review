const User = require('../models/user.model');
const Audit = require('../models/audit.model');
const db = require('../models/db');

async function listUsers(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const [users, countResult] = await Promise.all([
      db.query('SELECT id, name, email, role, created_at, last_login_at FROM users LIMIT ? OFFSET ?', [limit, offset]),
      db.query('SELECT COUNT(*) as total FROM users'),
    ]);

    res.json({
      users: users.map(User.sanitize),
      pagination: { page, limit, total: countResult[0].total },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users' });
  }
}

async function getUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(User.sanitize(user));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

async function updateRole(req, res) {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'moderator', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be: ${validRoles.join(', ')}` });
    }
    await User.update(req.params.id, { role });
    await Audit.log(req.user.id, 'role_change', { targetUser: req.params.id, newRole: role });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
}

async function deleteUser(req, res) {
  try {
    if (req.params.id === String(req.user.id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    await User.delete(req.params.id);
    await Audit.log(req.user.id, 'user_delete', { targetUser: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

async function getAuditLog(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs = await Audit.getRecent(limit, (page - 1) * limit);
    res.json({ logs, pagination: { page, limit } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
}

async function getStats(req, res) {
  try {
    const [userCount, sessionCount, recentLogins] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users'),
      db.query('SELECT COUNT(*) as count FROM sessions WHERE expires_at > NOW()'),
      db.query('SELECT COUNT(*) as count FROM users WHERE last_login_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
    ]);

    res.json({
      totalUsers: userCount[0].count,
      activeSessions: sessionCount[0].count,
      loginsLast24h: recentLogins[0].count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

module.exports = { listUsers, getUser, updateRole, deleteUser, getAuditLog, getStats };
