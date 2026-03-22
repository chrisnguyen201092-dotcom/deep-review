"""
Data Platform — ETL Pipeline, Data Warehouse, and Scheduling system
"""

import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS

from .api.routes import pipeline_bp, sources_bp, datasets_bp, schedules_bp, admin_bp
from .api.auth import require_auth
from .storage.warehouse import DataWarehouse
from .config import get_config

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
logger = logging.getLogger('data-platform')


def create_app(config=None):
    app = Flask(__name__)
    config = config or get_config()
    app.config.update(config)

    CORS(app)

    # Register blueprints
    app.register_blueprint(pipeline_bp, url_prefix='/api/pipelines')
    app.register_blueprint(sources_bp, url_prefix='/api/sources')
    app.register_blueprint(datasets_bp, url_prefix='/api/datasets')
    app.register_blueprint(schedules_bp, url_prefix='/api/schedules')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'service': 'data-platform'})

    return app
