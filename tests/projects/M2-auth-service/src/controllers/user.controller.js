const User = require('../models/user.model');

async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(User.sanitize(user));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

async function updateProfile(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    await User.update(req.user.id, { name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await User.findById(req.user.id);
    const authService = require('../services/auth.service');
    const valid = await authService.verifyPassword(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await authService.updatePassword(req.user.id, newPassword);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
}

async function listSessions(req, res) {
  try {
    const Session = require('../models/session.model');
    const sessions = await Session.findByUserId(req.user.id);
    res.json(sessions.map(s => ({
      id: s.id,
      ip: s.ip_address,
      userAgent: s.user_agent,
      createdAt: s.created_at,
      lastUsed: s.last_used_at,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}

async function revokeSession(req, res) {
  try {
    const Session = require('../models/session.model');
    await Session.revoke(req.params.sessionId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
}

module.exports = { getProfile, updateProfile, changePassword, listSessions, revokeSession };
