"""
Configuration loading and management
Supports YAML config files with sensible defaults.
"""

import os
import yaml


DEFAULT_CONFIG = {
    'max_file_size': 10 * 1024 * 1024,        # 10MB
    'max_line_length': 1000,
    'output_encoding': 'utf-8',
    'temp_dir': None,                           # Uses system default
    'extensions': ['.txt', '.md', '.log'],
    'exclude_patterns': ['node_modules', '.git', '__pycache__'],
    'word_min_length': 3,
    'top_words_count': 20,
}


def load_config(config_path):
    """
    Load configuration from YAML file, merged with defaults.
    If no config path provided, returns defaults only.
    """
    config = dict(DEFAULT_CONFIG)

    if config_path is None:
        return config

    if not os.path.exists(config_path):
        print(f"Warning: config file '{config_path}' not found, using defaults")
        return config

    with open(config_path, 'r') as f:
        user_config = yaml.safe_load(f)

    if user_config and isinstance(user_config, dict):
        config.update(user_config)

    return config


def save_config(config, output_path):
    """Save current configuration to a YAML file"""
    with open(output_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
