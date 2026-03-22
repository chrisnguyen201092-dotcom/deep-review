/**
 * Database connection wrapper
 * Uses mysql2 pool for connection management
 */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'api_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Execute a parameterized query
 * Always use parameterized queries with this wrapper
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Get a connection from the pool (for transactions)
 */
async function getConnection() {
  return pool.getConnection();
}

module.exports = { query, getConnection };
