/**
 * Health check service — monitors upstream service health
 */
const http = require('http');
const https = require('https');

class HealthChecker {
  constructor(services = [], interval = 30000) {
    this.services = services;
    this.interval = interval;
    this.status = {};
    this._timer = null;
  }
  start() {
    this._check();
    this._timer = setInterval(() => this._check(), this.interval);
  }
  stop() { if (this._timer) clearInterval(this._timer); }
  async _check() {
    for (const service of this.services) {
      try {
        const healthy = await this._ping(service.url + '/health');
        this.status[service.name] = { healthy, lastCheck: new Date().toISOString() };
      } catch (err) {
        this.status[service.name] = { healthy: false, error: err.message, lastCheck: new Date().toISOString() };
      }
    }
  }
  _ping(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, { timeout: 5000 }, (res) => { resolve(res.statusCode === 200); });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }
  getStatus() { return this.status; }
}
module.exports = { HealthChecker };
