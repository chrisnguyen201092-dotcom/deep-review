const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const emailService = require('../services/email.service');
const db = require('../models/db');
const User = require('../models/user.model');
const Session = require('../models/session.model');

async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await authService.createUser({ name, email, password });
    const { accessToken, refreshToken } = await tokenService.generateTokenPair(user);
    await Session.create(user.id, refreshToken, req.ip, req.headers['user-agent']);

    res.status(201).json({
      user: User.sanitize(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await authService.verifyPassword(password, user.password);
    if (!valid) {
      await authService.recordFailedLogin(user.id);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await authService.clearFailedLogins(user.id);
    const { accessToken, refreshToken } = await tokenService.generateTokenPair(user);
    await Session.create(user.id, refreshToken, req.ip, req.headers['user-agent']);

    res.json({
      user: User.sanitize(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
}

async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = tokenService.verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const session = await Session.findByToken(token);
    if (!session) {
      return res.status(401).json({ error: 'Session expired or revoked' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokens = await tokenService.generateTokenPair(user);
    await Session.updateToken(session.id, tokens.refreshToken);

    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await User.findByEmail(email);
    // Always respond success (don't reveal if email exists)
    if (user) {
      const resetToken = await tokenService.generateResetToken(user);
      await emailService.sendPasswordReset(user.email, resetToken);
    }

    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process request' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const decoded = tokenService.verifyResetToken(token);
    if (!decoded) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    await authService.updatePassword(decoded.id, newPassword);
    await Session.revokeAllForUser(decoded.id);

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
}

module.exports = { register, login, refreshToken, forgotPassword, resetPassword };
