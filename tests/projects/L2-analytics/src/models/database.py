"""
Database models and connection management
"""

import sqlite3
import os
from flask import g

DATABASE_URL = os.environ.get('DATABASE_URL', '/tmp/analytics.db')


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE_URL)
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db(app):
    app.teardown_appcontext(close_db)
    with app.app_context():
        db = get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS analytics_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event TEXT NOT NULL,
                user_id TEXT,
                session_id TEXT,
                properties TEXT,
                ip TEXT,
                page TEXT,
                source TEXT,
                country TEXT,
                device TEXT,
                browser TEXT,
                revenue REAL,
                event_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS dashboards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                owner_id INTEGER NOT NULL,
                widgets TEXT DEFAULT '[]',
                is_public INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS dashboard_shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dashboard_id INTEGER NOT NULL,
                shared_by INTEGER NOT NULL,
                shared_with INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(dashboard_id, shared_with)
            );
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                type TEXT,
                generated_by INTEGER,
                config TEXT,
                result TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'viewer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                metric TEXT NOT NULL,
                condition TEXT NOT NULL,
                threshold REAL NOT NULL,
                notify_email TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                last_triggered_at TIMESTAMP,
                created_by INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_events_date ON analytics_events(event_date);
            CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_id);
            CREATE INDEX IF NOT EXISTS idx_events_event ON analytics_events(event);
        """)
