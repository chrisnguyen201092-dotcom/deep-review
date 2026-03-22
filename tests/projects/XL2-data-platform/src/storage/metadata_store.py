"""
Metadata Store — Stores pipeline, source, and dataset metadata
"""

import json
import os
import threading

_STORE_DIR = os.environ.get('METADATA_DIR', '/tmp/data-platform-metadata')


class MetadataStore:
    _lock = threading.Lock()

    def __init__(self, store_dir=None):
        self.store_dir = store_dir or _STORE_DIR
        os.makedirs(self.store_dir, exist_ok=True)

    def save(self, collection, key, data):
        collection_dir = os.path.join(self.store_dir, collection)
        os.makedirs(collection_dir, exist_ok=True)
        filepath = os.path.join(collection_dir, f"{key}.json")
        with self._lock:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2, default=str)

    def get(self, collection, key):
        filepath = os.path.join(self.store_dir, collection, f"{key}.json")
        if not os.path.exists(filepath):
            return None
        with open(filepath) as f:
            return json.load(f)

    def list(self, collection):
        collection_dir = os.path.join(self.store_dir, collection)
        if not os.path.isdir(collection_dir):
            return []
        items = []
        for filename in os.listdir(collection_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(collection_dir, filename)
                with open(filepath) as f:
                    items.append(json.load(f))
        return items

    def delete(self, collection, key):
        filepath = os.path.join(self.store_dir, collection, f"{key}.json")
        if os.path.exists(filepath):
            os.remove(filepath)
