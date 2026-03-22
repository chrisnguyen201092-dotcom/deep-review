"""
Request/Response middleware
"""

import time
import logging
from flask import request, g

logger = logging.getLogger('analytics')


def setup_middleware(app):
    @app.before_request
    def before_request():
        g.start_time = time.time()

    @app.after_request  
    def after_request(response):
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            logger.info(f"{request.method} {request.path} {response.status_code} {duration*1000:.0f}ms")
        return response

    @app.errorhandler(Exception)
    def handle_error(e):
        logger.error(f"Unhandled error: {e}", exc_info=True)
        return {'error': 'Internal server error'}, 500
