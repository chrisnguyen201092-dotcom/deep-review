const db = require('./db');

async function findByEmail(email) {
  const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

async function update(id, fields) {
  const updates = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = ?`);
    params.push(value);
  }
  params.push(id);
  await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
}

async function deleteUser(id) {
  await db.query('DELETE FROM sessions WHERE user_id = ?', [id]);
  await db.query('DELETE FROM users WHERE id = ?', [id]);
}

function sanitize(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}

module.exports = { findByEmail, findById, update, delete: deleteUser, sanitize };
