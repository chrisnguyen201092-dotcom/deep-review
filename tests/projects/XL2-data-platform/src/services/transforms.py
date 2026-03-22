"""
Data transformations for ETL pipeline steps
"""

import re
import json
import hashlib
from datetime import datetime


def clean_text(value):
    """Remove extra whitespace, normalize unicode"""
    if not isinstance(value, str):
        return value
    return re.sub(r'\s+', ' ', value).strip()


def mask_pii(data, fields=None):
    """Mask personally identifiable information"""
    pii_fields = fields or ['email', 'phone', 'ssn', 'credit_card', 'password']
    masked = {}
    for key, value in data.items():
        if key.lower() in pii_fields:
            if isinstance(value, str) and len(value) > 4:
                masked[key] = value[:2] + '*' * (len(value) - 4) + value[-2:]
            else:
                masked[key] = '***'
        else:
            masked[key] = value
    return masked


def deduplicate(records, key_fields):
    """Remove duplicate records based on key fields"""
    seen = set()
    unique = []
    for record in records:
        key = tuple(record.get(f) for f in key_fields)
        if key not in seen:
            seen.add(key)
            unique.append(record)
    return unique


def validate_schema(record, schema):
    """Validate a record against a schema definition"""
    errors = []
    for field in schema:
        name = field['name']
        required = field.get('required', False)
        field_type = field.get('type', 'string')

        if required and name not in record:
            errors.append(f"Missing required field: {name}")
        elif name in record:
            value = record[name]
            if field_type == 'integer' and not isinstance(value, int):
                errors.append(f"Field {name} should be integer, got {type(value).__name__}")
            elif field_type == 'string' and not isinstance(value, str):
                errors.append(f"Field {name} should be string, got {type(value).__name__}")
            elif field_type == 'float' and not isinstance(value, (int, float)):
                errors.append(f"Field {name} should be float, got {type(value).__name__}")

    return errors


def hash_record(record, algorithm='sha256'):
    """Generate a hash of a record for change detection"""
    data = json.dumps(record, sort_keys=True, default=str)
    return hashlib.new(algorithm, data.encode()).hexdigest()


def convert_types(record, type_map):
    """Convert field types according to a mapping"""
    converted = {}
    for key, value in record.items():
        target_type = type_map.get(key)
        if target_type == 'int':
            converted[key] = int(value) if value is not None else None
        elif target_type == 'float':
            converted[key] = float(value) if value is not None else None
        elif target_type == 'string':
            converted[key] = str(value) if value is not None else None
        elif target_type == 'datetime':
            converted[key] = datetime.fromisoformat(str(value)) if value else None
        elif target_type == 'bool':
            converted[key] = bool(value)
        else:
            converted[key] = value
    return converted
