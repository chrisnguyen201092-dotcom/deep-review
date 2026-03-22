const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function loadConfig(configPath) {
  configPath = configPath || process.env.GATEWAY_CONFIG || path.join(__dirname, '../../config.yaml');
  
  let config;
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(raw);
  } catch (err) {
    console.warn(`Config file not found at ${configPath}, using defaults`);
    config = getDefaults();
  }

  // Merge with environment variables
  config.port = parseInt(process.env.PORT) || config.port || 8080;
  config.auth = config.auth || {};
  config.auth.jwtSecret = process.env.JWT_SECRET || config.auth.jwtSecret || 'gateway-secret';

  return config;
}

function getDefaults() {
  return {
    port: 8080,
    routes: [
      { path: '/api/users/*', upstream: { url: 'http://localhost:3001', name: 'user-service' }, methods: ['GET', 'POST', 'PUT', 'DELETE'] },
      { path: '/api/products/*', upstream: { url: 'http://localhost:3002', name: 'product-service' }, methods: ['GET', 'POST', 'PUT', 'DELETE'] },
      { path: '/api/orders/*', upstream: { url: 'http://localhost:3003', name: 'order-service' }, auth: true },
    ],
    rateLimit: { windowMs: 60000, maxRequests: 100 },
    auth: { jwtSecret: 'gateway-secret', apiKeys: {} },
    proxyTimeout: 30000,
  };
}

module.exports = { loadConfig, getDefaults };
