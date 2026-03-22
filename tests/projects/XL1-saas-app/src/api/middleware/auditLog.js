const db = require('../../storage/database');

function auditLog(req, res, next) {
  const originalEnd = res.end;
  res.end = function (...args) {
    if (req.user && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const entry = {
        tenant_id: req.user.tenantId || null,
        user_id: req.user.id,
        action: `${req.method} ${req.path}`,
        status_code: res.statusCode,
        ip: req.ip,
      };
      db.query('INSERT INTO audit_log (tenant_id, user_id, action, status_code, ip, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [entry.tenant_id, entry.user_id, entry.action, entry.status_code, entry.ip]
      ).catch(() => {});
    }
    originalEnd.apply(res, args);
  };
  next();
}

module.exports = { auditLog };
