"""
Analytics API routes
"""

from flask import Blueprint, request, jsonify, g
from ..services.analytics_engine import AnalyticsEngine
from ..services.data_processor import DataProcessor
from ..api.auth import require_auth, require_role
from ..models.database import get_db

analytics_bp = Blueprint('analytics', __name__)
engine = AnalyticsEngine()
processor = DataProcessor()


@analytics_bp.route('/query', methods=['POST'])
@require_auth
def run_query():
    """Execute an analytics query"""
    data = request.get_json()
    metric = data.get('metric')
    dimensions = data.get('dimensions', [])
    filters = data.get('filters', {})
    date_range = data.get('dateRange', {})
    
    if not metric:
        return jsonify({'error': 'Metric required'}), 400

    try:
        result = engine.execute_query(metric, dimensions, filters, date_range)
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Query execution failed'}), 500


@analytics_bp.route('/aggregate', methods=['POST'])
@require_auth
def aggregate():
    """Run aggregation pipeline"""
    data = request.get_json()
    pipeline = data.get('pipeline', [])
    source = data.get('source')

    if not source or not pipeline:
        return jsonify({'error': 'Source and pipeline required'}), 400

    try:
        result = engine.run_aggregation(source, pipeline)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': 'Aggregation failed'}), 500


@analytics_bp.route('/events', methods=['POST'])
@require_auth
def track_event():
    """Track an analytics event"""
    data = request.get_json()
    event_type = data.get('event')
    properties = data.get('properties', {})

    if not event_type:
        return jsonify({'error': 'Event type required'}), 400

    processor.track_event({
        'event': event_type,
        'properties': properties,
        'user_id': g.current_user['id'],
        'timestamp': data.get('timestamp'),
        'ip': request.remote_addr,
    })

    return jsonify({'tracked': True}), 201


@analytics_bp.route('/funnel', methods=['POST'])
@require_auth
def analyze_funnel():
    """Analyze conversion funnel"""
    data = request.get_json()
    steps = data.get('steps', [])
    date_range = data.get('dateRange', {})

    if len(steps) < 2:
        return jsonify({'error': 'At least 2 funnel steps required'}), 400

    result = engine.analyze_funnel(steps, date_range)
    return jsonify(result)


@analytics_bp.route('/cohort', methods=['POST'])
@require_auth
def cohort_analysis():
    """Run cohort retention analysis"""
    data = request.get_json()
    cohort_type = data.get('cohortType', 'weekly')
    metric = data.get('metric', 'retention')

    result = engine.cohort_analysis(cohort_type, metric, data.get('dateRange', {}))
    return jsonify(result)


@analytics_bp.route('/export', methods=['POST'])
@require_auth
def export_data():
    """Export analytics data"""
    data = request.get_json()
    format_type = data.get('format', 'csv')
    query = data.get('query', {})

    result = engine.execute_query(
        query.get('metric', 'pageviews'),
        query.get('dimensions', []),
        query.get('filters', {}),
        query.get('dateRange', {})
    )

    if format_type == 'csv':
        csv_data = processor.to_csv(result.get('data', []))
        return csv_data, 200, {'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=export.csv'}
    elif format_type == 'json':
        return jsonify(result)
    else:
        return jsonify({'error': 'Unsupported format'}), 400
