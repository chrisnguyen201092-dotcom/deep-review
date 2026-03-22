"""
Task Scheduler
Provides cron-like scheduling for recurring tasks.
"""

import time
import threading
from datetime import datetime, timedelta


class Scheduler:
    def __init__(self, manager):
        self.manager = manager
        self._schedules = []
        self._running = False
        self._thread = None

    def add_schedule(self, name, task_type, payload, interval_seconds, priority='normal'):
        """Add a recurring task schedule"""
        self._schedules.append({
            'name': name,
            'task_type': task_type,
            'payload': payload,
            'interval': interval_seconds,
            'priority': priority,
            'last_run': None,
        })
        print(f"[Scheduler] Added schedule '{name}': every {interval_seconds}s")

    def start(self):
        """Start the scheduler"""
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print("[Scheduler] Started")

    def stop(self):
        """Stop the scheduler"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
        print("[Scheduler] Stopped")

    def _run_loop(self):
        while self._running:
            now = time.time()
            for schedule in self._schedules:
                if schedule['last_run'] is None or (now - schedule['last_run']) >= schedule['interval']:
                    self._trigger(schedule)
                    schedule['last_run'] = now
            time.sleep(1)

    def _trigger(self, schedule):
        """Create a task for this schedule"""
        try:
            scheduled_time = datetime.now().isoformat()
            task_id = self.manager.create_task(
                task_type=schedule['task_type'],
                payload={
                    **schedule['payload'],
                    '_schedule_name': schedule['name'],
                    '_scheduled_at': scheduled_time,
                },
                priority=schedule['priority'],
            )
            print(f"[Scheduler] Triggered '{schedule['name']}' -> task {task_id}")
        except Exception as e:
            print(f"[Scheduler] Failed to trigger '{schedule['name']}': {e}")

    def list_schedules(self):
        return [
            {
                'name': s['name'],
                'task_type': s['task_type'],
                'interval': s['interval'],
                'last_run': s['last_run'],
            }
            for s in self._schedules
        ]
