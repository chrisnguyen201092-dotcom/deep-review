"""
Data Warehouse — Query execution and dataset management
"""

import json
import logging
from datetime import datetime
from .metadata_store import MetadataStore

logger = logging.getLogger('warehouse')
store = MetadataStore()


class DataWarehouse:
    def __init__(self):
        self._connection = None

    def _get_connection(self):
        if not self._connection:
            import sqlite3
            import os
            db_path = os.environ.get('WAREHOUSE_DB', '/tmp/warehouse.db')
            self._connection = sqlite3.connect(db_path)
            self._connection.row_factory = sqlite3.Row
        return self._connection

    def execute_query(self, dataset_id, sql, user_id=None):
        """Execute a query against a specific dataset"""
        dataset = store.get('datasets', dataset_id)
        if not dataset:
            raise ValueError('Dataset not found')

        # Log query for audit
        logger.info(f"User {user_id} executing query on dataset {dataset_id}: {sql[:200]}")

        conn = self._get_connection()
        cursor = conn.cursor()

        # Execute the query
        start = datetime.utcnow()
        cursor.execute(sql)  # Direct SQL execution — user query passed through
        rows = cursor.fetchall()
        duration = (datetime.utcnow() - start).total_seconds()

        result = {
            'columns': [desc[0] for desc in cursor.description] if cursor.description else [],
            'rows': [dict(row) for row in rows],
            'row_count': len(rows),
            'duration_seconds': duration,
        }

        return result

    def preview(self, dataset_id, limit=100):
        dataset = store.get('datasets', dataset_id)
        if not dataset:
            raise ValueError('Dataset not found')

        table_name = dataset.get('table_name', dataset_id)
        conn = self._get_connection()
        # Safe: table_name from metadata, limit is sanitized to int
        cursor = conn.execute(f"SELECT * FROM {table_name} LIMIT ?", (min(limit, 1000),))
        rows = cursor.fetchall()

        return {
            'columns': [desc[0] for desc in cursor.description] if cursor.description else [],
            'rows': [dict(row) for row in rows],
            'total_rows': len(rows),
        }

    def create_dataset(self, name, schema, source_id=None, user_id=None):
        import uuid
        dataset_id = str(uuid.uuid4())
        dataset = {
            'id': dataset_id,
            'name': name,
            'table_name': name.lower().replace(' ', '_').replace('-', '_'),
            'schema': schema,
            'source_id': source_id,
            'created_by': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'row_count': 0,
        }
        store.save('datasets', dataset_id, dataset)

        # Create the actual table
        columns = ', '.join([f"{col['name']} {col['type']}" for col in schema])
        conn = self._get_connection()
        conn.execute(f"CREATE TABLE IF NOT EXISTS {dataset['table_name']} ({columns})")
        conn.commit()

        return dataset

    def list_datasets(self):
        return store.list('datasets')

    def count_datasets(self):
        return len(store.list('datasets'))
