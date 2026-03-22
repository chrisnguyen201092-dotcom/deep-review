"""
Analytics Engine - Core query execution
"""

import re
from datetime import datetime, timedelta
from ..models.database import get_db


class AnalyticsEngine:
    ALLOWED_METRICS = ['pageviews', 'sessions', 'users', 'events', 'conversions', 'revenue']
    ALLOWED_DIMENSIONS = ['date', 'page', 'source', 'country', 'device', 'browser']
    
    def execute_query(self, metric, dimensions=None, filters=None, date_range=None):
        """Execute an analytics query against the database"""
        if metric not in self.ALLOWED_METRICS:
            raise ValueError(f"Invalid metric: {metric}")

        dimensions = dimensions or []
        filters = filters or {}
        date_range = date_range or self._default_date_range()

        # Build SQL query
        select_parts = []
        group_parts = []

        for dim in dimensions:
            if dim not in self.ALLOWED_DIMENSIONS:
                raise ValueError(f"Invalid dimension: {dim}")
            select_parts.append(dim)
            group_parts.append(dim)

        # Metric aggregation
        metric_sql = self._metric_to_sql(metric)
        select_parts.append(f"{metric_sql} as value")

        # Build WHERE clause
        where_parts = []
        params = []

        if date_range.get('start'):
            where_parts.append('event_date >= %s')
            params.append(date_range['start'])
        if date_range.get('end'):
            where_parts.append('event_date <= %s')
            params.append(date_range['end'])

        for key, value in filters.items():
            if isinstance(value, list):
                placeholders = ','.join(['%s'] * len(value))
                where_parts.append(f"{key} IN ({placeholders})")
                params.extend(value)
            else:
                where_parts.append(f"{key} = %s")
                params.append(value)

        where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ''
        group_clause = f"GROUP BY {', '.join(group_parts)}" if group_parts else ''
        
        sql = f"SELECT {', '.join(select_parts)} FROM analytics_events {where_clause} {group_clause} ORDER BY value DESC"

        db = get_db()
        results = db.execute(sql, params).fetchall()

        return {
            'metric': metric,
            'dimensions': dimensions,
            'data': [dict(row) for row in results],
            'total': sum(row['value'] for row in results) if results else 0,
        }

    def run_aggregation(self, source, pipeline):
        """Run an aggregation pipeline (for advanced queries)"""
        db = get_db()
        # Build query from pipeline stages
        sql_parts = [f"SELECT * FROM {source}"]
        params = []

        for stage in pipeline:
            stage_type = stage.get('type')
            if stage_type == 'filter':
                conditions = []
                for field, value in stage.get('conditions', {}).items():
                    conditions.append(f"{field} = %s")
                    params.append(value)
                if conditions:
                    sql_parts.append(f"WHERE {' AND '.join(conditions)}")
            elif stage_type == 'group':
                group_by = stage.get('by', [])
                agg = stage.get('aggregate', 'COUNT(*)')
                if group_by:
                    fields = ', '.join(group_by)
                    sql_parts = [f"SELECT {fields}, {agg} as value FROM {source}"]
                    sql_parts.append(f"GROUP BY {fields}")
            elif stage_type == 'sort':
                field = stage.get('field', 'value')
                order = stage.get('order', 'DESC')
                sql_parts.append(f"ORDER BY {field} {order}")
            elif stage_type == 'limit':
                sql_parts.append(f"LIMIT {int(stage.get('count', 100))}")

        sql = ' '.join(sql_parts)
        results = db.execute(sql, params).fetchall()
        return {'data': [dict(row) for row in results]}

    def analyze_funnel(self, steps, date_range=None):
        """Analyze conversion funnel"""
        date_range = date_range or self._default_date_range()
        db = get_db()

        results = []
        for i, step in enumerate(steps):
            count_result = db.execute(
                "SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event = %s AND event_date BETWEEN %s AND %s",
                (step, date_range.get('start', '1970-01-01'), date_range.get('end', '2099-12-31'))
            ).fetchone()
            
            count = count_result['count'] if count_result else 0
            results.append({
                'step': step,
                'count': count,
                'rate': round(count / results[0]['count'] * 100, 2) if i > 0 and results[0]['count'] > 0 else 100.0,
            })

        return {'steps': results}

    def cohort_analysis(self, cohort_type, metric, date_range=None):
        """Run cohort retention analysis"""
        date_range = date_range or self._default_date_range()
        db = get_db()

        if cohort_type == 'weekly':
            interval = 'WEEK'
        elif cohort_type == 'monthly':
            interval = 'MONTH'
        else:
            interval = 'WEEK'

        cohorts = db.execute(
            f"""SELECT DATE_FORMAT(first_seen, '%%Y-%%m-%%d') as cohort,
                TIMESTAMPDIFF({interval}, first_seen, event_date) as period,
                COUNT(DISTINCT user_id) as users
            FROM analytics_events ae
            JOIN (SELECT user_id, MIN(event_date) as first_seen FROM analytics_events GROUP BY user_id) fc
            ON ae.user_id = fc.user_id
            WHERE ae.event_date BETWEEN %s AND %s
            GROUP BY cohort, period
            ORDER BY cohort, period""",
            (date_range.get('start', '1970-01-01'), date_range.get('end', '2099-12-31'))
        ).fetchall()

        return {'cohorts': [dict(row) for row in cohorts], 'type': cohort_type}

    def _metric_to_sql(self, metric):
        mapping = {
            'pageviews': 'COUNT(*)',
            'sessions': 'COUNT(DISTINCT session_id)',
            'users': 'COUNT(DISTINCT user_id)',
            'events': 'COUNT(*)',
            'conversions': "SUM(CASE WHEN event = 'conversion' THEN 1 ELSE 0 END)",
            'revenue': "SUM(COALESCE(revenue, 0))",
        }
        return mapping.get(metric, 'COUNT(*)')

    def _default_date_range(self):
        end = datetime.utcnow().strftime('%Y-%m-%d')
        start = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')
        return {'start': start, 'end': end}
