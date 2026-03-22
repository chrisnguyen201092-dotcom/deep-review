/**
 * Email notification service
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT) || 587,
  auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
});

async function sendInvite(toEmail, tenantName, inviteToken) {
  const inviteUrl = `${process.env.APP_URL || 'http://localhost:3000'}/accept-invite?token=${inviteToken}`;
  await transporter.sendMail({
    from: `SaaS Platform <noreply@${process.env.MAIL_DOMAIN || 'example.com'}>`,
    to: toEmail,
    subject: `You're invited to join ${tenantName}`,
    html: `<p>Click <a href="${inviteUrl}">here</a> to accept your invitation.</p>`,
  });
}

async function sendBillingAlert(toEmail, tenantName, message) {
  await transporter.sendMail({
    from: `SaaS Platform <noreply@${process.env.MAIL_DOMAIN || 'example.com'}>`,
    to: toEmail,
    subject: `Billing Alert — ${tenantName}`,
    html: `<p>${message}</p>`,
  });
}

module.exports = { sendInvite, sendBillingAlert };
