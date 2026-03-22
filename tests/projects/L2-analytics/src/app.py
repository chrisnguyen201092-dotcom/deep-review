"""
Analytics Dashboard - Flask Application
Provides data analytics pipeline, visualization, and reporting.
"""

from flask import Flask, jsonify
from flask_cors import CORS

from .api.routes import analytics_bp, dashboard_bp, reports_bp, users_bp, admin_bp
from .api.middleware import setup_middleware
from .models.database import init_db
from .config import get_config


def create_app(config=None):
    app = Flask(__name__)
    config = config or get_config()
    app.config.update(config)

    CORS(app, resources={r'/api/*': {'origins': config.get('CORS_ORIGINS', '*')}})

    # Initialize database
    init_db(app)

    # Setup middleware
    setup_middleware(app)

    # Register blueprints
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboards')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'service': 'analytics-dashboard'})

    return app
