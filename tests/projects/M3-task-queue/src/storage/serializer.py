"""
Task payload serializer
Handles serialization and deserialization of task payloads.
"""

import pickle
import json
import base64


def serialize(payload, format='json'):
    """
    Serialize a task payload for storage.
    Supports 'json' and 'pickle' formats.
    """
    if format == 'json':
        return json.dumps(payload)
    elif format == 'pickle':
        # Pickle format for complex Python objects (datetime, sets, custom classes)
        raw = pickle.dumps(payload)
        return base64.b64encode(raw).decode('ascii')
    else:
        raise ValueError(f"Unsupported serialization format: {format}")


def deserialize(data, format='json'):
    """
    Deserialize a task payload from storage.
    """
    if format == 'json':
        return json.loads(data)
    elif format == 'pickle':
        raw = base64.b64decode(data.encode('ascii'))
        return pickle.loads(raw)
    else:
        raise ValueError(f"Unsupported deserialization format: {format}")


def safe_serialize(payload):
    """
    Try JSON first, fall back to pickle for complex types.
    Returns (data, format) tuple.
    """
    try:
        data = json.dumps(payload)
        return data, 'json'
    except (TypeError, ValueError):
        raw = pickle.dumps(payload)
        return base64.b64encode(raw).decode('ascii'), 'pickle'


def validate_payload(payload, max_size=1024 * 1024):
    """
    Validate a payload before serialization.
    Checks size limit (default 1MB).
    """
    serialized = json.dumps(payload, default=str)
    if len(serialized) > max_size:
        raise ValueError(f"Payload too large: {len(serialized)} bytes (max: {max_size})")
    return True
