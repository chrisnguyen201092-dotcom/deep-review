const http = require('http');
const url = require('url');
const { Router } = require('./routing/router');
const { ProxyHandler } = require('./proxy/handler');
const { RateLimiter } = require('./middleware/rateLimiter');
const { AuthGateway } = require('./middleware/authGateway');
const { RequestLogger } = require('./middleware/requestLogger');
const { CircuitBreaker } = require('./resilience/circuitBreaker');
const { loadConfig } = require('./config/loader');

const config = loadConfig();
const router = new Router(config.routes);
const proxy = new ProxyHandler(config);
const rateLimiter = new RateLimiter(config.rateLimit);
const auth = new AuthGateway(config.auth);
const logger = new RequestLogger();

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Parse request
    const parsedUrl = url.parse(req.url, true);
    req.pathname = parsedUrl.pathname;
    req.query = parsedUrl.query;

    // Request logging
    logger.logRequest(req);

    // Rate limiting
    const rateLimitResult = rateLimiter.check(req);
    if (!rateLimitResult.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': rateLimitResult.retryAfter });
      return res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
    }

    // Route matching
    const route = router.match(req.method, req.pathname);
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Not found' }));
    }

    // Authentication (if route requires it)
    if (route.auth !== false) {
      const authResult = await auth.authenticate(req);
      if (!authResult.authenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      req.user = authResult.user;
    }

    // Proxy to upstream service
    const upstream = await proxy.forward(req, res, route);
    
    // Log response
    const duration = Date.now() - startTime;
    logger.logResponse(req, res, duration);

  } catch (err) {
    const duration = Date.now() - startTime;
    logger.logError(req, err, duration);
    
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad gateway' }));
    }
  }
});

const PORT = config.port || 8080;
server.listen(PORT, () => console.log(`API Gateway on port ${PORT}`));

module.exports = server;
