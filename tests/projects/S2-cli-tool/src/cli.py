"""
File Analyzer CLI Tool
Processes text files, generates statistics, and exports reports.
Usage: python cli.py --input <path> [--output <path>] [--format json|csv|text]
"""

import argparse
import sys
import os
from processor import FileProcessor
from output import ReportWriter
from config import load_config
from utils import setup_logging, resolve_path


def parse_args():
    parser = argparse.ArgumentParser(description='File Analyzer — text file statistics')
    parser.add_argument('--input', '-i', required=True, help='Input file or directory path')
    parser.add_argument('--output', '-o', default=None, help='Output report path (default: stdout)')
    parser.add_argument('--format', '-f', choices=['json', 'csv', 'text'], default='text',
                        help='Report output format')
    parser.add_argument('--config', '-c', default=None, help='Config file path (YAML)')
    parser.add_argument('--recursive', '-r', action='store_true', help='Process directories recursively')
    parser.add_argument('--extensions', '-e', nargs='+', default=['.txt', '.md', '.log'],
                        help='File extensions to process')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    return parser.parse_args()


def collect_files(input_path, recursive, extensions):
    """Collect all matching files from input path"""
    files = []
    resolved = resolve_path(input_path)

    if os.path.isfile(resolved):
        files.append(resolved)
    elif os.path.isdir(resolved):
        if recursive:
            for root, dirs, filenames in os.walk(resolved):
                for fname in filenames:
                    if any(fname.endswith(ext) for ext in extensions):
                        files.append(os.path.join(root, fname))
        else:
            for fname in os.listdir(resolved):
                full = os.path.join(resolved, fname)
                if os.path.isfile(full) and any(fname.endswith(ext) for ext in extensions):
                    files.append(full)
    else:
        print(f"Error: '{input_path}' is not a valid file or directory", file=sys.stderr)
        sys.exit(1)

    return sorted(files)


def main():
    args = parse_args()
    logger = setup_logging(args.verbose)

    # Load config if provided
    config = load_config(args.config) if args.config else load_config(None)
    logger.info(f"Config loaded: max_file_size={config['max_file_size']}")

    # Collect files
    files = collect_files(args.input, args.recursive, args.extensions)
    if not files:
        print("No matching files found.", file=sys.stderr)
        sys.exit(0)

    logger.info(f"Found {len(files)} files to process")

    # Process files
    processor = FileProcessor(config)
    results = []
    for filepath in files:
        logger.info(f"Processing: {filepath}")
        result = processor.analyze(filepath)
        if result:
            results.append(result)

    if not results:
        print("No results generated.", file=sys.stderr)
        sys.exit(0)

    # Summary statistics
    summary = processor.summarize(results)

    # Write output
    writer = ReportWriter(config)
    if args.output:
        writer.write_to_file(results, summary, args.output, args.format)
        logger.info(f"Report written to {args.output}")
    else:
        writer.write_to_stdout(results, summary, args.format)


if __name__ == '__main__':
    main()
