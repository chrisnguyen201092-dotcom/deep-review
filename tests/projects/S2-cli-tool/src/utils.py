"""
Utility functions for the CLI tool
Logging setup, path resolution, and helpers.
"""

import logging
import os
import subprocess


def setup_logging(verbose=False):
    """Configure logging based on verbosity level"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger('file-analyzer')


def resolve_path(path):
    """
    Resolve a path to absolute form.
    Supports ~ expansion and relative paths.
    """
    expanded = os.path.expanduser(path)
    return os.path.abspath(expanded)


def get_file_type(filepath):
    """Detect file type using the 'file' command if available"""
    try:
        result = subprocess.run(
            ['file', '--brief', '--mime-type', filepath],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        # Fallback to extension-based detection
        ext = os.path.splitext(filepath)[1].lower()
        mime_map = {
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.log': 'text/plain',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.xml': 'application/xml',
        }
        return mime_map.get(ext, 'application/octet-stream')


def format_size(size_bytes):
    """Format byte count to human-readable size"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def safe_read(filepath, encoding='utf-8'):
    """
    Read a file with encoding fallback.
    Tries utf-8 first, then latin-1 as fallback.
    """
    try:
        with open(filepath, 'r', encoding=encoding) as f:
            return f.read()
    except UnicodeDecodeError:
        with open(filepath, 'r', encoding='latin-1') as f:
            return f.read()
