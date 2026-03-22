"""
Notification service for alerts and scheduled reports
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


class NotificationService:
    def __init__(self):
        self.smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        self.smtp_user = os.environ.get('SMTP_USER', '')
        self.smtp_pass = os.environ.get('SMTP_PASS', '')
        self.from_addr = os.environ.get('FROM_EMAIL', 'analytics@example.com')

    def send_email(self, to, subject, body, html=False):
        msg = MIMEMultipart()
        msg['From'] = self.from_addr
        msg['To'] = to
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html' if html else 'plain'))

        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls()
            if self.smtp_user and self.smtp_pass:
                server.login(self.smtp_user, self.smtp_pass)
            server.send_message(msg)

    def send_alert(self, to, alert_name, metric_value, threshold):
        subject = f"Analytics Alert: {alert_name}"
        body = f"""
        <h2>Alert Triggered: {alert_name}</h2>
        <p>Current value: <strong>{metric_value}</strong></p>
        <p>Threshold: {threshold}</p>
        <p>Time: {__import__('datetime').datetime.utcnow().isoformat()}</p>
        """
        self.send_email(to, subject, body, html=True)

    def send_report(self, to, report_name, report_data):
        subject = f"Scheduled Report: {report_name}"
        body = f"""
        <h2>{report_name}</h2>
        <p>Report generated at {__import__('datetime').datetime.utcnow().isoformat()}</p>
        <pre>{report_data}</pre>
        """
        self.send_email(to, subject, body, html=True)
