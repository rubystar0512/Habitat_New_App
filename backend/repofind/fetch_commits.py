#!/usr/bin/env python3
"""
Python script to:
1. Import repos from JSON file to git_repos table
2. Clone repositories locally
3. Fetch all commits above cutoff date
4. Calculate scores and save to database
"""

import json
import os
import sys
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import subprocess

import mysql.connector
from mysql.connector import Error
from git import Repo, GitCommandError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'habitate'),
    'password': os.getenv('DB_PASSWORD', 'University12345*'),
    'database': os.getenv('DB_NAME', 'habitate_db'),
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci'
}

REPOS_DIR = Path(__file__).parent / 'repos'
DEFAULT_CUTOFF_DATE = '2015-01-01'
DEFAULT_BRANCH = 'main'

# Ensure repos directory exists
REPOS_DIR.mkdir(parents=True, exist_ok=True)


def get_db_connection():
    """Get MySQL database connection."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        sys.exit(1)


def save_repos_from_json(json_file: str):
    """
    Step 1: Save repos from JSON file to git_repos table.
    """
    print(f"Reading repos from {json_file}...")
    
    with open(json_file, 'r', encoding='utf-8') as f:
        repos_data = json.load(f)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    saved_count = 0
    updated_count = 0
    
    for repo_data in repos_data:
        habitat_repo_id = repo_data.get('id')
        repo_org = repo_data.get('repo_org', '')
        repo_name = repo_data.get('repo_name', '')
        full_name = f"{repo_org}/{repo_name}" if repo_org else repo_name
        
        # Parse cutoff date
        cutoff_date_str = repo_data.get('commit_cutoff_date')
        if cutoff_date_str:
            # Parse ISO format: "2020-12-01T00:00:00Z"
            cutoff_date = datetime.fromisoformat(cutoff_date_str.replace('Z', '+00:00')).date()
        else:
            # Use default cutoff date
            cutoff_date = datetime.strptime(DEFAULT_CUTOFF_DATE, '%Y-%m-%d').date()
        
        is_active = repo_data.get('is_active', False)
        # Override: set all to active as requested
        is_active = True
        
        try:
            # Check if repo exists
            cursor.execute(
                "SELECT id FROM git_repos WHERE repo_name = %s",
                (repo_name,)
            )
            existing = cursor.fetchone()
            
            if existing:
                # Update existing repo
                cursor.execute("""
                    UPDATE git_repos 
                    SET full_name = %s, habitat_repo_id = %s, cutoff_date = %s, 
                        is_active = %s, updated_at = NOW()
                    WHERE id = %s
                """, (full_name, habitat_repo_id, cutoff_date, is_active, existing[0]))
                updated_count += 1
                print(f"  Updated: {full_name}")
            else:
                # Insert new repo
                cursor.execute("""
                    INSERT INTO git_repos 
                    (repo_name, full_name, habitat_repo_id, default_branch, cutoff_date, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (repo_name, full_name, habitat_repo_id, DEFAULT_BRANCH, cutoff_date, is_active))
                saved_count += 1
                print(f"  Saved: {full_name}")
        
        except Error as e:
            print(f"  Error processing {full_name}: {e}")
            continue
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n✅ Repos saved: {saved_count} new, {updated_count} updated")
    return saved_count + updated_count


def is_test_file(file_path: str) -> bool:
    """
    Detect if a file is a test file.
    - File name contains "test" or "spec" (case-insensitive)
    - File is in a directory with "test" or "spec" in the name
    """
    if not file_path:
        return False
    
    file_path_lower = file_path.lower()
    file_name = os.path.basename(file_path_lower)
    directory_parts = file_path_lower.split('/')
    
    # Check filename
    if 'test' in file_name or 'spec' in file_name:
        return True
    
    # Check directory path
    for part in directory_parts:
        if 'test' in part or 'spec' in part:
            return True
    
    return False


def is_dependency_file(file_path: str) -> bool:
    """Detect if a file is a dependency file."""
    dependency_files = [
        'package.json', 'package-lock.json', 'yarn.lock',
        'go.mod', 'go.sum',
        'requirements.txt', 'Pipfile', 'poetry.lock',
        'pom.xml', 'build.gradle',
        'Cargo.toml', 'Cargo.lock',
        'Gemfile', 'Gemfile.lock',
        'composer.json', 'composer.lock'
    ]
    
    file_name = os.path.basename(file_path)
    return (file_name in dependency_files or 
            'node_modules/' in file_path or 
            'vendor/' in file_path)


def analyze_dependencies(file_stats: List[Dict], repo_path: Path, commit_hash: str) -> Dict:
    """
    Analyze dependency changes in detail.
    Returns dict with dependency_files, dependency_type, has_new_dependencies, has_version_updates.
    """
    dependency_files = [f for f in file_stats if f.get('is_dependency_file', False)]
    
    if not dependency_files:
        return {
            'dependency_files': [],
            'dependency_type': None,
            'has_new_dependencies': False,
            'has_version_updates': False
        }
    
    dependency_file_paths = [f.get('file_path') for f in dependency_files]
    
    # Determine dependency type
    dependency_type = None
    type_mapping = {
        'package.json': 'package_json',
        'package-lock.json': 'package_json',
        'yarn.lock': 'package_json',
        'go.mod': 'go_mod',
        'go.sum': 'go_mod',
        'requirements.txt': 'requirements_txt',
        'Pipfile': 'requirements_txt',
        'poetry.lock': 'requirements_txt',
        'pom.xml': 'pom_xml',
        'build.gradle': 'pom_xml',
        'Cargo.toml': 'cargo_toml',
        'Cargo.lock': 'cargo_toml',
        'Gemfile': 'other',
        'Gemfile.lock': 'other',
        'composer.json': 'other',
        'composer.lock': 'other'
    }
    
    for dep_file in dependency_files:
        file_name = os.path.basename(dep_file.get('file_path', ''))
        if file_name in type_mapping:
            dependency_type = type_mapping[file_name]
            break
    
    if not dependency_type:
        dependency_type = 'other'
    
    # Check for new dependencies and version updates
    # This requires reading file content, which is more complex
    # For now, we'll use heuristics based on additions
    has_new_dependencies = False
    has_version_updates = False
    
    for dep_file in dependency_files:
        additions = dep_file.get('additions', 0)
        deletions = dep_file.get('deletions', 0)
        
        # If significant additions without deletions, likely new dependencies
        if additions > 10 and deletions < additions * 0.3:
            has_new_dependencies = True
        
        # If balanced changes, likely version updates
        if additions > 0 and deletions > 0 and abs(additions - deletions) < max(additions, deletions) * 0.5:
            has_version_updates = True
    
    return {
        'dependency_files': dependency_file_paths,
        'dependency_type': dependency_type,
        'has_new_dependencies': has_new_dependencies,
        'has_version_updates': has_version_updates
    }


def analyze_tests(file_stats: List[Dict]) -> Dict:
    """
    Analyze test files in detail.
    Returns dict with test analysis data.
    """
    test_files = [f for f in file_stats if f.get('is_test_file', False)]
    non_test_files = [f for f in file_stats if not f.get('is_test_file', False)]
    
    # Count test files by change type
    test_files_added = 0
    test_files_modified = 0
    test_files_removed = 0
    
    for test_file in test_files:
        additions = test_file.get('additions', 0)
        deletions = test_file.get('deletions', 0)
        
        if additions > 0 and deletions == 0:
            test_files_added += 1
        elif additions > 0 and deletions > 0:
            test_files_modified += 1
        elif additions == 0 and deletions > 0:
            test_files_removed += 1
    
    # Calculate test coverage estimate
    test_additions = sum(f.get('additions', 0) for f in test_files)
    total_additions = sum(f.get('additions', 0) for f in file_stats)
    test_coverage_estimate = test_additions / total_additions if total_additions > 0 else 0.0
    test_coverage_estimate = min(1.0, test_coverage_estimate)
    
    # Check for integration tests and unit tests
    has_integration_tests = any(
        'integration' in f.get('file_path', '').lower() or
        'e2e' in f.get('file_path', '').lower() or
        'end-to-end' in f.get('file_path', '').lower() or
        'integration_test' in f.get('file_path', '').lower()
        for f in test_files
    )
    
    has_unit_tests = len(test_files) > 0
    
    # Calculate test quality score (0-100)
    # Based on: coverage, integration tests, test file count
    test_quality_score = 0
    
    if test_coverage_estimate >= 0.3:
        test_quality_score += 30
    if test_coverage_estimate >= 0.5:
        test_quality_score += 20
    if test_coverage_estimate >= 0.7:
        test_quality_score += 20
    
    if has_integration_tests:
        test_quality_score += 20
    
    if len(test_files) >= 3:
        test_quality_score += 10
    
    test_quality_score = min(100, test_quality_score)
    
    return {
        'test_files_added': test_files_added,
        'test_files_modified': test_files_modified,
        'test_files_removed': test_files_removed,
        'test_coverage_estimate': round(test_coverage_estimate, 2),
        'test_quality_score': test_quality_score,
        'has_integration_tests': has_integration_tests,
        'has_unit_tests': has_unit_tests
    }


def detect_behavior_preserving_refactor(commit_message: str) -> bool:
    """
    Detect if commit is a behavior-preserving refactor or performance optimization.
    """
    if not commit_message:
        return False
    
    # Extract title (first line) and body (rest)
    lines = commit_message.split('\n', 1)
    title = lines[0].strip()
    body = lines[1] if len(lines) > 1 else ""
    
    # Check if title matches performance/refactor patterns
    title_pattern = re.compile(r'perf|performance|refactor|optimiz', re.IGNORECASE)
    if not title_pattern.search(title):
        return False
    
    # Check if body matches behavior-preserving patterns
    body_pattern = re.compile(
        r'preserve|same output|behavior|no functional|internal only|no behavior change',
        re.IGNORECASE
    )
    
    if body_pattern.search(body):
        return True
    
    # Additional check: if title explicitly says "refactor" or "optimize"
    if re.search(r'refactor|optimize|optimise', title, re.IGNORECASE):
        behavior_change_pattern = re.compile(
            r'add|new feature|change behavior|modify behavior|fix behavior',
            re.IGNORECASE
        )
        if not behavior_change_pattern.search(body):
            return True
    
    return False


def get_file_statistics(repo_path: Path, commit_hash: str) -> List[Dict]:
    """
    Get per-file additions/deletions using git show --numstat.
    Returns list of file statistics.
    """
    try:
        result = subprocess.run(
            ['git', 'show', '--numstat', '--format=', commit_hash],
            cwd=repo_path,
            capture_output=True,
            text=True,
            check=True
        )
        
        file_stats = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            
            parts = line.split('\t')
            if len(parts) >= 3:
                additions = int(parts[0]) if parts[0] != '-' else 0
                deletions = int(parts[1]) if parts[1] != '-' else 0
                file_path = '\t'.join(parts[2:])  # Handle filenames with tabs
                
                file_name = os.path.basename(file_path)
                file_directory = os.path.dirname(file_path) if os.path.dirname(file_path) else None
                file_extension = os.path.splitext(file_name)[1][1:] if '.' in file_name else None
                
                file_stats.append({
                    'file_path': file_path,
                    'file_name': file_name,
                    'file_directory': file_directory,
                    'additions': additions,
                    'deletions': deletions,
                    'is_test_file': is_test_file(file_path),
                    'is_dependency_file': is_dependency_file(file_path),
                    'file_extension': file_extension
                })
        
        return file_stats
    
    except subprocess.CalledProcessError as e:
        print(f"    Error getting file stats for {commit_hash}: {e}")
        return []


def calculate_habitate_score(file_stats: List[Dict], is_behavior_refactor: bool) -> int:
    """Calculate habitate_score based on file statistics."""
    non_test_files = [f for f in file_stats if not f.get('is_test_file', False)]
    non_test_additions = sum(f.get('additions', 0) for f in non_test_files)
    non_test_deletions = sum(f.get('deletions', 0) for f in non_test_files)
    non_test_count = len(non_test_files)
    
    score = 0
    
    # Pattern 1: Single file with 200+ additions (non-test)
    if non_test_count == 1 and non_test_files[0].get('additions', 0) >= 200:
        score += 30
        if non_test_files[0].get('additions', 0) >= 500:
            score += 15
    
    # Pattern 2: 3-6 files with 300-500+ additions each (non-test)
    if 3 <= non_test_count <= 6:
        all_high = all(f.get('additions', 0) >= 300 for f in non_test_files)
        avg_additions = non_test_additions / non_test_count if non_test_count > 0 else 0
        
        if all_high and avg_additions >= 400:
            score += 35
        elif avg_additions >= 300:
            score += 25
    
    # Multi-file bonus (4-50 files)
    if 4 <= non_test_count <= 50:
        score += 25
    
    # Non-trivial size (20+ total changes)
    total_changes = non_test_additions + non_test_deletions
    if total_changes >= 20:
        score += 20
    
    # Test files present
    if any(f.get('is_test_file', False) for f in file_stats):
        score += 18
    
    # File count bonuses
    if non_test_count >= 6:
        score += 8
    if non_test_count >= 10:
        score += 8
    if non_test_count >= 20:
        score += 12
    
    # Net change bonuses
    net_change = non_test_additions - non_test_deletions
    if net_change >= 100:
        score += 4
    if net_change >= 200:
        score += 8
    if net_change >= 500:
        score += 12
    
    # High non-test additions bonus
    if non_test_additions >= 500:
        score += 8
    if non_test_additions >= 1000:
        score += 12
    
    # Penalties
    if non_test_deletions > non_test_additions * 0.5:
        score -= 10
    
    # Test percentage penalty
    total_additions = sum(f.get('additions', 0) for f in file_stats)
    test_additions = sum(f.get('additions', 0) for f in file_stats if f.get('is_test_file', False))
    test_percentage = test_additions / total_additions if total_additions > 0 else 0
    if test_percentage > 0.4:
        score -= int(30 * test_percentage)
    
    # Behavior-preserving refactor penalty
    if is_behavior_refactor:
        score -= 40
    
    return max(0, min(150, score))


def calculate_difficulty_score(file_stats: List[Dict], is_behavior_refactor: bool) -> float:
    """Calculate difficulty_score using file-level statistics."""
    score = 0.0
    
    non_test_files = [f for f in file_stats if not f.get('is_test_file', False)]
    non_test_count = len(non_test_files)
    
    # Codebase Understanding (0-30 points)
    if non_test_count >= 10:
        score += 15
    if non_test_count >= 20:
        score += 10
    if non_test_count >= 30:
        score += 5
    
    # Cross-directory changes
    directories = set()
    for f in non_test_files:
        dir_path = f.get('file_directory', '')
        if dir_path:
            top_dir = dir_path.split('/')[0]
            directories.add(top_dir)
    
    if len(directories) >= 3:
        score += 10
    if len(directories) >= 5:
        score += 5
    
    # Algorithmic Complexity (0-25 points)
    if non_test_count == 1 and non_test_files[0].get('additions', 0) >= 200:
        score += 15
        if non_test_files[0].get('additions', 0) >= 500:
            score += 10
    
    if 3 <= non_test_count <= 6:
        all_high = all(f.get('additions', 0) >= 300 for f in non_test_files)
        avg_additions = sum(f.get('additions', 0) for f in non_test_files) / non_test_count if non_test_count > 0 else 0
        
        if all_high and avg_additions >= 400:
            score += 20
        elif avg_additions >= 300:
            score += 15
    
    total_non_test = sum(f.get('additions', 0) for f in non_test_files)
    if total_non_test >= 1000:
        score += 5
    
    # Test Coverage Quality (0-20 points)
    test_files = [f for f in file_stats if f.get('is_test_file', False)]
    if len(test_files) > 0:
        score += 10
    
    # Domain-Specific Knowledge (0-15 points)
    core_patterns = ['core/', 'domain/', 'engine/', 'kernel/', 'src/']
    has_core_changes = any(
        any(pattern in f.get('file_path', '') for pattern in core_patterns)
        for f in non_test_files
    )
    if has_core_changes:
        score += 10
    
    # Refactoring Complexity (0-10 points)
    total_additions = sum(f.get('additions', 0) for f in non_test_files)
    total_deletions = sum(f.get('deletions', 0) for f in non_test_files)
    if total_additions > 0:
        refactor_ratio = total_deletions / total_additions
        if 0.3 <= refactor_ratio <= 0.7:
            score += 10
    
    # Behavior-preserving refactor penalty
    if is_behavior_refactor:
        score -= 30
    
    return min(100.0, max(0.0, score))


def calculate_suitability_score(commit_data: Dict, file_stats: List[Dict], 
                                habitate_score: int, difficulty_score: float,
                                is_behavior_refactor: bool) -> float:
    """Calculate overall suitability score (0-100)."""
    score = 50.0
    
    # Critical disqualifiers
    has_deps = any(f.get('is_dependency_file', False) for f in file_stats)
    if has_deps:
        return 0.0
    
    # Behavior-preserving refactor penalty
    if is_behavior_refactor:
        score -= 35
    
    # Positive indicators
    if difficulty_score >= 60:
        score += 20
    if difficulty_score >= 80:
        score += 10
    
    test_files = [f for f in file_stats if f.get('is_test_file', False)]
    test_additions = sum(f.get('additions', 0) for f in test_files)
    total_additions = sum(f.get('additions', 0) for f in file_stats)
    test_coverage = test_additions / total_additions if total_additions > 0 else 0.0
    
    if test_coverage >= 0.5:
        score += 15
    
    if habitate_score >= 80:
        score += 10
    
    # Negative indicators
    file_count = len([f for f in file_stats if not f.get('is_test_file', False)])
    if file_count < 4:
        score -= 15
    if file_count > 100:
        score -= 10
    
    non_test_additions = sum(f.get('additions', 0) for f in file_stats if not f.get('is_test_file', False))
    if non_test_additions < 200:
        score -= 10
    
    return max(0.0, min(100.0, score))


def clone_or_update_repo(repo_org: str, repo_name: str, github_token: Optional[str] = None) -> Optional[Path]:
    """
    Clone repository or update if exists.
    Returns path to cloned repo or None on error.
    """
    repo_path = REPOS_DIR / repo_org / repo_name
    
    if repo_path.exists():
        print(f"    Updating existing repo: {repo_path}")
        try:
            repo = Repo(repo_path)
            repo.remotes.origin.fetch()
            repo.remotes.origin.pull()
            return repo_path
        except GitCommandError as e:
            print(f"    Error updating repo: {e}")
            return None
    else:
        print(f"    Cloning repo: {repo_path}")
        repo_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Build clone URL
        if github_token:
            clone_url = f"https://{github_token}@github.com/{repo_org}/{repo_name}.git"
        else:
            clone_url = f"https://github.com/{repo_org}/{repo_name}.git"
        
        try:
            repo = Repo.clone_from(clone_url, repo_path)
            return repo_path
        except GitCommandError as e:
            print(f"    Error cloning repo: {e}")
            return None


def fetch_commits_for_repo(repo_id: int, repo_org: str, repo_name: str, 
                           cutoff_date: datetime, default_branch: str):
    """
    Step 2: Fetch all commits for a repository above cutoff date.
    """
    print(f"\n📦 Processing repo: {repo_org}/{repo_name}")
    
    # Clone or update repo
    repo_path = clone_or_update_repo(repo_org, repo_name, os.getenv('GITHUB_TOKEN'))
    if not repo_path:
        print(f"  ❌ Failed to clone/update repo")
        return 0
    
    # Get commits since cutoff date
    try:
        repo = Repo(repo_path)
        branch = default_branch  # Initialize with default
        
        # Try to detect the actual default branch if default_branch doesn't exist
        try:
            # Try the provided branch first
            repo.git.rev_parse(default_branch)
            branch = default_branch
        except GitCommandError:
            # Try common branch names
            for branch_name in ['master', 'main', 'develop', 'dev']:
                try:
                    repo.git.rev_parse(branch_name)
                    branch = branch_name
                    print(f"    Using branch: {branch} (instead of {default_branch})")
                    break
                except GitCommandError:
                    continue
            else:
                # Get the default branch from remote
                try:
                    branch = repo.git.symbolic_ref('refs/remotes/origin/HEAD').split('/')[-1]
                    print(f"    Using detected branch: {branch}")
                except:
                    raise GitCommandError("Could not determine default branch")
        
        commits = list(repo.iter_commits(
            branch,
            since=cutoff_date,
            reverse=False  # Oldest first
        ))
        print(f"  Found {len(commits)} commits since {cutoff_date.date()}")
    except GitCommandError as e:
        print(f"  ❌ Error getting commits: {e}")
        return 0
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    saved_count = 0
    skipped_count = 0
    
    for i, commit in enumerate(commits, 1):
        if i % 100 == 0:
            print(f"    Processing commit {i}/{len(commits)}...")
        
        try:
            commit_hash = commit.hexsha
            commit_message = commit.message
            commit_date = commit.committed_datetime
            author = f"{commit.author.name} <{commit.author.email}>"
            
            # Get parents
            parents = [p.hexsha for p in commit.parents]
            is_merge = len(parents) >= 2
            # For initial commits (no parents), use empty string instead of None
            base_commit = parents[0] if parents else ''
            
            # Get file statistics
            file_stats = get_file_statistics(repo_path, commit_hash)
            if not file_stats:
                skipped_count += 1
                continue
            
            # Calculate aggregate statistics
            total_additions = sum(f.get('additions', 0) for f in file_stats)
            total_deletions = sum(f.get('deletions', 0) for f in file_stats)
            test_additions = sum(f.get('additions', 0) for f in file_stats if f.get('is_test_file', False))
            non_test_additions = sum(f.get('additions', 0) for f in file_stats if not f.get('is_test_file', False))
            net_change = total_additions - total_deletions
            file_changes = len(file_stats)
            
            # Detect dependency changes
            has_dependency_changes = any(f.get('is_dependency_file', False) for f in file_stats)
            
            # Analyze dependencies in detail
            dependency_analysis = analyze_dependencies(file_stats, repo_path, commit_hash)
            
            # Analyze tests in detail
            test_analysis = analyze_tests(file_stats)
            
            # Detect behavior-preserving refactor
            is_behavior_refactor = detect_behavior_preserving_refactor(commit_message)
            
            # Source SHA: For merge commits, this might be different, but for regular commits it's the same
            source_sha = commit_hash  # Could be enhanced to detect actual source commit for merges
            
            # Calculate complexity indicators
            non_test_files = [f for f in file_stats if not f.get('is_test_file', False)]
            directories = set()
            for f in non_test_files:
                dir_path = f.get('file_directory', '')
                if dir_path:
                    top_dir = dir_path.split('/')[0]
                    directories.add(top_dir)
            
            complexity_indicators = {
                'multi_file': 4 <= file_changes <= 50,
                'cross_directory': len(directories) >= 3,
                'many_directories': len(directories) >= 5,
                'directory_count': len(directories),
                'has_core_files': any(
                    any(pattern in f.get('file_path', '') for pattern in ['core/', 'domain/', 'engine/', 'kernel/', 'src/'])
                    for f in non_test_files
                ),
                'large_single_file': non_test_files and len(non_test_files) == 1 and non_test_files[0].get('additions', 0) >= 200,
                'multiple_high_additions': 3 <= len(non_test_files) <= 6 and all(f.get('additions', 0) >= 300 for f in non_test_files)
            }
            complexity_indicators_json = json.dumps(complexity_indicators)
            
            # Unsuitable flags (default to FALSE/0)
            is_unsuitable = False  # Only set to True if manually marked
            unsuitable_reason = None  # Only set if manually marked
            
            # Last status check (NULL by default, only set when checking Habitat API)
            last_status_check = None
            
            # Calculate scores
            habitate_score = calculate_habitate_score(file_stats, is_behavior_refactor)
            difficulty_score = calculate_difficulty_score(file_stats, is_behavior_refactor)
            suitability_score = calculate_suitability_score(
                {}, file_stats, habitate_score, difficulty_score, is_behavior_refactor
            )
            
            # Test coverage
            test_coverage_score = test_additions / total_additions if total_additions > 0 else 0.0
            
            # Extract PR number from message (if present)
            pr_match = re.search(r'#(\d+)', commit_message)
            pr_number = int(pr_match.group(1)) if pr_match else None
            
            # Prepare files JSON (just paths)
            files_json = json.dumps([f.get('file_path') for f in file_stats])
            
            # Prepare habitat_signals JSON
            habitat_signals = {
                'multi_file': 4 <= file_changes <= 50,
                'non_trivial_size': (total_additions + total_deletions) >= 20,
                'has_test_like': any(f.get('is_test_file', False) for f in file_stats),
                'files_changed': file_changes,
                'additions': non_test_additions,
                'deletions': total_deletions,
                'net_change': net_change,
                'test_additions': test_additions,
                'non_test_additions': non_test_additions,
                'is_behavior_preserving_refactor': is_behavior_refactor
            }
            habitat_signals_json = json.dumps(habitat_signals)
            
            # Save commit
            cursor.execute("""
                INSERT INTO commits (
                    repo_id, merged_commit, base_commit, source_sha, branch, message, author, commit_date,
                    file_changes, additions, deletions, net_change, test_additions, non_test_additions,
                    habitate_score, difficulty_score, suitability_score, pr_number, is_merge,
                    files, habitat_signals, has_dependency_changes, test_coverage_score,
                    complexity_indicators, is_unsuitable, unsuitable_reason, last_status_check,
                    is_behavior_preserving_refactor
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s
                )
                ON DUPLICATE KEY UPDATE
                    file_changes = VALUES(file_changes),
                    additions = VALUES(additions),
                    deletions = VALUES(deletions),
                    net_change = VALUES(net_change),
                    test_additions = VALUES(test_additions),
                    non_test_additions = VALUES(non_test_additions),
                    habitate_score = VALUES(habitate_score),
                    difficulty_score = VALUES(difficulty_score),
                    suitability_score = VALUES(suitability_score),
                    complexity_indicators = VALUES(complexity_indicators),
                    updated_at = NOW()
            """, (
                repo_id, commit_hash, base_commit, source_sha, branch, commit_message[:1000], 
                author, commit_date,
                file_changes, total_additions, total_deletions, net_change, 
                test_additions, non_test_additions,
                habitate_score, difficulty_score, suitability_score, pr_number, is_merge,
                files_json, habitat_signals_json, has_dependency_changes, test_coverage_score,
                complexity_indicators_json, is_unsuitable, unsuitable_reason, last_status_check,
                is_behavior_refactor
            ))
            
            # Get commit ID (works for both INSERT and UPDATE)
            if cursor.lastrowid:
                commit_db_id = cursor.lastrowid
            else:
                # If UPDATE happened, fetch the ID
                cursor.execute("""
                    SELECT id FROM commits 
                    WHERE repo_id = %s AND base_commit = %s
                """, (repo_id, base_commit))
                result = cursor.fetchone()
                commit_db_id = result[0] if result else None
            
            if not commit_db_id:
                print(f"    Warning: Could not get commit ID for {commit_hash[:8]}")
                skipped_count += 1
                continue
            
            # Save file-level statistics
            for file_stat in file_stats:
                cursor.execute("""
                    INSERT INTO commit_files (
                        commit_id, file_path, file_name, file_directory,
                        additions, deletions, is_test_file, is_dependency_file, file_extension
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        additions = VALUES(additions),
                        deletions = VALUES(deletions)
                """, (
                    commit_db_id,
                    file_stat.get('file_path'),
                    file_stat.get('file_name'),
                    file_stat.get('file_directory'),
                    file_stat.get('additions', 0),
                    file_stat.get('deletions', 0),
                    file_stat.get('is_test_file', False),
                    file_stat.get('is_dependency_file', False),
                    file_stat.get('file_extension')
                ))
            
            # Save dependency analysis
            if has_dependency_changes:
                dependency_files_json = json.dumps(dependency_analysis['dependency_files'])
                cursor.execute("""
                    INSERT INTO commit_dependency_analysis (
                        commit_id, dependency_files, dependency_type,
                        has_new_dependencies, has_version_updates
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        dependency_files = VALUES(dependency_files),
                        dependency_type = VALUES(dependency_type),
                        has_new_dependencies = VALUES(has_new_dependencies),
                        has_version_updates = VALUES(has_version_updates),
                        analysis_date = NOW()
                """, (
                    commit_db_id,
                    dependency_files_json,
                    dependency_analysis['dependency_type'],
                    dependency_analysis['has_new_dependencies'],
                    dependency_analysis['has_version_updates']
                ))
            
            # Save test analysis (always save, even if no tests)
            cursor.execute("""
                INSERT INTO commit_test_analysis (
                    commit_id, test_files_added, test_files_modified, test_files_removed,
                    test_coverage_estimate, test_quality_score,
                    has_integration_tests, has_unit_tests
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    test_files_added = VALUES(test_files_added),
                    test_files_modified = VALUES(test_files_modified),
                    test_files_removed = VALUES(test_files_removed),
                    test_coverage_estimate = VALUES(test_coverage_estimate),
                    test_quality_score = VALUES(test_quality_score),
                    has_integration_tests = VALUES(has_integration_tests),
                    has_unit_tests = VALUES(has_unit_tests),
                    analysis_date = NOW()
            """, (
                commit_db_id,
                test_analysis['test_files_added'],
                test_analysis['test_files_modified'],
                test_analysis['test_files_removed'],
                test_analysis['test_coverage_estimate'],
                test_analysis['test_quality_score'],
                test_analysis['has_integration_tests'],
                test_analysis['has_unit_tests']
            ))
            
            conn.commit()
            saved_count += 1
        
        except Error as e:
            print(f"    Error saving commit {commit_hash[:8]}: {e}")
            conn.rollback()
            skipped_count += 1
            continue
        except Exception as e:
            print(f"    Unexpected error processing commit: {e}")
            conn.rollback()
            skipped_count += 1
            continue
    
    cursor.close()
    conn.close()
    
    print(f"  ✅ Saved {saved_count} commits, skipped {skipped_count}")
    return saved_count


def main():
    """Main function."""
    if len(sys.argv) < 2:
        print("Usage: python fetch_commits.py <repos.json> [--fetch-only]")
        print("  --fetch-only: Skip repo import, only fetch commits")
        sys.exit(1)
    
    json_file = sys.argv[1]
    fetch_only = '--fetch-only' in sys.argv
    
    if not fetch_only:
        # Step 1: Save repos from JSON
        print("=" * 60)
        print("STEP 1: Importing repos from JSON")
        print("=" * 60)
        save_repos_from_json(json_file)
    
    # Step 2: Fetch commits for each repo
    print("\n" + "=" * 60)
    print("STEP 2: Fetching commits for all repos")
    print("=" * 60)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all active repos
    cursor.execute("""
        SELECT id, repo_name, full_name, cutoff_date, default_branch
        FROM git_repos
        WHERE is_active = TRUE
        ORDER BY repo_name
    """)
    
    repos = cursor.fetchall()
    cursor.close()
    conn.close()
    
    print(f"Found {len(repos)} active repos to process\n")
    
    total_saved = 0
    for repo_id, repo_name, full_name, cutoff_date, default_branch in repos:
        # Parse full_name to get org
        if '/' in full_name:
            repo_org, repo_name_only = full_name.split('/', 1)
        else:
            repo_org = ''
            repo_name_only = repo_name
        
        # Use cutoff_date or default
        if cutoff_date:
            cutoff_datetime = datetime.combine(cutoff_date, datetime.min.time())
        else:
            cutoff_datetime = datetime.strptime(DEFAULT_CUTOFF_DATE, '%Y-%m-%d')
        
        branch = default_branch or DEFAULT_BRANCH
        
        saved = fetch_commits_for_repo(
            repo_id, repo_org, repo_name_only, cutoff_datetime, branch
        )
        total_saved += saved
    
    print(f"\n{'=' * 60}")
    print(f"✅ Total commits saved: {total_saved}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
