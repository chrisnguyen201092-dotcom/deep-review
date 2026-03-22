const bcrypt = require('bcrypt');
const db = require('../models/db');

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

async function createUser({ name, email, password }) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await db.query(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, hashedPassword, 'user']
  );
  return { id: result.insertId, name, email, role: 'user' };
}

async function verifyPassword(plaintext, hashed) {
  return bcrypt.compare(plaintext, hashed);
}

async function updatePassword(userId, newPassword) {
  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
}

async function recordFailedLogin(userId) {
  await db.query(
    `UPDATE users SET failed_login_attempts = failed_login_attempts + 1, 
     last_failed_login_at = NOW() WHERE id = ?`,
    [userId]
  );
}

async function clearFailedLogins(userId) {
  await db.query(
    'UPDATE users SET failed_login_attempts = 0, last_failed_login_at = NULL WHERE id = ?',
    [userId]
  );
}

async function isAccountLocked(userId) {
  const [user] = await db.query(
    'SELECT failed_login_attempts, last_failed_login_at FROM users WHERE id = ?',
    [userId]
  );
  if (!user) return false;
  if (user.failed_login_attempts < MAX_FAILED_ATTEMPTS) return false;

  const lockoutExpiry = new Date(user.last_failed_login_at).getTime() + LOCKOUT_DURATION_MS;
  return Date.now() < lockoutExpiry;
}

module.exports = { createUser, verifyPassword, updatePassword, recordFailedLogin, clearFailedLogins, isAccountLocked };
