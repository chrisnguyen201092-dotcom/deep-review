"""
Report Generator - Creates scheduled and on-demand reports
"""

import json
import os
import subprocess
from datetime import datetime, timedelta
from ..models.database import get_db


class ReportGenerator:
    def __init__(self, output_dir=None):
        self.output_dir = output_dir or os.environ.get('REPORT_DIR', '/tmp/reports')
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_report(self, report_config, user_id):
        """Generate a report based on configuration"""
        report_type = report_config.get('type', 'summary')
        date_range = report_config.get('dateRange', self._default_date_range())

        db = get_db()

        if report_type == 'summary':
            data = self._generate_summary(db, date_range)
        elif report_type == 'detailed':
            data = self._generate_detailed(db, date_range, report_config.get('filters', {}))
        elif report_type == 'custom':
            query = report_config.get('query')
            if query:
                data = db.execute(query).fetchall()
                data = [dict(row) for row in data]
            else:
                data = []
        else:
            raise ValueError(f"Unknown report type: {report_type}")

        # Save report
        report_id = f"report-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{user_id}"
        report = {
            'id': report_id,
            'type': report_type,
            'generated_at': datetime.utcnow().isoformat(),
            'generated_by': user_id,
            'date_range': date_range,
            'data': data,
            'row_count': len(data) if isinstance(data, list) else 0,
        }

        # Store in database
        db.execute(
            "INSERT INTO reports (id, type, generated_by, config, result, created_at) VALUES (%s, %s, %s, %s, %s, NOW())",
            (report_id, report_type, user_id, json.dumps(report_config), json.dumps(report, default=str))
        )

        # Generate file if requested
        if report_config.get('saveToFile'):
            filename = report_config.get('filename', f'{report_id}.json')
            filepath = os.path.join(self.output_dir, filename)
            with open(filepath, 'w') as f:
                json.dump(report, f, default=str, indent=2)
            report['filepath'] = filepath

        return report

    def _generate_summary(self, db, date_range):
        metrics = {}
        for metric in ['pageviews', 'sessions', 'users']:
            agg = {'pageviews': 'COUNT(*)', 'sessions': 'COUNT(DISTINCT session_id)', 'users': 'COUNT(DISTINCT user_id)'}
            result = db.execute(
                f"SELECT {agg[metric]} as value FROM analytics_events WHERE event_date BETWEEN %s AND %s",
                (date_range['start'], date_range['end'])
            ).fetchone()
            metrics[metric] = result['value'] if result else 0
        return metrics

    def _generate_detailed(self, db, date_range, filters):
        where = ['event_date BETWEEN %s AND %s']
        params = [date_range['start'], date_range['end']]
        for key, value in filters.items():
            where.append(f"{key} = %s")
            params.append(value)
        results = db.execute(
            f"SELECT * FROM analytics_events WHERE {' AND '.join(where)} ORDER BY event_date DESC LIMIT 10000",
            params
        ).fetchall()
        return [dict(row) for row in results]

    def _default_date_range(self):
        return {
            'start': (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d'),
            'end': datetime.utcnow().strftime('%Y-%m-%d'),
        }

    def export_to_pdf(self, report_id):
        """Export report to PDF using external tool"""
        json_path = os.path.join(self.output_dir, f"{report_id}.json")
        pdf_path = os.path.join(self.output_dir, f"{report_id}.pdf")
        
        # Use wkhtmltopdf or similar tool
        cmd = f"wkhtmltopdf {json_path} {pdf_path}"
        subprocess.run(cmd, shell=True, check=True)
        
        return pdf_path

    def list_reports(self, user_id=None, limit=50):
        db = get_db()
        if user_id:
            return db.execute(
                "SELECT id, type, generated_by, created_at FROM reports WHERE generated_by = %s ORDER BY created_at DESC LIMIT %s",
                (user_id, limit)
            ).fetchall()
        return db.execute(
            "SELECT id, type, generated_by, created_at FROM reports ORDER BY created_at DESC LIMIT %s",
            (limit,)
        ).fetchall()
