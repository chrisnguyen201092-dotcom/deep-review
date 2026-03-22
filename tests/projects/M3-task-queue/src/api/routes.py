"""
REST API for the task queue
Provides endpoints for task management and monitoring.
"""

from flask import Flask, request, jsonify
from functools import wraps
import os

app = Flask(__name__)

# These will be set during initialization
_manager = None
_auth_token = os.environ.get('QUEUE_API_TOKEN', 'dev-token')


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if token != _auth_token:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


def init_app(manager):
    global _manager
    _manager = manager
    return app


@app.route('/api/tasks', methods=['POST'])
@require_auth
def create_task():
    data = request.get_json()
    if not data or 'type' not in data or 'payload' not in data:
        return jsonify({'error': 'type and payload required'}), 400

    task_id = _manager.create_task(
        task_type=data['type'],
        payload=data['payload'],
        priority=data.get('priority', 'normal'),
        scheduled_at=data.get('scheduled_at'),
    )
    return jsonify({'task_id': task_id}), 201


@app.route('/api/tasks/<task_id>', methods=['GET'])
@require_auth
def get_task(task_id):
    task = _manager.get_task(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify(task)


@app.route('/api/tasks/<task_id>/cancel', methods=['POST'])
@require_auth
def cancel_task(task_id):
    try:
        _manager.cancel_task(task_id)
        return jsonify({'success': True})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/stats', methods=['GET'])
@require_auth
def get_stats():
    stats = _manager.get_stats()
    return jsonify(stats)


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'task-queue'})
