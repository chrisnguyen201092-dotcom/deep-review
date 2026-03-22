"""
API middleware
Request/response processing for the queue API.
"""

import time
import logging
from flask import request, g

logger = logging.getLogger('taskq-api')


def setup_middleware(app):
    """Register middleware with the Flask app"""

    @app.before_request
    def before_request():
        g.start_time = time.time()


    @app.after_request
    def after_request(response):
        duration = time.time() - g.start_time
        logger.info(
            f"{request.method} {request.path} {response.status_code} {duration*1000:.0f}ms"
        )
        response.headers['X-Request-Duration'] = f"{duration*1000:.0f}ms"
        return response

    @app.errorhandler(Exception)
    def handle_error(e):
        logger.error(f"Unhandled error: {e}")
        return {'error': 'Internal server error'}, 500
