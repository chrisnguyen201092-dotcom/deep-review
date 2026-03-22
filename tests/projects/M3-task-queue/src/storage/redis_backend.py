"""
Redis storage backend for the task queue
"""

import json
import redis


class RedisBackend:
    def __init__(self, host='localhost', port=6379, db=0, prefix='taskq:'):
        self.client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
        self.prefix = prefix

    def _key(self, task_id):
        return f"{self.prefix}task:{task_id}"

    def save_task(self, task):
        key = self._key(task['id'])
        self.client.set(key, json.dumps(task))
        # Add to pending set for quick lookup
        if task['status'] == 'pending':
            self.client.sadd(f"{self.prefix}pending", task['id'])

    def get_task(self, task_id):
        data = self.client.get(self._key(task_id))
        return json.loads(data) if data else None

    def update_task(self, task):
        key = self._key(task['id'])
        self.client.set(key, json.dumps(task))
        # Update set membership
        if task['status'] == 'pending':
            self.client.sadd(f"{self.prefix}pending", task['id'])
        else:
            self.client.srem(f"{self.prefix}pending", task['id'])

    def get_pending_tasks(self):
        task_ids = self.client.smembers(f"{self.prefix}pending")
        tasks = []
        for tid in task_ids:
            task = self.get_task(tid)
            if task and task['status'] == 'pending':
                tasks.append(task)
        return tasks

    def get_all_tasks(self):
        pattern = f"{self.prefix}task:*"
        keys = self.client.keys(pattern)
        tasks = []
        for key in keys:
            data = self.client.get(key)
            if data:
                tasks.append(json.loads(data))
        return tasks

    def delete_tasks_before(self, cutoff_date, statuses):
        all_tasks = self.get_all_tasks()
        count = 0
        for task in all_tasks:
            if task['status'] in statuses and task.get('completed_at', '') < cutoff_date:
                self.client.delete(self._key(task['id']))
                self.client.srem(f"{self.prefix}pending", task['id'])
                count += 1
        return count

    def flush(self):
        """Clear all queue data (for testing)"""
        pattern = f"{self.prefix}*"
        keys = self.client.keys(pattern)
        if keys:
            self.client.delete(*keys)
