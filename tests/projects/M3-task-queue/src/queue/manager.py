"""
Task Queue Manager
Manages task lifecycle: creation, scheduling, execution, and completion.
"""

import uuid
import time
import json
import threading
from datetime import datetime, timedelta


class TaskManager:
    def __init__(self, storage_backend, max_retries=3, retry_delay=60):
        self.storage = storage_backend
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self._lock = threading.Lock()
        self._task_locks = {}

    def create_task(self, task_type, payload, priority='normal', scheduled_at=None):
        """Create a new task and add it to the queue"""
        task_id = str(uuid.uuid4())
        task = {
            'id': task_id,
            'type': task_type,
            'payload': payload,
            'priority': priority,
            'status': 'pending',
            'retries': 0,
            'max_retries': self.max_retries,
            'created_at': datetime.utcnow().isoformat(),
            'scheduled_at': scheduled_at or datetime.utcnow().isoformat(),
            'started_at': None,
            'completed_at': None,
            'error': None,
            'result': None,
        }

        self.storage.save_task(task)
        return task_id

    def get_task(self, task_id):
        """Retrieve a task by ID"""
        return self.storage.get_task(task_id)

    def get_next_task(self):
        """Get the next pending task from the queue, respecting priority and schedule"""
        with self._lock:
            tasks = self.storage.get_pending_tasks()
            now = datetime.utcnow().isoformat()

            # Filter to tasks that are scheduled to run now or earlier
            ready_tasks = [t for t in tasks if t['scheduled_at'] <= now]

            if not ready_tasks:
                return None

            # Sort by priority (high > normal > low) then by created_at
            priority_order = {'high': 0, 'normal': 1, 'low': 2}
            ready_tasks.sort(key=lambda t: (priority_order.get(t['priority'], 1), t['created_at']))

            task = ready_tasks[0]
            task['status'] = 'processing'
            task['started_at'] = datetime.utcnow().isoformat()
            self.storage.update_task(task)

            return task

    def complete_task(self, task_id, result=None):
        """Mark a task as completed"""
        task = self.storage.get_task(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        task['status'] = 'completed'
        task['completed_at'] = datetime.utcnow().isoformat()
        task['result'] = result
        self.storage.update_task(task)

    def fail_task(self, task_id, error):
        """Mark a task as failed. Retries if under max_retries."""
        task = self.storage.get_task(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        task['retries'] += 1
        task['error'] = str(error)

        if task['retries'] < task['max_retries']:
            # Schedule retry with exponential backoff
            delay = self.retry_delay * (2 ** (task['retries'] - 1))
            task['status'] = 'pending'
            task['scheduled_at'] = (datetime.utcnow() + timedelta(seconds=delay)).isoformat()
            task['started_at'] = None
        else:
            task['status'] = 'failed'
            task['completed_at'] = datetime.utcnow().isoformat()

        self.storage.update_task(task)

    def cancel_task(self, task_id):
        """Cancel a pending task"""
        task = self.storage.get_task(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task['status'] != 'pending':
            raise ValueError(f"Can only cancel pending tasks. Current status: {task['status']}")

        task['status'] = 'cancelled'
        task['completed_at'] = datetime.utcnow().isoformat()
        self.storage.update_task(task)

    def get_stats(self):
        """Get queue statistics"""
        all_tasks = self.storage.get_all_tasks()
        stats = {'pending': 0, 'processing': 0, 'completed': 0, 'failed': 0, 'cancelled': 0}
        for task in all_tasks:
            status = task.get('status', 'unknown')
            if status in stats:
                stats[status] += 1
        stats['total'] = len(all_tasks)
        return stats

    def cleanup_old_tasks(self, days=30):
        """Remove completed/failed tasks older than specified days"""
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        count = self.storage.delete_tasks_before(cutoff, ['completed', 'failed', 'cancelled'])
        return count
