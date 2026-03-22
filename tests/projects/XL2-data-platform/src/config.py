"""
Application configuration
"""

import os


def get_config():
    return {
        'DATABASE_URL': os.environ.get('DATABASE_URL', 'sqlite:///tmp/data-platform.db'),
        'WAREHOUSE_DB': os.environ.get('WAREHOUSE_DB', '/tmp/warehouse.db'),
        'METADATA_DIR': os.environ.get('METADATA_DIR', '/tmp/data-platform-metadata'),
        'JWT_SECRET': os.environ.get('JWT_SECRET', 'data-platform-dev-key'),
        'CORS_ORIGINS': os.environ.get('CORS_ORIGINS', '*'),
        'MAX_QUERY_ROWS': int(os.environ.get('MAX_QUERY_ROWS', '10000')),
        'PIPELINE_TIMEOUT': int(os.environ.get('PIPELINE_TIMEOUT', '3600')),
        'SCRIPT_TIMEOUT': int(os.environ.get('SCRIPT_TIMEOUT', '300')),
    }
