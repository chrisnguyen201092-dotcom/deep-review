"""
Report output writer
Supports JSON, CSV, and plain text output formats.
"""

import json
import csv
import sys
import io


class ReportWriter:
    def __init__(self, config):
        self.config = config

    def write_to_file(self, results, summary, output_path, fmt):
        """Write report to a file"""
        with open(output_path, 'w') as f:
            if fmt == 'json':
                self._write_json(results, summary, f)
            elif fmt == 'csv':
                self._write_csv(results, summary, f)
            else:
                self._write_text(results, summary, f)

    def write_to_stdout(self, results, summary, fmt):
        """Write report to stdout"""
        if fmt == 'json':
            self._write_json(results, summary, sys.stdout)
        elif fmt == 'csv':
            self._write_csv(results, summary, sys.stdout)
        else:
            self._write_text(results, summary, sys.stdout)

    def _write_json(self, results, summary, stream):
        report = {
            'summary': summary,
            'files': results,
        }
        json.dump(report, stream, indent=2, default=str)
        stream.write('\n')

    def _write_csv(self, results, summary, stream):
        writer = csv.writer(stream)
        writer.writerow(['path', 'size', 'lines', 'words', 'characters',
                         'empty_lines', 'comment_lines', 'avg_line_length'])
        for r in results:
            if r.get('skipped'):
                continue
            writer.writerow([
                r['path'], r['size'], r['lines'], r['words'],
                r['characters'], r['empty_lines'], r['comment_lines'],
                r['avg_line_length']
            ])
        # Summary row
        writer.writerow([])
        writer.writerow(['Summary'])
        for key, value in summary.items():
            if not isinstance(value, (list, dict)):
                writer.writerow([key, value])

    def _write_text(self, results, summary, stream):
        stream.write('=' * 60 + '\n')
        stream.write('FILE ANALYSIS REPORT\n')
        stream.write('=' * 60 + '\n\n')

        for r in results:
            if r.get('skipped'):
                stream.write(f"SKIPPED: {r['path']} — {r.get('error', 'unknown')}\n")
                continue
            stream.write(f"File: {r['path']}\n")
            stream.write(f"  Size: {r['size']} bytes\n")
            stream.write(f"  Lines: {r['lines']} (empty: {r['empty_lines']}, comments: {r['comment_lines']})\n")
            stream.write(f"  Words: {r['words']}, Characters: {r['characters']}\n")
            stream.write(f"  Avg line length: {r['avg_line_length']}\n")
            if r.get('top_words'):
                top = ', '.join(f"{w}({c})" for w, c in r['top_words'][:5])
                stream.write(f"  Top words: {top}\n")
            stream.write('\n')

        stream.write('-' * 60 + '\n')
        stream.write('SUMMARY\n')
        stream.write('-' * 60 + '\n')
        stream.write(f"  Files processed: {summary.get('files_processed', 0)}\n")
        stream.write(f"  Files skipped: {summary.get('files_skipped', 0)}\n")
        stream.write(f"  Total lines: {summary.get('total_lines', 0)}\n")
        stream.write(f"  Total words: {summary.get('total_words', 0)}\n")
        stream.write(f"  Duplicate files: {summary.get('duplicate_files', 0)}\n")
