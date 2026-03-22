"""
Authentication and authorization
"""

import jwt
import os
from functools import wraps
from flask import request, g, jsonify

JWT_SECRET = os.environ.get('JWT_SECRET', 'data-platform-dev-key')


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Auth required'}), 401
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            g.user = decoded
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(g, 'user') or g.user.get('role') not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
