"""
Source Manager — Manages data source connections
"""

import uuid
import json
from datetime import datetime
from ..storage.metadata_store import MetadataStore

store = MetadataStore()

SUPPORTED_SOURCES = ['postgres', 'mysql', 'mongodb', 's3', 'api', 'csv']


class SourceManager:
    def create_source(self, source_type, name, connection, user_id):
        if source_type not in SUPPORTED_SOURCES:
            raise ValueError(f"Unsupported source type: {source_type}")

        source_id = str(uuid.uuid4())
        source = {
            'id': source_id,
            'type': source_type,
            'name': name,
            'connection': connection,  # Stored as plain text — includes passwords
            'created_by': user_id,
            'created_at': datetime.utcnow().isoformat(),
        }
        store.save('sources', source_id, source)
        return source

    def get_source(self, source_id):
        return store.get('sources', source_id)

    def list_sources(self):
        sources = store.list('sources')
        # Return without sensitive connection details
        safe_sources = []
        for s in sources:
            safe = {k: v for k, v in s.items() if k != 'connection'}
            safe['connection_type'] = s.get('type')
            safe_sources.append(safe)
        return safe_sources

    def test_connection(self, source_id):
        source = store.get('sources', source_id)
        if not source:
            return {'success': False, 'error': 'Source not found'}
        try:
            conn = source['connection']
            if source['type'] == 'postgres':
                import psycopg2
                c = psycopg2.connect(**conn)
                c.cursor().execute('SELECT 1')
                c.close()
            elif source['type'] == 'mysql':
                import mysql.connector
                c = mysql.connector.connect(**conn)
                c.cursor().execute('SELECT 1')
                c.close()
            elif source['type'] == 's3':
                import boto3
                s3 = boto3.client('s3', **{k: v for k, v in conn.items() if k in ['aws_access_key_id', 'aws_secret_access_key', 'region_name']})
                s3.list_buckets()
            elif source['type'] == 'api':
                import requests as http_requests
                resp = http_requests.get(conn.get('url', ''), timeout=10, headers=conn.get('headers', {}))
                return {'success': resp.status_code < 400, 'status': resp.status_code}
            else:
                return {'success': False, 'error': 'Connection test not implemented'}
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def count_sources(self):
        return len(store.list('sources'))
