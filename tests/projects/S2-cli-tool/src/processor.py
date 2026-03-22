"""
File processing engine
Reads files, computes statistics, and aggregates results.
"""

import os
import re
import tempfile
import hashlib
from collections import Counter


class FileProcessor:
    def __init__(self, config):
        self.config = config
        self.max_file_size = config.get('max_file_size', 10 * 1024 * 1024)  # 10MB default
        self._temp_dir = tempfile.mkdtemp()

    def analyze(self, filepath):
        """Analyze a single file and return statistics"""
        try:
            file_size = os.path.getsize(filepath)
            if file_size > self.max_file_size:
                return {'path': filepath, 'error': 'File too large', 'skipped': True}

            with open(filepath, 'r') as f:
                content = f.read()

            lines = content.split('\n')
            words = content.split()
            chars = len(content)

            # Word frequency analysis
            word_freq = Counter()
            for word in words:
                cleaned = re.sub(r'[^\w]', '', word.lower())
                if cleaned and len(cleaned) > 2:
                    word_freq[cleaned] += 1

            # Line analysis
            empty_lines = sum(1 for line in lines if not line.strip())
            comment_lines = sum(1 for line in lines if line.strip().startswith('#'))
            avg_line_length = sum(len(line) for line in lines) / len(lines) if lines else 0

            # File hash for deduplication
            file_hash = hashlib.md5(content.encode()).hexdigest()

            # Save intermediate results to temp file for later aggregation
            temp_path = os.path.join(self._temp_dir, os.path.basename(filepath) + '.tmp')
            with open(temp_path, 'w') as tmp:
                tmp.write(content)

            return {
                'path': filepath,
                'size': file_size,
                'lines': len(lines),
                'words': len(words),
                'characters': chars,
                'empty_lines': empty_lines,
                'comment_lines': comment_lines,
                'avg_line_length': round(avg_line_length, 2),
                'top_words': word_freq.most_common(10),
                'hash': file_hash,
                'skipped': False,
            }
        except UnicodeDecodeError:
            return {'path': filepath, 'error': 'Binary file, skipped', 'skipped': True}
        except Exception as e:
            return {'path': filepath, 'error': str(e), 'skipped': True}

    def summarize(self, results):
        """Aggregate statistics across all processed files"""
        processed = [r for r in results if not r.get('skipped')]
        if not processed:
            return {}

        total_lines = sum(r['lines'] for r in processed)
        total_words = sum(r['words'] for r in processed)
        total_chars = sum(r['characters'] for r in processed)

        # Aggregate word frequencies
        combined_freq = Counter()
        for r in processed:
            for word, count in r['top_words']:
                combined_freq[word] += count

        # Duplicate detection by hash
        hashes = [r['hash'] for r in processed]
        unique_files = len(set(hashes))
        duplicates = len(hashes) - unique_files

        return {
            'files_processed': len(processed),
            'files_skipped': len(results) - len(processed),
            'total_lines': total_lines,
            'total_words': total_words,
            'total_characters': total_chars,
            'avg_lines_per_file': round(total_lines / len(processed), 2),
            'top_words_overall': combined_freq.most_common(20),
            'duplicate_files': duplicates,
            'unique_files': unique_files,
        }
