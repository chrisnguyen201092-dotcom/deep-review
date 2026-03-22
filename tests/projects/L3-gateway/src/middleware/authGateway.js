const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthGateway {
  constructor(config = {}) {
    this.jwtSecret = config.jwtSecret || process.env.JWT_SECRET || 'gateway-secret';
    this.apiKeys = new Map(Object.entries(config.apiKeys || {}));
  }

  async authenticate(req) {
    const authHeader = req.headers.authorization || '';
    
    // Try JWT Bearer token
    if (authHeader.startsWith('Bearer ')) {
      return this._verifyJwt(authHeader.substring(7));
    }
    
    // Try API key
    const apiKey = req.headers['x-api-key'] || req.query?.apiKey;
    if (apiKey) {
      return this._verifyApiKey(apiKey);
    }

    return { authenticated: false };
  }

  _verifyJwt(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return { authenticated: true, user: decoded };
    } catch (err) {
      return { authenticated: false };
    }
  }

  _verifyApiKey(key) {
    for (const [name, config] of this.apiKeys.entries()) {
      if (key === config.key) {
        return { authenticated: true, user: { id: name, role: config.role || 'service' } };
      }
    }
    return { authenticated: false };
  }
}

module.exports = { AuthGateway };
