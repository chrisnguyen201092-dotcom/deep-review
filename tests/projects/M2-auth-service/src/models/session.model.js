const db = require('./db');

async function create(userId, refreshToken, ip, userAgent) {
  await db.query(
    `INSERT INTO sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [userId, refreshToken, ip, userAgent]
  );
}

async function findByToken(token) {
  const rows = await db.query(
    'SELECT * FROM sessions WHERE refresh_token = ? AND expires_at > NOW()',
    [token]
  );
  return rows[0] || null;
}

async function findByUserId(userId) {
  return db.query(
    'SELECT * FROM sessions WHERE user_id = ? AND expires_at > NOW() ORDER BY created_at DESC',
    [userId]
  );
}

async function updateToken(sessionId, newToken) {
  await db.query(
    'UPDATE sessions SET refresh_token = ?, last_used_at = NOW() WHERE id = ?',
    [newToken, sessionId]
  );
}

async function revoke(sessionId, userId) {
  await db.query(
    'DELETE FROM sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId]
  );
}

async function revokeAllForUser(userId) {
  await db.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

module.exports = { create, findByToken, findByUserId, updateToken, revoke, revokeAllForUser };
