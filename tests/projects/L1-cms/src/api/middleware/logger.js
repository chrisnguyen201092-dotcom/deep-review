function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, path } = req;
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${level}] ${method} ${path} ${res.statusCode} ${duration}ms`);
  });
  next();
}
module.exports = { requestLogger };
