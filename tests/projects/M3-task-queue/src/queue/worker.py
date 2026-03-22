"""
Task Worker
Processes tasks from the queue in a loop.
"""

import time
import signal
import threading
import traceback
from datetime import datetime


class Worker:
    def __init__(self, manager, handlers, poll_interval=1.0, worker_id=None):
        self.manager = manager
        self.handlers = handlers  # Dict of task_type -> handler_function
        self.poll_interval = poll_interval
        self.worker_id = worker_id or f"worker-{id(self)}"
        self._running = False
        self._current_task = None
        self._thread = None

    def start(self):
        """Start the worker in a background thread"""
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print(f"[{self.worker_id}] Started")

    def stop(self):
        """Signal the worker to stop after current task"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=30)
        print(f"[{self.worker_id}] Stopped")

    def _run_loop(self):
        """Main processing loop"""
        while self._running:
            try:
                task = self.manager.get_next_task()
                if task is None:
                    time.sleep(self.poll_interval)
                    continue

                self._current_task = task
                self._process_task(task)
                self._current_task = None

            except Exception as e:
                print(f"[{self.worker_id}] Loop error: {e}")
                time.sleep(self.poll_interval)

    def _process_task(self, task):
        """Process a single task"""
        task_type = task['type']
        handler = self.handlers.get(task_type)

        if handler is None:
            error_msg = f"No handler registered for task type: {task_type}"
            print(f"[{self.worker_id}] {error_msg}")
            self.manager.fail_task(task['id'], error_msg)
            return

        print(f"[{self.worker_id}] Processing task {task['id']} (type: {task_type})")
        start_time = time.time()

        try:
            result = handler(task['payload'])
            elapsed = time.time() - start_time
            print(f"[{self.worker_id}] Completed {task['id']} in {elapsed:.2f}s")
            self.manager.complete_task(task['id'], result)
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[{self.worker_id}] Failed {task['id']} after {elapsed:.2f}s: {e}")
            self.manager.fail_task(task['id'], str(e))

    @property
    def is_busy(self):
        return self._current_task is not None

    @property  
    def status(self):
        if not self._running:
            return 'stopped'
        if self._current_task:
            return f'processing:{self._current_task["id"]}'
        return 'idle'


class WorkerPool:
    def __init__(self, manager, handlers, num_workers=4, poll_interval=1.0):
        self.workers = []
        for i in range(num_workers):
            w = Worker(manager, handlers, poll_interval, worker_id=f"worker-{i}")
            self.workers.append(w)

    def start_all(self):
        for w in self.workers:
            w.start()

    def stop_all(self):
        for w in self.workers:
            w.stop()

    def status(self):
        return [{'id': w.worker_id, 'status': w.status} for w in self.workers]
