"""
Application configuration
"""

import os


DEFAULT_CONFIG = {
    'redis': {
        'host': os.environ.get('REDIS_HOST', 'localhost'),
        'port': int(os.environ.get('REDIS_PORT', '6379')),
        'db': int(os.environ.get('REDIS_DB', '0')),
    },
    'postgres': {
        'host': os.environ.get('PG_HOST', 'localhost'),
        'port': int(os.environ.get('PG_PORT', '5432')),
        'dbname': os.environ.get('PG_DBNAME', 'taskqueue'),
        'user': os.environ.get('PG_USER', 'taskq'),
        'password': os.environ.get('PG_PASSWORD', ''),
    },
    'queue': {
        'max_retries': int(os.environ.get('MAX_RETRIES', '3')),
        'retry_delay': int(os.environ.get('RETRY_DELAY', '60')),
        'poll_interval': float(os.environ.get('POLL_INTERVAL', '1.0')),
        'num_workers': int(os.environ.get('NUM_WORKERS', '4')),
    },
    'api': {
        'host': os.environ.get('API_HOST', '0.0.0.0'),
        'port': int(os.environ.get('API_PORT', '8080')),
        'token': os.environ.get('QUEUE_API_TOKEN', 'dev-token'),
    },
    'storage_backend': os.environ.get('STORAGE_BACKEND', 'redis'),
}


def get_config():
    return DEFAULT_CONFIG
