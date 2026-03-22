const http = require('http');
const https = require('https');
const { URL } = require('url');
const { CircuitBreaker } = require('../resilience/circuitBreaker');
const { ResponseCache } = require('../cache/responseCache');

const breakers = {};
const cache = new ResponseCache();

class ProxyHandler {
  constructor(config) {
    this.config = config;
    this.timeout = config.proxyTimeout || 30000;
  }

  async forward(clientReq, clientRes, route) {
    const upstream = route.upstream;
    const targetUrl = new URL(`${upstream.url}${clientReq.pathname}`);
    
    // Add query parameters
    if (clientReq.query) {
      for (const [key, value] of Object.entries(clientReq.query)) {
        targetUrl.searchParams.set(key, value);
      }
    }

    // Check cache for GET requests
    if (clientReq.method === 'GET' && route.cache) {
      const cached = cache.get(targetUrl.toString());
      if (cached) {
        clientRes.writeHead(200, { 'Content-Type': cached.contentType, 'X-Cache': 'HIT' });
        return clientRes.end(cached.body);
      }
    }

    // Circuit breaker
    const breakerKey = upstream.name || upstream.url;
    if (!breakers[breakerKey]) {
      breakers[breakerKey] = new CircuitBreaker(upstream.name, {
        threshold: route.circuitBreaker?.threshold || 5,
        timeout: route.circuitBreaker?.timeout || 30000,
      });
    }
    const breaker = breakers[breakerKey];
    if (!breaker.isAllowed()) {
      clientRes.writeHead(503, { 'Content-Type': 'application/json' });
      return clientRes.end(JSON.stringify({ error: 'Service unavailable (circuit open)' }));
    }

    return new Promise((resolve, reject) => {
      const protocol = targetUrl.protocol === 'https:' ? https : http;
      
      const headers = { ...clientReq.headers };
      headers.host = targetUrl.host;
      
      // Forward user identity
      if (clientReq.user) {
        headers['x-user-id'] = String(clientReq.user.id);
        headers['x-user-role'] = clientReq.user.role;
        headers['x-user-email'] = clientReq.user.email;
      }

      // Add gateway headers
      headers['x-forwarded-for'] = clientReq.socket.remoteAddress;
      headers['x-forwarded-proto'] = 'http';
      headers['x-request-id'] = `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: clientReq.method,
        headers,
        timeout: this.timeout,
      };

      const proxyReq = protocol.request(options, (proxyRes) => {
        breaker.recordSuccess();

        // Cache successful GET responses
        if (clientReq.method === 'GET' && route.cache && proxyRes.statusCode === 200) {
          let body = '';
          proxyRes.on('data', chunk => body += chunk);
          proxyRes.on('end', () => {
            cache.set(targetUrl.toString(), {
              body,
              contentType: proxyRes.headers['content-type'],
            }, route.cache.ttl || 60);
            clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
            clientRes.end(body);
            resolve();
          });
        } else {
          clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(clientRes);
          proxyRes.on('end', resolve);
        }
      });

      proxyReq.on('error', (err) => {
        breaker.recordFailure();
        reject(err);
      });

      proxyReq.on('timeout', () => {
        breaker.recordFailure();
        proxyReq.destroy();
        reject(new Error('Upstream timeout'));
      });

      // Pipe request body
      clientReq.pipe(proxyReq);
    });
  }
}

module.exports = { ProxyHandler };
