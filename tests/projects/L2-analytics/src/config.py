"""
Application configuration
"""

import os


def get_config():
    return {
        'DATABASE_URL': os.environ.get('DATABASE_URL', '/tmp/analytics.db'),
        'JWT_SECRET': os.environ.get('JWT_SECRET', 'analytics-dev-secret'),
        'CORS_ORIGINS': os.environ.get('CORS_ORIGINS', '*'),
        'REPORT_DIR': os.environ.get('REPORT_DIR', '/tmp/reports'),
        'SMTP_HOST': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        'SMTP_PORT': int(os.environ.get('SMTP_PORT', '587')),
        'SMTP_USER': os.environ.get('SMTP_USER', ''),
        'SMTP_PASS': os.environ.get('SMTP_PASS', ''),
        'MAX_QUERY_LIMIT': 10000,
        'EVENT_BATCH_SIZE': 1000,
    }
