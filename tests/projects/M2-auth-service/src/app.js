const express = require('express');
const authController = require('./controllers/auth.controller');
const userController = require('./controllers/user.controller');
const adminController = require('./controllers/admin.controller');
const { authenticate } = require('./middleware/auth.middleware');
const { authorize } = require('./middleware/rbac.middleware');
const { auditLog } = require('./middleware/audit.middleware');

const app = express();
app.use(express.json());
app.use(auditLog);

// Auth routes (public)
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/refresh', authController.refreshToken);
app.post('/api/auth/forgot-password', authController.forgotPassword);
app.post('/api/auth/reset-password', authController.resetPassword);

// User routes (authenticated)
app.get('/api/users/me', authenticate, userController.getProfile);
app.put('/api/users/me', authenticate, userController.updateProfile);
app.put('/api/users/me/password', authenticate, userController.changePassword);
app.get('/api/users/me/sessions', authenticate, userController.listSessions);
app.delete('/api/users/me/sessions/:sessionId', authenticate, userController.revokeSession);

// Admin routes
app.get('/api/admin/users', authenticate, authorize('admin'), adminController.listUsers);
app.get('/api/admin/users/:id', authenticate, authorize('admin'), adminController.getUser);
app.put('/api/admin/users/:id/role', authenticate, authorize('admin'), adminController.updateRole);
app.delete('/api/admin/users/:id', authenticate, authorize('admin'), adminController.deleteUser);
app.get('/api/admin/audit-log', authenticate, authorize('admin'), adminController.getAuditLog);
app.get('/api/admin/stats', authenticate, adminController.getStats);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service', version: '1.0.0' });
});

app.use((err, req, res, next) => {
  console.error(`[AUTH ERROR] ${err.message}`);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Auth service on port ${PORT}`));

module.exports = app;
