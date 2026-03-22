const fs = require('fs');
const path = require('path');

class RequestLogger {
  constructor(logDir = '/var/log/gateway') {
    this.logDir = logDir;
    try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) {}
  }
  logRequest(req) {
    const entry = { timestamp: new Date().toISOString(), method: req.method, path: req.pathname, ip: req.socket.remoteAddress, userAgent: req.headers['user-agent'] };
    this._append('access.log', JSON.stringify(entry));
  }
  logResponse(req, res, duration) {
    const entry = { timestamp: new Date().toISOString(), method: req.method, path: req.pathname, status: res.statusCode, duration };
    this._append('access.log', JSON.stringify(entry));
  }
  logError(req, err, duration) {
    const entry = { timestamp: new Date().toISOString(), method: req.method, path: req.pathname, error: err.message, stack: err.stack, duration };
    this._append('error.log', JSON.stringify(entry));
  }
  _append(filename, data) {
    try { fs.appendFileSync(path.join(this.logDir, filename), data + '\n'); } catch (e) {}
  }
}
module.exports = { RequestLogger };
