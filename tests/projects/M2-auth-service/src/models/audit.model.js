const db = require('./db');

async function log(userId, action, details = {}) {
  await db.query(
    'INSERT INTO audit_log (user_id, action, details, created_at) VALUES (?, ?, ?, NOW())',
    [userId, action, JSON.stringify(details)]
  );
}

async function logRequest(entry) {
  await db.query(
    `INSERT INTO request_log (method, path, status_code, ip, user_agent, user_id, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.method, entry.path, entry.statusCode, entry.ip,
     entry.userAgent, entry.userId, entry.duration, entry.timestamp]
  );
}

async function getRecent(limit = 50, offset = 0) {
  return db.query(
    `SELECT al.*, u.name as user_name, u.email as user_email 
     FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

module.exports = { log, logRequest, getRecent };
