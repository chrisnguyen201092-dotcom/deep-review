"""
Dashboard service — manages saved dashboards and widgets
"""

import json
from datetime import datetime
from ..models.database import get_db


class DashboardService:
    def create_dashboard(self, name, user_id, widgets=None, is_public=False):
        db = get_db()
        result = db.execute(
            "INSERT INTO dashboards (name, owner_id, widgets, is_public, created_at) VALUES (%s, %s, %s, %s, NOW())",
            (name, user_id, json.dumps(widgets or []), is_public)
        )
        return {'id': result.lastrowid, 'name': name}

    def get_dashboard(self, dashboard_id, user_id=None):
        db = get_db()
        dash = db.execute("SELECT * FROM dashboards WHERE id = %s", (dashboard_id,)).fetchone()
        if not dash:
            return None
        if not dash['is_public'] and dash['owner_id'] != user_id:
            return None
        dash = dict(dash)
        dash['widgets'] = json.loads(dash['widgets']) if isinstance(dash['widgets'], str) else dash['widgets']
        return dash

    def update_dashboard(self, dashboard_id, user_id, updates):
        db = get_db()
        dash = self.get_dashboard(dashboard_id, user_id)
        if not dash:
            raise ValueError("Dashboard not found or access denied")
        
        allowed = ['name', 'widgets', 'is_public']
        sets = []
        params = []
        for key, value in updates.items():
            if key in allowed:
                sets.append(f"{key} = %s")
                params.append(json.dumps(value) if key == 'widgets' else value)
        
        if sets:
            params.append(dashboard_id)
            db.execute(f"UPDATE dashboards SET {', '.join(sets)}, updated_at = NOW() WHERE id = %s", params)
        return self.get_dashboard(dashboard_id, user_id)

    def list_dashboards(self, user_id, include_public=True):
        db = get_db()
        if include_public:
            return db.execute(
                "SELECT id, name, owner_id, is_public, created_at FROM dashboards WHERE owner_id = %s OR is_public = 1 ORDER BY created_at DESC",
                (user_id,)
            ).fetchall()
        return db.execute(
            "SELECT id, name, owner_id, is_public, created_at FROM dashboards WHERE owner_id = %s ORDER BY created_at DESC",
            (user_id,)
        ).fetchall()

    def delete_dashboard(self, dashboard_id, user_id):
        db = get_db()
        db.execute("DELETE FROM dashboards WHERE id = %s AND owner_id = %s", (dashboard_id, user_id))

    def share_dashboard(self, dashboard_id, user_id, target_user_ids):
        db = get_db()
        for target_id in target_user_ids:
            db.execute(
                "INSERT IGNORE INTO dashboard_shares (dashboard_id, shared_by, shared_with, created_at) VALUES (%s, %s, %s, NOW())",
                (dashboard_id, user_id, target_id)
            )
