/**
 * Email service for sending transactional emails
 * Uses SMTP transport (configurable)
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const FROM_ADDRESS = process.env.FROM_EMAIL || 'noreply@example.com';
const APP_NAME = process.env.APP_NAME || 'AuthService';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

async function sendPasswordReset(email, resetToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  await transporter.sendMail({
    from: `${APP_NAME} <${FROM_ADDRESS}>`,
    to: email,
    subject: `${APP_NAME} — Password Reset`,
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });
}

async function sendWelcome(email, name) {
  await transporter.sendMail({
    from: `${APP_NAME} <${FROM_ADDRESS}>`,
    to: email,
    subject: `Welcome to ${APP_NAME}!`,
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>Your account has been created successfully.</p>
      <p>Get started by visiting <a href="${APP_URL}">${APP_URL}</a>.</p>
    `,
  });
}

async function sendSecurityAlert(email, action, ip) {
  await transporter.sendMail({
    from: `${APP_NAME} <${FROM_ADDRESS}>`,
    to: email,
    subject: `${APP_NAME} — Security Alert`,
    html: `
      <h2>Security Alert</h2>
      <p>The following action was performed on your account:</p>
      <p><strong>${action}</strong></p>
      <p>IP Address: ${ip}</p>
      <p>If this was not you, please change your password immediately.</p>
    `,
  });
}

module.exports = { sendPasswordReset, sendWelcome, sendSecurityAlert };
