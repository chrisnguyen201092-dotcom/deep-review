const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret, jwtRefreshSecret, jwtResetSecret } = require('../config/security');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const RESET_TOKEN_EXPIRY = '1h';

async function generateTokenPair(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    jwtRefreshSecret,
    { expiresIn: REFRESH_TOKEN_EXPIRY, algorithm: 'HS256' }
  );

  return { accessToken, refreshToken };
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (err) {
    return null;
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, jwtRefreshSecret);
  } catch (err) {
    return null;
  }
}

async function generateResetToken(user) {
  return jwt.sign(
    { id: user.id, type: 'reset' },
    jwtResetSecret,
    { expiresIn: RESET_TOKEN_EXPIRY }
  );
}

function verifyResetToken(token) {
  try {
    return jwt.verify(token, jwtResetSecret);
  } catch (err) {
    return null;
  }
}

/**
 * Generate a cryptographically secure API key
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  generateResetToken,
  verifyResetToken,
  generateApiKey,
};
