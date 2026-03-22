"""
API Routes for the Data Platform
"""

from flask import Blueprint, request, jsonify, g
from ..api.auth import require_auth, require_role
from ..services.pipeline_engine import PipelineEngine
from ..services.source_manager import SourceManager
from ..storage.warehouse import DataWarehouse
from ..services.scheduler import Scheduler

pipeline_bp = Blueprint('pipelines', __name__)
sources_bp = Blueprint('sources', __name__)
datasets_bp = Blueprint('datasets', __name__)
schedules_bp = Blueprint('schedules', __name__)
admin_bp = Blueprint('admin', __name__)

engine = PipelineEngine()
source_mgr = SourceManager()
warehouse = DataWarehouse()
scheduler = Scheduler()


# ----- Pipeline routes -----

@pipeline_bp.route('/', methods=['GET'])
@require_auth
def list_pipelines():
    pipelines = engine.list_pipelines(g.user['id'])
    return jsonify(pipelines)


@pipeline_bp.route('/', methods=['POST'])
@require_auth
def create_pipeline():
    data = request.get_json()
    name = data.get('name')
    steps = data.get('steps', [])
    source_id = data.get('sourceId')

    if not name or not steps:
        return jsonify({'error': 'Name and steps required'}), 400

    pipeline = engine.create_pipeline(name, steps, source_id, g.user['id'])
    return jsonify(pipeline), 201


@pipeline_bp.route('/<pipeline_id>/run', methods=['POST'])
@require_auth
def run_pipeline(pipeline_id):
    params = request.get_json() or {}
    try:
        result = engine.run_pipeline(pipeline_id, params, g.user['id'])
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Pipeline execution failed'}), 500


@pipeline_bp.route('/<pipeline_id>/runs', methods=['GET'])
@require_auth
def list_runs(pipeline_id):
    runs = engine.list_runs(pipeline_id)
    return jsonify(runs)


# ----- Source routes -----

@sources_bp.route('/', methods=['GET'])
@require_auth
def list_sources():
    sources = source_mgr.list_sources()
    return jsonify(sources)


@sources_bp.route('/', methods=['POST'])
@require_auth
@require_role('admin', 'engineer')
def create_source():
    data = request.get_json()
    source_type = data.get('type')
    name = data.get('name')
    connection = data.get('connection', {})

    if not source_type or not name:
        return jsonify({'error': 'Type and name required'}), 400

    source = source_mgr.create_source(source_type, name, connection, g.user['id'])
    return jsonify(source), 201


@sources_bp.route('/<source_id>/test', methods=['POST'])
@require_auth
def test_connection(source_id):
    result = source_mgr.test_connection(source_id)
    return jsonify(result)


# ----- Dataset routes -----

@datasets_bp.route('/', methods=['GET'])
@require_auth
def list_datasets():
    datasets = warehouse.list_datasets()
    return jsonify(datasets)


@datasets_bp.route('/<dataset_id>/query', methods=['POST'])
@require_auth
def query_dataset(dataset_id):
    data = request.get_json()
    sql = data.get('sql')
    if not sql:
        return jsonify({'error': 'SQL query required'}), 400

    try:
        result = warehouse.execute_query(dataset_id, sql, g.user['id'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@datasets_bp.route('/<dataset_id>/preview', methods=['GET'])
@require_auth
def preview_dataset(dataset_id):
    limit = int(request.args.get('limit', 100))
    result = warehouse.preview(dataset_id, limit)
    return jsonify(result)


# ----- Schedule routes -----

@schedules_bp.route('/', methods=['GET'])
@require_auth
def list_schedules():
    return jsonify(scheduler.list_schedules())


@schedules_bp.route('/', methods=['POST'])
@require_auth
@require_role('admin', 'engineer')
def create_schedule():
    data = request.get_json()
    schedule = scheduler.create_schedule(
        pipeline_id=data.get('pipelineId'),
        cron_expression=data.get('cron'),
        params=data.get('params', {}),
        created_by=g.user['id'],
    )
    return jsonify(schedule), 201


@schedules_bp.route('/<schedule_id>', methods=['DELETE'])
@require_auth
@require_role('admin')
def delete_schedule(schedule_id):
    scheduler.delete_schedule(schedule_id)
    return jsonify({'success': True})


# ----- Admin routes -----

@admin_bp.route('/stats', methods=['GET'])
@require_auth
@require_role('admin')
def get_stats():
    stats = {
        'pipelines': engine.count_pipelines(),
        'sources': source_mgr.count_sources(),
        'datasets': warehouse.count_datasets(),
        'schedules': scheduler.count_schedules(),
    }
    return jsonify(stats)
