"""
Data Processor - ETL and data transformation
"""

import csv
import json
import io
import hashlib
import os
from datetime import datetime


class DataProcessor:
    def __init__(self, batch_size=1000):
        self.batch_size = batch_size
        self._event_buffer = []

    def track_event(self, event):
        """Buffer events for batch processing"""
        event['received_at'] = datetime.utcnow().isoformat()
        if not event.get('timestamp'):
            event['timestamp'] = event['received_at']
        self._event_buffer.append(event)

        if len(self._event_buffer) >= self.batch_size:
            self.flush_events()

    def flush_events(self):
        """Flush buffered events to storage"""
        if not self._event_buffer:
            return 0

        from ..models.database import get_db
        db = get_db()
        count = 0

        for event in self._event_buffer:
            try:
                db.execute(
                    """INSERT INTO analytics_events (event, user_id, session_id, properties, ip, event_date, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
                    (event.get('event'), event.get('user_id'), event.get('session_id'),
                     json.dumps(event.get('properties', {})), event.get('ip'),
                     event.get('timestamp', datetime.utcnow().isoformat()))
                )
                count += 1
            except Exception as e:
                print(f"Failed to store event: {e}")

        self._event_buffer.clear()
        return count

    def to_csv(self, data):
        """Convert analytics data to CSV format"""
        if not data:
            return ''

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        for row in data:
            writer.writerow(row)
        return output.getvalue()

    def to_json(self, data):
        """Convert analytics data to JSON format"""
        return json.dumps(data, default=str, indent=2)

    def anonymize_ip(self, ip):
        """Anonymize an IP address by zeroing the last octet"""
        parts = ip.split('.')
        if len(parts) == 4:
            parts[3] = '0'
            return '.'.join(parts)
        return ip

    def hash_user_id(self, user_id, salt=None):
        """Hash a user ID for anonymized analytics"""
        salt = salt or os.environ.get('HASH_SALT', '')
        data = f"{user_id}:{salt}"
        return hashlib.sha256(data.encode()).hexdigest()

    def validate_event(self, event):
        """Validate event data"""
        errors = []
        if not event.get('event'):
            errors.append('Event type required')
        if not isinstance(event.get('properties', {}), dict):
            errors.append('Properties must be a dictionary')
        return errors

    def aggregate_events(self, events, group_by, metric='count'):
        """Aggregate events in memory"""
        groups = {}
        for event in events:
            key = tuple(event.get(dim) for dim in group_by)
            if key not in groups:
                groups[key] = {'count': 0, 'events': []}
            groups[key]['count'] += 1
            groups[key]['events'].append(event)

        result = []
        for key, group in groups.items():
            row = dict(zip(group_by, key))
            if metric == 'count':
                row['value'] = group['count']
            elif metric == 'unique_users':
                row['value'] = len(set(e.get('user_id') for e in group['events']))
            result.append(row)

        return sorted(result, key=lambda r: r['value'], reverse=True)
