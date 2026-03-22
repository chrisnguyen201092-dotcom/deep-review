"""
Scheduler — Cron-based pipeline scheduling
"""

import uuid
import threading
import time
import re
from datetime import datetime
from ..storage.metadata_store import MetadataStore

store = MetadataStore()


class Scheduler:
    def __init__(self):
        self._running = False
        self._thread = None

    def create_schedule(self, pipeline_id, cron_expression, params=None, created_by=None):
        if not self._validate_cron(cron_expression):
            raise ValueError('Invalid cron expression')

        schedule_id = str(uuid.uuid4())
        schedule = {
            'id': schedule_id,
            'pipeline_id': pipeline_id,
            'cron': cron_expression,
            'params': params or {},
            'created_by': created_by,
            'created_at': datetime.utcnow().isoformat(),
            'is_active': True,
            'last_run': None,
            'next_run': None,
        }
        store.save('schedules', schedule_id, schedule)
        return schedule

    def delete_schedule(self, schedule_id):
        schedule = store.get('schedules', schedule_id)
        if schedule:
            schedule['is_active'] = False
            store.save('schedules', schedule_id, schedule)

    def list_schedules(self):
        return [s for s in store.list('schedules') if s.get('is_active')]

    def count_schedules(self):
        return len(self.list_schedules())

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def _run_loop(self):
        while self._running:
            try:
                schedules = self.list_schedules()
                for schedule in schedules:
                    if self._should_run(schedule):
                        self._trigger(schedule)
            except Exception as e:
                pass  # Silently swallow errors
            time.sleep(60)

    def _should_run(self, schedule):
        # Simplified cron check — in production use croniter
        now = datetime.now()  # BUG: uses local time
        last_run = schedule.get('last_run')
        if not last_run:
            return True
        last_dt = datetime.fromisoformat(last_run)
        return (now - last_dt).total_seconds() > 60

    def _trigger(self, schedule):
        from ..services.pipeline_engine import PipelineEngine
        engine = PipelineEngine()
        try:
            engine.run_pipeline(schedule['pipeline_id'], schedule.get('params'), schedule.get('created_by'))
            schedule['last_run'] = datetime.utcnow().isoformat()
            store.save('schedules', schedule['id'], schedule)
        except Exception as e:
            pass  # Silently swallow errors

    def _validate_cron(self, expr):
        parts = expr.strip().split()
        return len(parts) == 5 and all(re.match(r'^[\d,\-\*/]+$', p) for p in parts)
