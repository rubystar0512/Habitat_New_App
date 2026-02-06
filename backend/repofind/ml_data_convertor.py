#!/usr/bin/env python3
"""
Export ML training data from commit_status_cache and commits.
Output: CSV with scores, commit stats (file_changes, additions, ...), and status.
Only includes commits with status paid_out or too_easy.
"""

import json
import os
import sys
import csv
from datetime import datetime as dt_parse
from pathlib import Path

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

# Load environment variables (same as fetch_commits.py)
load_dotenv()

# Database config - same as fetch_commits.py
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'habitate'),
    'password': os.getenv('DB_PASSWORD', 'University12345*'),
    'database': os.getenv('DB_NAME', 'habitate_db'),
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci',
}

# Allowed statuses for ML labels
STATUSES = ('paid_out', 'too_easy')

# Default output path
DEFAULT_OUTPUT = Path(__file__).parent / 'ml_train_data.csv'

# Set by fetch_ml_data: True if commit_test_analysis was joined (row has has_test_changes)
_used_test_analysis = True

# Columns to export (must match train_success_model.FEATURE_NAMES + status)
# pr_number omitted: identifier, not predictive of paid_out vs too_easy
CSV_COLUMNS = [
    'habitate_score', 'difficulty_score', 'suitability_score',
    'repo_id', 'file_changes', 'additions', 'deletions', 'net_change',
    'test_additions', 'non_test_additions', 'is_merge',
    'has_dependency_changes', 'test_coverage_score', 'is_behavior_preserving_refactor',
    # Optional: time + complexity + file_stats + test
    'commit_month', 'commit_dow',
    'multi_file', 'cross_directory', 'many_directories', 'has_core_files',
    'large_single_file', 'multiple_high_additions', 'directory_count',
    'test_file_count', 'non_test_file_count', 'single_file_200plus', 'multi_file_300plus',
    'has_test_changes',
    'status',
]


def get_db_connection():
    """Get MySQL database connection."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Error as e:
        print(f"Error connecting to MySQL: {e}", file=sys.stderr)
        sys.exit(1)


def fetch_ml_data(conn):
    """
    Fetch commit scores, stats, optional (date, complexity, test_analysis), and status.
    commit_test_analysis table has: test_files_added, test_files_modified, test_files_removed,
    etc. (no test_file_count or has_test_changes; we derive has_test_changes from the counts).
    commit_file_stats_cache is not joined (DB may lack it or have different schema).
    Returns list of tuples in CSV_COLUMNS order (without header).
    """
    # Query with commit_test_analysis (schema: test_files_added/modified/removed, etc.)
    query_with_test = """
        SELECT
            c.habitate_score,
            c.difficulty_score,
            c.suitability_score,
            c.repo_id,
            c.file_changes,
            c.additions,
            c.deletions,
            c.net_change,
            c.test_additions,
            c.non_test_additions,
            c.is_merge,
            c.has_dependency_changes,
            c.test_coverage_score,
            c.is_behavior_preserving_refactor,
            c.commit_date,
            c.complexity_indicators,
            cta.test_files_added,
            cta.test_files_modified,
            cta.test_files_removed,
            csc.status
        FROM commit_status_cache csc
        INNER JOIN commits c ON c.id = csc.commit_id
        LEFT JOIN commit_test_analysis cta ON c.id = cta.commit_id
        WHERE csc.status IN (%s, %s)
        ORDER BY csc.commit_id
    """
    query_no_test = """
        SELECT
            c.habitate_score,
            c.difficulty_score,
            c.suitability_score,
            c.repo_id,
            c.file_changes,
            c.additions,
            c.deletions,
            c.net_change,
            c.test_additions,
            c.non_test_additions,
            c.is_merge,
            c.has_dependency_changes,
            c.test_coverage_score,
            c.is_behavior_preserving_refactor,
            c.commit_date,
            c.complexity_indicators,
            csc.status
        FROM commit_status_cache csc
        INNER JOIN commits c ON c.id = csc.commit_id
        WHERE csc.status IN (%s, %s)
        ORDER BY csc.commit_id
    """
    global _used_test_analysis
    cursor = conn.cursor()
    try:
        cursor.execute(query_with_test, STATUSES)
        rows = cursor.fetchall()
        _used_test_analysis = True
    except Exception as e:
        err = str(e).lower()
        if "commit_test_analysis" in err or "test_files_added" in err or "42s22" in err or "1054" in err:
            cursor.execute(query_no_test, STATUSES)
            rows = cursor.fetchall()
            _used_test_analysis = False
        else:
            raise
    cursor.close()
    return rows


def _parse_complexity(js):
    """Parse complexity_indicators JSON; return dict with 0/1 and directory_count."""
    if not js:
        return {
            'multi_file': 0, 'cross_directory': 0, 'many_directories': 0,
            'has_core_files': 0, 'large_single_file': 0, 'multiple_high_additions': 0,
            'directory_count': 0,
        }
    try:
        d = json.loads(js) if isinstance(js, str) else (js or {})
    except (json.JSONDecodeError, TypeError):
        d = {}
    return {
        'multi_file': 1 if d.get('multi_file') else 0,
        'cross_directory': 1 if d.get('cross_directory') else 0,
        'many_directories': 1 if d.get('many_directories') else 0,
        'has_core_files': 1 if d.get('has_core_files') else 0,
        'large_single_file': 1 if d.get('large_single_file') else 0,
        'multiple_high_additions': 1 if d.get('multiple_high_additions') else 0,
        'directory_count': int(d.get('directory_count', 0)) if d.get('directory_count') is not None else 0,
    }


def _row_to_csv_row(row):
    """Convert DB row to CSV row (coerce NULLs and types)."""
    out = []
    # 0-2: scores
    out.append(row[0] if row[0] is not None else 0)
    out.append(float(row[1]) if row[1] is not None else 0.0)
    out.append(float(row[2]) if row[2] is not None else 0.0)
    # 3-9: repo_id, file stats
    out.append(row[3] if row[3] is not None else 0)
    for i in range(4, 10):
        out.append(row[i] if row[i] is not None else 0)
    out.append(1 if row[10] else 0)   # is_merge
    out.append(1 if row[11] else 0)   # has_dependency_changes
    out.append(float(row[12]) if row[12] is not None else 0.0)  # test_coverage_score
    out.append(1 if row[13] else 0)   # is_behavior_preserving_refactor
    # 14: commit_date -> commit_month (1-12), commit_dow (0-6)
    dt = row[14]
    if dt:
        if hasattr(dt, 'month'):
            out.append(dt.month)
            out.append(dt.weekday())  # 0=Mon, 6=Sun
        else:
            try:
                parsed = dt_parse.strptime(str(dt)[:10], '%Y-%m-%d')
                out.append(parsed.month)
                out.append(parsed.weekday())
            except (ValueError, TypeError):
                out.append(0)
                out.append(0)
    else:
        out.append(0)
        out.append(0)
    # 15: complexity_indicators JSON
    comp = _parse_complexity(row[15])
    out.append(comp['multi_file'])
    out.append(comp['cross_directory'])
    out.append(comp['many_directories'])
    out.append(comp['has_core_files'])
    out.append(comp['large_single_file'])
    out.append(comp['multiple_high_additions'])
    out.append(comp['directory_count'])
    # Optional: file_stats_cache not in query (0); test_analysis may be present
    out.append(0)   # test_file_count
    out.append(0)   # non_test_file_count
    out.append(0)   # single_file_200plus
    out.append(0)   # multi_file_300plus
    if _used_test_analysis:
        # test_analysis: test_files_added, test_files_modified, test_files_removed -> has_test_changes
        added = (row[16] or 0) if row[16] is not None else 0
        modified = (row[17] or 0) if row[17] is not None else 0
        removed = (row[18] or 0) if row[18] is not None else 0
        out.append(1 if (added + modified + removed) > 0 else 0)
        out.append(row[19] or '')         # status
    else:
        out.append(0)   # has_test_changes (no table)
        out.append(row[16] or '')         # status
    return out


def write_csv(rows, output_path):
    """Write rows to CSV with header matching CSV_COLUMNS."""
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(CSV_COLUMNS)
        for row in rows:
            writer.writerow(_row_to_csv_row(row))


def main():
    output_path = DEFAULT_OUTPUT
    if len(sys.argv) > 1:
        output_path = Path(sys.argv[1])

    print(f"Connecting to DB {DB_CONFIG['host']}:{DB_CONFIG['database']}...")
    conn = get_db_connection()

    print("Fetching commits with status paid_out or too_easy...")
    rows = fetch_ml_data(conn)
    conn.close()

    print(f"Found {len(rows)} rows. Writing to {output_path}...")
    write_csv(rows, output_path)
    print(f"Done. Output: {output_path}")


if __name__ == '__main__':
    main()
