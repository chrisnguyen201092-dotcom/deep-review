"""
PostgreSQL storage backend for the task queue
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor


class PostgresBackend:
    def __init__(self, dsn=None, host='localhost', port=5432, dbname='taskqueue',
                 user='taskq', password=''):
        if dsn:
            self.conn = psycopg2.connect(dsn)
        else:
            self.conn = psycopg2.connect(
                host=host, port=port, dbname=dbname, user=user, password=password
            )
        self.conn.autocommit = True
        self._ensure_table()

    def _ensure_table(self):
        with self.conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id VARCHAR(36) PRIMARY KEY,
                    type VARCHAR(100) NOT NULL,
                    payload JSONB,
                    priority VARCHAR(20) DEFAULT 'normal',
                    status VARCHAR(20) DEFAULT 'pending',
                    retries INTEGER DEFAULT 0,
                    max_retries INTEGER DEFAULT 3,
                    created_at TIMESTAMP DEFAULT NOW(),
                    scheduled_at TIMESTAMP DEFAULT NOW(),
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    error TEXT,
                    result JSONB
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
                CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks (scheduled_at);
            """)

    def save_task(self, task):
        with self.conn.cursor() as cur:
            cur.execute(
                """INSERT INTO tasks (id, type, payload, priority, status, retries, max_retries,
                   created_at, scheduled_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (task['id'], task['type'], json.dumps(task['payload']), task['priority'],
                 task['status'], task['retries'], task['max_retries'],
                 task['created_at'], task['scheduled_at'])
            )

    def get_task(self, task_id):
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
            row = cur.fetchone()
            if row:
                row['payload'] = row['payload'] if isinstance(row['payload'], dict) else json.loads(row['payload'])
                if row['result']:
                    row['result'] = row['result'] if isinstance(row['result'], dict) else json.loads(row['result'])
            return row

    def update_task(self, task):
        with self.conn.cursor() as cur:
            cur.execute(
                """UPDATE tasks SET status = %s, retries = %s, started_at = %s,
                   completed_at = %s, error = %s, result = %s, scheduled_at = %s
                   WHERE id = %s""",
                (task['status'], task['retries'], task.get('started_at'),
                 task.get('completed_at'), task.get('error'),
                 json.dumps(task['result']) if task.get('result') else None,
                 task['scheduled_at'], task['id'])
            )

    def get_pending_tasks(self):
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM tasks WHERE status = 'pending' ORDER BY scheduled_at ASC"
            )
            rows = cur.fetchall()
            for row in rows:
                row['payload'] = row['payload'] if isinstance(row['payload'], dict) else json.loads(row['payload'])
            return rows

    def get_all_tasks(self):
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM tasks ORDER BY created_at DESC")
            rows = cur.fetchall()
            for row in rows:
                row['payload'] = row['payload'] if isinstance(row['payload'], dict) else json.loads(row['payload'])
            return rows

    def delete_tasks_before(self, cutoff_date, statuses):
        placeholders = ','.join(['%s'] * len(statuses))
        with self.conn.cursor() as cur:
            cur.execute(
                f"DELETE FROM tasks WHERE status IN ({placeholders}) AND completed_at < %s",
                (*statuses, cutoff_date)
            )
            return cur.rowcount
