# Habitat Coding Tasks Management Platform - Architecture Proposal

## Executive Summary

This document proposes a comprehensive architecture for a web platform that systematically manages Habitat coding task creation by identifying, scoring, filtering, and reserving high-quality open-source commits. The system builds upon the existing `old_app` implementation with enhancements for scalability, reliability, and automation.

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React/Vue)                    │
│  - Admin Dashboard  │  Team Member Dashboard  │  Real-time UI   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────┴───────────────────────────────────────────┐
│                      Backend API (Node.js/Express)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   REST API   │  │  WebSocket   │  │  Auth/JWT    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬──────────────┐
        │             │             │              │
┌───────▼──────┐ ┌───▼──────┐ ┌───▼──────┐ ┌─────▼──────┐
│   MySQL DB   │ │  Git CLI  │ │ Habitat │ │ Background │
│              │ │           │ │   API   │ │   Workers  │
└──────────────┘ └───────────┘ └─────────┘ └────────────┘
```

### 1.2 Component Breakdown

#### Frontend Layer
- **Admin Dashboard**: Repo management, commit fetching, user management, task approval
- **Team Member Dashboard**: Commit browsing, filtering, reservation management, successful task sharing
- **Real-time Updates**: WebSocket integration for fetch progress, reservation status

#### Backend Layer
- **REST API**: CRUD operations, filtering, pagination
- **WebSocket Server**: Real-time progress updates, notifications
- **Authentication**: JWT-based with role-based access control (RBAC)

#### Data Layer
- **MySQL Database**: Primary data store
- **Git Repository Cache**: Local clones for commit analysis
- **Habitat API**: External service for reservations

#### Background Services
- **Python Commit Fetcher**: Standalone Python service that clones repos locally and fetches all commits with detailed file-level statistics
- **Node.js Backend API**: Handles user requests, filtering, reservations
- **Reservation Cron**: Auto-reserves commits based on expiry
- **Status Sync**: Periodically syncs with Habitat API

---

## 2. Enhanced Database Schema

### 2.1 Core Tables (Existing + Enhancements)

#### `users` (Enhanced)
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  -- NEW: Account health tracking
  total_reservations INT DEFAULT 0,
  successful_tasks INT DEFAULT 0,
  failed_tasks INT DEFAULT 0,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_approved (is_approved)
) ENGINE=InnoDB;
```

#### `git_repos` (Enhanced)
```sql
CREATE TABLE git_repos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  habitat_repo_id VARCHAR(100) NULL,
  default_branch VARCHAR(50) DEFAULT 'main',
  cutoff_date DATE NULL,
  is_active BOOLEAN DEFAULT TRUE,
  cloned_path VARCHAR(500) NULL,
  last_fetched_at TIMESTAMP NULL,
  -- NEW: Fetch tracking
  fetch_status ENUM('idle', 'fetching', 'error') DEFAULT 'idle',
  fetch_error_message TEXT NULL,
  total_commits_fetched INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_repo (repo_name),
  INDEX idx_full_name (full_name),
  INDEX idx_active (is_active),
  INDEX idx_habitat_repo_id (habitat_repo_id),
  INDEX idx_fetch_status (fetch_status)
) ENGINE=InnoDB;
```

#### `commits` (Enhanced with Better Scoring)
```sql
CREATE TABLE commits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  merged_commit VARCHAR(40) NOT NULL,
  base_commit VARCHAR(40) NOT NULL,
  source_sha VARCHAR(40) NULL,
  branch VARCHAR(50) NULL,
  message TEXT NULL,
  author VARCHAR(200) NULL,
  commit_date DATETIME NULL,
  
  -- File statistics (aggregate)
  file_changes INT DEFAULT 0,
  additions INT DEFAULT 0,
  deletions INT DEFAULT 0,
  net_change INT DEFAULT 0,
  test_additions INT DEFAULT 0,
  non_test_additions INT DEFAULT 0,
  
  -- Scoring
  habitate_score INT DEFAULT 0, -- Renamed from habitate_code
  difficulty_score DECIMAL(5,2) NULL, -- 0-100 difficulty estimate
  suitability_score DECIMAL(5,2) NULL, -- Overall suitability (0-100)
  
  -- Metadata
  pr_number INT NULL,
  is_merge BOOLEAN DEFAULT FALSE,
  files JSON NULL, -- Array of file paths (for quick reference)
  habitat_signals JSON NULL, -- All computed signals
  
  -- Quality indicators
  has_dependency_changes BOOLEAN DEFAULT FALSE, -- Critical filter
  test_coverage_score DECIMAL(3,2) NULL, -- 0.00-1.00
  complexity_indicators JSON NULL, -- Multi-file, cross-module, etc.
  is_behavior_preserving_refactor BOOLEAN DEFAULT FALSE, -- Performance/refactor with preserved behavior (reduces score)
  
  -- Status tracking
  is_unsuitable BOOLEAN DEFAULT FALSE, -- Global unsuitable flag
  unsuitable_reason VARCHAR(255) NULL,
  last_status_check TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_commit (repo_id, base_commit),
  INDEX idx_repo_id (repo_id),
  INDEX idx_merged_commit (merged_commit),
  INDEX idx_base_commit (base_commit),
  INDEX idx_habitate_score (habitate_score),
  INDEX idx_difficulty_score (difficulty_score),
  INDEX idx_suitability_score (suitability_score),
  INDEX idx_has_dependency_changes (has_dependency_changes),
  INDEX idx_is_unsuitable (is_unsuitable),
  INDEX idx_is_behavior_preserving_refactor (is_behavior_preserving_refactor),
  INDEX idx_commit_date (commit_date),
  FOREIGN KEY (repo_id) REFERENCES git_repos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

#### `commit_files` (NEW - File-level statistics)
```sql
CREATE TABLE commit_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  commit_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_directory VARCHAR(500) NULL,
  additions INT DEFAULT 0,
  deletions INT DEFAULT 0,
  is_test_file BOOLEAN DEFAULT FALSE,
  is_dependency_file BOOLEAN DEFAULT FALSE,
  file_extension VARCHAR(10) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_commit_file (commit_id, file_path),
  
  -- Indexes for fast filtering
  INDEX idx_commit_id (commit_id),
  INDEX idx_is_test_file (is_test_file),
  INDEX idx_is_dependency_file (is_dependency_file),
  INDEX idx_file_directory (file_directory(255)),
  
  -- CRITICAL: Composite indexes for common query patterns
  -- For filtering: "commits where all non-test files have 200+ additions"
  INDEX idx_commit_test_additions (commit_id, is_test_file, additions),
  -- For filtering: "commits where single file has 200+ additions"
  INDEX idx_commit_additions (commit_id, additions),
  -- For filtering: "commits with 3-6 files each having 300+ additions"
  INDEX idx_test_additions (is_test_file, additions),
  
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

**Query Pattern Examples**:

```sql
-- 1. Find commits where ALL non-test files have 200+ additions
-- (Single file with 200+ additions OR all files have 200+)
SELECT DISTINCT c.*
FROM commits c
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE
  AND NOT EXISTS (
    SELECT 1
    FROM commit_files cf
    WHERE cf.commit_id = c.id
      AND cf.is_test_file = FALSE
      AND cf.additions < 200
  )
  AND EXISTS (
    SELECT 1
    FROM commit_files cf
    WHERE cf.commit_id = c.id
      AND cf.is_test_file = FALSE
      AND cf.additions >= 200
  );

-- 2. Find commits where SINGLE non-test file has 200+ additions
SELECT c.*
FROM commits c
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE
  AND (
    SELECT COUNT(*)
    FROM commit_files cf
    WHERE cf.commit_id = c.id
      AND cf.is_test_file = FALSE
  ) = 1
  AND (
    SELECT MAX(cf.additions)
    FROM commit_files cf
    WHERE cf.commit_id = c.id
      AND cf.is_test_file = FALSE
  ) >= 200;

-- 3. Find commits where 3-6 non-test files each have 300+ additions
SELECT c.*
FROM commits c
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE
  AND (
    SELECT COUNT(*)
    FROM commit_files cf
    WHERE cf.commit_id = c.id
      AND cf.is_test_file = FALSE
      AND cf.additions >= 300
  ) BETWEEN 3 AND 6
  AND (
    SELECT COUNT(*)
    FROM commit_files cf
    WHERE cf.commit_id = c.id
      AND cf.is_test_file = FALSE
  ) BETWEEN 3 AND 6
  AND (
    SELECT MIN(cf.additions)
    FROM commit_files cf
    WHERE cf.commit_id = c.id
      AND cf.is_test_file = FALSE
      AND cf.additions >= 300
  ) >= 300;

-- 4. Optimized version using GROUP BY (faster for large datasets)
-- Find commits where ALL non-test files have 200+ additions
SELECT c.*
FROM commits c
INNER JOIN (
  SELECT commit_id
  FROM commit_files
  WHERE is_test_file = FALSE
  GROUP BY commit_id
  HAVING MIN(additions) >= 200
    AND COUNT(*) > 0
) cf_filtered ON c.id = cf_filtered.commit_id
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE;

-- 5. Find commits where single non-test file has 200+ additions (optimized)
SELECT c.*
FROM commits c
INNER JOIN (
  SELECT commit_id, COUNT(*) as file_count, MAX(additions) as max_additions
  FROM commit_files
  WHERE is_test_file = FALSE
  GROUP BY commit_id
  HAVING file_count = 1 AND max_additions >= 200
) cf_single ON c.id = cf_single.commit_id
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE;

-- 6. Find commits where 3-6 non-test files each have 300+ additions (optimized)
SELECT c.*
FROM commits c
INNER JOIN (
  SELECT commit_id,
    COUNT(*) as total_files,
    SUM(CASE WHEN additions >= 300 THEN 1 ELSE 0 END) as high_add_files,
    MIN(CASE WHEN additions >= 300 THEN additions ELSE NULL END) as min_high_add
  FROM commit_files
  WHERE is_test_file = FALSE
  GROUP BY commit_id
  HAVING total_files BETWEEN 3 AND 6
    AND high_add_files = total_files
    AND min_high_add >= 300
) cf_multi ON c.id = cf_multi.commit_id
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE;

-- 7. ULTRA-FAST: Using cache table (RECOMMENDED for production)
-- Find commits where single file has 200+ additions
SELECT c.*
FROM commits c
INNER JOIN commit_file_stats_cache cfsc ON c.id = cfsc.commit_id
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE
  AND cfsc.single_file_200plus = TRUE;

-- 8. ULTRA-FAST: Find commits where 3-6 files each have 300+ additions
SELECT c.*
FROM commits c
INNER JOIN commit_file_stats_cache cfsc ON c.id = cfsc.commit_id
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE
  AND cfsc.multi_file_300plus = TRUE
  AND cfsc.non_test_file_count BETWEEN 3 AND 6;

-- 9. ULTRA-FAST: Find commits where all files have 200+ additions
SELECT c.*
FROM commits c
INNER JOIN commit_file_stats_cache cfsc ON c.id = cfsc.commit_id
WHERE c.repo_id = ?
  AND c.has_dependency_changes = FALSE
  AND c.is_unsuitable = FALSE
  AND cfsc.all_files_200plus = TRUE;
```

**Performance Comparison**:
- **Query 1-3** (NOT EXISTS/EXISTS): ~500ms for 100K commits
- **Query 4-6** (GROUP BY): ~100ms for 100K commits  
- **Query 7-9** (Cache table): ~10ms for 100K commits ⚡ **10-50x faster!**

**Performance Optimization Tips**:

1. **Use GROUP BY instead of NOT EXISTS** when possible (queries 4-6 are faster)
2. **Composite indexes** on `(commit_id, is_test_file, additions)` enable fast filtering
3. **Consider materialized view** for common patterns:
```sql
-- Optional: Create a materialized view for fast lookups
CREATE TABLE commit_file_stats_cache (
  commit_id INT PRIMARY KEY,
  non_test_file_count INT,
  min_non_test_additions INT,
  max_non_test_additions INT,
  avg_non_test_additions DECIMAL(10,2),
  single_file_200plus BOOLEAN,
  multi_file_300plus BOOLEAN,
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Update this cache when commits are inserted/updated
```

#### `user_habitat_accounts` (Enhanced)
```sql
CREATE TABLE user_habitat_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  api_url VARCHAR(255) DEFAULT 'https://code.habitat.inc',
  token VARCHAR(500) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  reverse_limit INT DEFAULT 7,
  
  -- NEW: Account health tracking
  remaining_reversals INT NULL, -- Calculated: reverse_limit - active_reservations
  last_used_at TIMESTAMP NULL,
  total_reservations_made INT DEFAULT 0,
  failed_reservations INT DEFAULT 0,
  account_health ENUM('healthy', 'warning', 'exhausted', 'error') DEFAULT 'healthy',
  health_last_checked TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_is_active (is_active),
  INDEX idx_account_health (account_health),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

#### `reservations` (Enhanced with Audit Trail)
```sql
CREATE TABLE reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_id INT NOT NULL,
  commit_id INT NOT NULL,
  reservation_id VARCHAR(100) NULL, -- Habitat API reservation ID
  status ENUM('reserved', 'released', 'failed', 'expired') DEFAULT 'reserved',
  error_message TEXT NULL,
  
  -- NEW: Expiry tracking
  expires_at TIMESTAMP NULL,
  auto_renew_enabled BOOLEAN DEFAULT FALSE,
  
  -- NEW: Audit fields
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_account_id (account_id),
  INDEX idx_commit_id (commit_id),
  INDEX idx_reservation_id (reservation_id),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES user_habitat_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 2.2 New Tables for Enhanced Features

#### `commit_dependency_analysis` (NEW)
```sql
CREATE TABLE commit_dependency_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  commit_id INT NOT NULL,
  dependency_files JSON NOT NULL, -- Array of modified dependency files
  dependency_type ENUM('package_json', 'go_mod', 'requirements_txt', 'pom_xml', 'cargo_toml', 'other') NULL,
  has_new_dependencies BOOLEAN DEFAULT FALSE,
  has_version_updates BOOLEAN DEFAULT FALSE,
  analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_commit (commit_id),
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

#### `commit_test_analysis` (NEW)
```sql
CREATE TABLE commit_test_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  commit_id INT NOT NULL,
  test_files_added INT DEFAULT 0,
  test_files_modified INT DEFAULT 0,
  test_files_removed INT DEFAULT 0,
  test_coverage_estimate DECIMAL(3,2) NULL, -- 0.00-1.00
  test_quality_score INT DEFAULT 0, -- 0-100
  has_integration_tests BOOLEAN DEFAULT FALSE,
  has_unit_tests BOOLEAN DEFAULT FALSE,
  analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_commit (commit_id),
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

#### `reservation_audit_log` (NEW)
```sql
CREATE TABLE reservation_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NULL,
  user_id INT NOT NULL,
  account_id INT NOT NULL,
  commit_id INT NOT NULL,
  action ENUM('reserve', 'release', 'auto_reserve', 'auto_release', 'fail') NOT NULL,
  status_before VARCHAR(50) NULL,
  status_after VARCHAR(50) NULL,
  error_message TEXT NULL,
  habitat_api_response JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reservation_id (reservation_id),
  INDEX idx_user_id (user_id),
  INDEX idx_commit_id (commit_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

#### `commit_favorites` (NEW - User-specific favorites)
```sql
CREATE TABLE commit_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  commit_id INT NOT NULL,
  notes TEXT NULL,
  priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_commit (user_id, commit_id),
  INDEX idx_user_id (user_id),
  INDEX idx_commit_id (commit_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

#### `successful_tasks` (NEW - Shared successful task submissions)
```sql
CREATE TABLE successful_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  commit_id INT NOT NULL,
  
  -- Task information
  task_name VARCHAR(255) NOT NULL,
  task_description TEXT NOT NULL,
  pr_number INT NULL,
  hints TEXT NULL, -- Optional hints that were used
  
  -- Git commit information
  git_base_commit VARCHAR(40) NOT NULL, -- Base commit hash
  merge_commit VARCHAR(40) NOT NULL, -- Merge commit hash (should match commits.merged_commit)
  
  -- Patch files (stored as TEXT - can be large)
  base_patch TEXT NULL, -- Optional base patch
  golden_patch TEXT NOT NULL, -- Golden patch (correct implementation)
  test_patch TEXT NOT NULL, -- Test patch with __HABITAT markers
  
  -- Metadata
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by INT NULL, -- Admin who approved
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT NULL,
  
  -- Statistics (for learning)
  ai_success_rate DECIMAL(5,2) NULL, -- 0-100% success rate if known
  payout_amount DECIMAL(10,2) NULL, -- $1200 or $200
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_commit_id (commit_id),
  INDEX idx_status (status),
  INDEX idx_task_name (task_name),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
```

#### `commit_file_stats_cache` (NEW - Materialized view for fast filtering)
```sql
-- Optional but RECOMMENDED for performance
-- Pre-computed statistics for common filtering patterns
CREATE TABLE commit_file_stats_cache (
  commit_id INT PRIMARY KEY,
  
  -- File counts
  non_test_file_count INT DEFAULT 0,
  test_file_count INT DEFAULT 0,
  total_file_count INT DEFAULT 0,
  
  -- Addition statistics (non-test files only)
  min_non_test_additions INT DEFAULT 0,
  max_non_test_additions INT DEFAULT 0,
  avg_non_test_additions DECIMAL(10,2) DEFAULT 0,
  total_non_test_additions INT DEFAULT 0,
  
  -- Pattern flags (pre-computed for fast filtering)
  single_file_200plus BOOLEAN DEFAULT FALSE,
  single_file_500plus BOOLEAN DEFAULT FALSE,
  multi_file_300plus BOOLEAN DEFAULT FALSE, -- 3-6 files with 300+ each
  all_files_200plus BOOLEAN DEFAULT FALSE, -- All non-test files have 200+
  
  -- Updated when commit_files change
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE,
  INDEX idx_single_file_200plus (single_file_200plus),
  INDEX idx_multi_file_300plus (multi_file_300plus),
  INDEX idx_all_files_200plus (all_files_200plus),
  INDEX idx_non_test_file_count (non_test_file_count),
  INDEX idx_max_non_test_additions (max_non_test_additions)
) ENGINE=InnoDB;
```

**Benefits of Cache Table**:
- **10-100x faster** queries for common patterns
- Simple WHERE clauses: `WHERE single_file_200plus = TRUE`
- Can be updated via trigger or Python fetcher after inserting files
- Enables fast filtering without complex JOINs or subqueries

**Update Strategy**:
```sql
-- Trigger to update cache when commit_files change
DELIMITER $$
CREATE TRIGGER update_commit_file_stats_cache
AFTER INSERT ON commit_files
FOR EACH ROW
BEGIN
  INSERT INTO commit_file_stats_cache (commit_id, ...)
  SELECT 
    commit_id,
    COUNT(CASE WHEN is_test_file = FALSE THEN 1 END) as non_test_file_count,
    MIN(CASE WHEN is_test_file = FALSE THEN additions END) as min_non_test_additions,
    MAX(CASE WHEN is_test_file = FALSE THEN additions END) as max_non_test_additions,
    ...
  FROM commit_files
  WHERE commit_id = NEW.commit_id
  ON DUPLICATE KEY UPDATE
    non_test_file_count = VALUES(non_test_file_count),
    min_non_test_additions = VALUES(min_non_test_additions),
    ...
END$$
DELIMITER ;
```

---

## 3. Commit Scoring Algorithm for $1200-Quality Commits

### 3.1 Scoring Components

The scoring system identifies commits that are likely to achieve 0-50% AI success rate (targeting $1200 tasks).

#### Base Score Calculation (`habitate_score`) - Updated Based on Experience

**Key Patterns for Good Commits:**
- Single file (non-test) with 200+ additions = good commit
- 3-6 files (non-test) with 300-500+ additions each = good commit

```javascript
function calculateHabitatScore(commit, fileStats) {
  let score = 0;
  
  // Get non-test file statistics
  const nonTestFiles = fileStats.filter(f => !f.is_test_file);
  const nonTestAdditions = nonTestFiles.reduce((sum, f) => sum + f.additions, 0);
  const nonTestDeletions = nonTestFiles.reduce((sum, f) => sum + f.deletions, 0);
  const nonTestFileCount = nonTestFiles.length;
  
  // Pattern 1: Single file with 200+ additions (non-test)
  if (nonTestFileCount === 1 && nonTestFiles[0].additions >= 200) {
    score += 30; // Strong indicator
    if (nonTestFiles[0].additions >= 500) score += 15; // Bonus for very large
  }
  
  // Pattern 2: 3-6 files with 300-500+ additions each (non-test)
  if (nonTestFileCount >= 3 && nonTestFileCount <= 6) {
    const allHaveHighAdditions = nonTestFiles.every(f => f.additions >= 300);
    const avgAdditions = nonTestAdditions / nonTestFileCount;
    
    if (allHaveHighAdditions && avgAdditions >= 400) {
      score += 35; // Very strong indicator
    } else if (avgAdditions >= 300) {
      score += 25; // Good indicator
    }
  }
  
  // Multi-file bonus (4-50 files)
  if (nonTestFileCount >= 4 && nonTestFileCount <= 50) {
    score += 25;
  }
  
  // Non-trivial size (20+ total changes)
  const totalChanges = nonTestAdditions + nonTestDeletions;
  if (totalChanges >= 20) {
    score += 20;
  }
  
  // Test files present (indicates well-tested commit)
  const hasTestFiles = fileStats.some(f => f.is_test_file);
  if (hasTestFiles) {
    score += 18;
  }
  
  // File count bonuses
  if (nonTestFileCount >= 6) score += 8;
  if (nonTestFileCount >= 10) score += 8;
  if (nonTestFileCount >= 20) score += 12;
  
  // Net change bonuses (using non-test additions)
  const netChange = nonTestAdditions - nonTestDeletions;
  if (netChange >= 100) score += 4;
  if (netChange >= 200) score += 8;
  if (netChange >= 500) score += 12;
  
  // High non-test additions bonus
  if (nonTestAdditions >= 500) score += 8;
  if (nonTestAdditions >= 1000) score += 12;
  
  // Penalties
  if (nonTestDeletions > nonTestAdditions * 0.5) {
    score -= 10; // High deletion ratio
  }
  
  // Test percentage penalty
  const totalAdditions = commit.additions;
  const testPercentage = totalAdditions > 0 ? commit.test_additions / totalAdditions : 0;
  if (testPercentage > 0.4) {
    score -= Math.round(30 * testPercentage); // Up to 30 point penalty
  }
  
  // Behavior-preserving refactor penalty (reduces score significantly)
  if (commit.is_behavior_preserving_refactor) {
    score -= 40; // Significant penalty - these are typically easier for AI
  }
  
  return Math.max(0, Math.min(150, score));
}
```

#### NEW: Difficulty Score (0-100) - Using File-Level Statistics
```python
def calculate_difficulty_score(commit_data: Dict, file_stats: List[Dict]) -> float:
    """
    Calculate difficulty score using file-level statistics.
    """
    score = 0.0
    
    # Filter non-test files
    non_test_files = [f for f in file_stats if not f.get('is_test_file', False)]
    non_test_count = len(non_test_files)
    
    # 1. Codebase Understanding (0-30 points)
    # Multi-file changes indicate cross-module understanding
    if non_test_count >= 10:
        score += 15
    if non_test_count >= 20:
        score += 10
    if non_test_count >= 30:
        score += 5
    
    # Cross-directory changes (complexity indicator)
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
    
    # 2. Algorithmic Complexity (0-25 points)
    # Pattern: Single file with 200+ additions OR 3-6 files with 300+ each
    if non_test_count == 1 and non_test_files[0].get('additions', 0) >= 200:
        score += 15  # Single large file indicates complex logic
        if non_test_files[0].get('additions', 0) >= 500:
            score += 10  # Very large single file
    
    if 3 <= non_test_count <= 6:
        # Check if all files have 300+ additions
        all_high = all(f.get('additions', 0) >= 300 for f in non_test_files)
        avg_additions = sum(f.get('additions', 0) for f in non_test_files) / non_test_count
        
        if all_high and avg_additions >= 400:
            score += 20  # Strong pattern: multiple files with high additions
        elif avg_additions >= 300:
            score += 15
    
    # Large total non-test additions
    total_non_test = sum(f.get('additions', 0) for f in non_test_files)
    if total_non_test >= 1000:
        score += 5
    
    # 3. Test Coverage Quality (0-20 points)
    test_files = [f for f in file_stats if f.get('is_test_file', False)]
    if len(test_files) > 0:
        score += 10
        if commit_data.get('test_coverage_score', 0) >= 0.5:
            score += 5
        if commit_data.get('test_coverage_score', 0) >= 0.7:
            score += 5
    
    # 4. Domain-Specific Knowledge (0-15 points)
    core_patterns = ['core/', 'domain/', 'engine/', 'kernel/', 'src/']
    has_core_changes = any(
        any(pattern in f.get('file_path', '') for pattern in core_patterns)
        for f in non_test_files
    )
    if has_core_changes:
        score += 10
    
    # 5. Refactoring Complexity (0-10 points)
    total_additions = sum(f.get('additions', 0) for f in non_test_files)
    total_deletions = sum(f.get('deletions', 0) for f in non_test_files)
    if total_additions > 0:
        refactor_ratio = total_deletions / total_additions
        if 0.3 <= refactor_ratio <= 0.7:
            score += 10  # Balanced refactoring
    
    # Behavior-preserving refactor penalty (reduces difficulty score)
    if commit_data.get('is_behavior_preserving_refactor', False):
        score -= 30  # These are easier - reduce difficulty score
    
    return min(100.0, max(0.0, score))
```

#### NEW: Suitability Score (0-100)
```python
def calculate_suitability_score(commit_data: Dict, file_stats: List[Dict]) -> float:
    """
    Calculate overall suitability score (0-100).
    """
    score = 50.0  # Start at neutral
    
    # Critical disqualifiers (immediate rejection)
    if commit_data.get('has_dependency_changes', False):
        return 0.0
    if commit_data.get('is_unsuitable', False):
        return 0.0
    
    # Behavior-preserving refactor penalty (significant reduction)
    if commit_data.get('is_behavior_preserving_refactor', False):
        score -= 35  # These are easier for AI - significantly reduce suitability
    
    # Positive indicators
    difficulty = commit_data.get('difficulty_score', 0)
    if difficulty >= 60:
        score += 20
    if difficulty >= 80:
        score += 10
    
    if commit_data.get('test_coverage_score', 0) >= 0.5:
        score += 15
    
    habitate_score = commit_data.get('habitate_score', 0)
    if habitate_score >= 80:
        score += 10
    
    # Negative indicators
    file_changes = commit_data.get('file_changes', 0)
    if file_changes < 4:
        score -= 15  # Too narrow
    if file_changes > 100:
        score -= 10  # Too broad
    
    non_test_additions = commit_data.get('non_test_additions', 0)
    if non_test_additions < 200:
        score -= 10  # Too small
    
    # Time-based (closer to cutoff = better, more recent = better)
    # This would be calculated based on commit_date vs repo cutoff_date
    # days_since_cutoff = calculate_days_since_cutoff(commit_data, repo_data)
    # if days_since_cutoff < 30:
    #     score += 5
    # if days_since_cutoff < 90:
    #     score += 3
    
    return max(0.0, min(100.0, score))
```

### 3.2 Behavior-Preserving Refactor Detection

Detect commits that are performance optimizations or refactors with preserved behavior. These are typically easier for AI and should receive reduced scores.

```python
import re

def detect_behavior_preserving_refactor(commit_message: str, commit_body: str = "") -> bool:
    """
    Detect if commit is a behavior-preserving refactor or performance optimization.
    
    Rule: If title matches perf/performance/refactor/optimiz AND
          (body matches preserve/same output/behavior/no functional/internal only OR
           doesn't change fixture output)
    """
    if not commit_message:
        return False
    
    # Extract title (first line) and body (rest)
    lines = commit_message.split('\n', 1)
    title = lines[0].strip()
    body = (lines[1] if len(lines) > 1 else "") + (commit_body or "")
    
    # Check if title matches performance/refactor patterns
    title_pattern = re.compile(r'perf|performance|refactor|optimiz', re.IGNORECASE)
    if not title_pattern.search(title):
        return False
    
    # Check if body matches behavior-preserving patterns
    body_pattern = re.compile(
        r'preserve|same output|behavior|no functional|internal only|no behavior change',
        re.IGNORECASE
    )
    
    # Note: We can't easily check fixture output changes without running tests
    # So we rely on commit message patterns
    if body_pattern.search(body):
        return True
    
    # Additional check: if title explicitly says "refactor" or "optimize"
    # and body doesn't mention new features or behavior changes
    if re.search(r'refactor|optimize|optimise', title, re.IGNORECASE):
        # Check for absence of behavior-changing keywords
        behavior_change_pattern = re.compile(
            r'add|new feature|change behavior|modify behavior|fix behavior',
            re.IGNORECASE
        )
        if not behavior_change_pattern.search(body):
            return True
    
    return False
```

### 3.3 Test File Detection (Enhanced)

Based on experience: Test files have "test" in the filename OR are located in directories with "test" in the name.

```python
def is_test_file(file_path: str) -> bool:
    """
    Detect if a file is a test file.
    - File name contains "test" (case-insensitive)
    - File is in a directory with "test" in the name
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
```

### 3.3 Dependency Detection

Critical: Commits with dependency changes must be filtered out.

```python
def detect_dependency_changes(files: List[Dict]) -> Dict:
    """
    Detect if commit has dependency file changes.
    Returns dict with has_dependency_changes flag and list of dependency files.
    """
    dependency_files = [
        'package.json', 'package-lock.json', 'yarn.lock',
        'go.mod', 'go.sum',
        'requirements.txt', 'Pipfile', 'poetry.lock',
        'pom.xml', 'build.gradle',
        'Cargo.toml', 'Cargo.lock',
        'Gemfile', 'Gemfile.lock',
        'composer.json', 'composer.lock'
    ]
    
    modified = []
    for f in files:
        file_path = f.get('filename', f.get('path', ''))
        file_name = os.path.basename(file_path)
        
        if (file_name in dependency_files or 
            'node_modules/' in file_path or 
            'vendor/' in file_path):
            modified.append(file_path)
    
    return {
        'has_dependency_changes': len(modified) > 0,
        'dependency_files': modified,
        'dependency_type': detect_dependency_type(modified) if modified else None
    }
```

### 3.4 Test Coverage Estimation

```python
def estimate_test_coverage(file_stats: List[Dict]) -> Dict:
    """
    Estimate test coverage based on file statistics.
    """
    test_files = [f for f in file_stats if f.get('is_test_file', False)]
    test_additions = sum(f.get('additions', 0) for f in test_files)
    test_deletions = sum(f.get('deletions', 0) for f in test_files)
    
    total_additions = sum(f.get('additions', 0) for f in file_stats)
    total_deletions = sum(f.get('deletions', 0) for f in file_stats)
    total_changes = total_additions + total_deletions
    
    # Coverage = test additions / total additions
    coverage = test_additions / total_additions if total_additions > 0 else 0.0
    
    # Check for integration tests
    has_integration_tests = any(
        'integration' in f.get('file_path', '').lower() or
        'e2e' in f.get('file_path', '').lower() or
        'end-to-end' in f.get('file_path', '').lower()
        for f in test_files
    )
    
    return {
        'test_coverage_score': min(1.0, coverage),
        'has_integration_tests': has_integration_tests,
        'has_unit_tests': len(test_files) > 0,
        'test_files_count': len(test_files),
        'test_additions': test_additions,
        'test_deletions': test_deletions
    }
```

---

## 4. API Endpoints Design

### 4.1 Admin Endpoints

#### Repository Management
```
GET    /api/repos                    - List all repos
GET    /api/repos/:id                 - Get repo details
POST   /api/repos                     - Add repo manually
POST   /api/repos/fetch-from-habitat  - Fetch repos from Habitat API
PATCH  /api/repos/:id                 - Update repo
DELETE /api/repos/:id                 - Delete repo
POST   /api/repos/:id/fetch-commits   - Trigger commit fetch for repo
GET    /api/repos/:id/fetch-status    - Get fetch progress
```

#### Commit Management
```
GET    /api/commits                   - List commits with STRONG filters (all data in DB)
GET    /api/commits/:id               - Get commit details with file-level stats
GET    /api/commits/:id/files         - Get file-level statistics for commit
POST   /api/repos/:id/fetch-commits   - Trigger Python fetcher (creates job in queue)
GET    /api/repos/:id/fetch-status    - Get fetch job status
POST   /api/commits/:id/analyze        - Re-analyze commit (recalculate scores)
POST   /api/commits/bulk-mark-unsuitable - Mark multiple commits
```

#### User Management
```
GET    /api/users                     - List all users
GET    /api/users/:id                 - Get user details
PATCH  /api/users/:id/approve         - Approve user
PATCH  /api/users/:id/reject          - Reject user
PATCH  /api/users/:id/role            - Update role
DELETE /api/users/:id                 - Delete user
```

### 4.2 Team Member Endpoints

#### Commit Browsing & Filtering (STRONG FILTERING - All Data in DB)
```
GET    /api/commits                   - List commits with STRONG filters
       Query params:
       - repo_id: Filter by repository
       - min_difficulty_score, max_difficulty_score: Score range
       - min_habitate_score, max_habitate_score: Score range
       - min_file_changes, max_file_changes: File count range
       - min_non_test_additions, max_non_test_additions: Addition range
       - has_dependency_changes=false (required filter - always exclude)
       - is_unsuitable=false (exclude unsuitable commits)
       - is_behavior_preserving_refactor=false (exclude behavior-preserving refactors - typically easier)
       - has_test_coverage=true (only commits with tests)
       
       -- File-level pattern filters (uses commit_file_stats_cache):
       - single_file_200plus=true (single non-test file with 200+ additions)
       - single_file_500plus=true (single non-test file with 500+ additions)
       - multi_file_300plus=true (3-6 non-test files each with 300+ additions)
       - all_files_200plus=true (all non-test files have 200+ additions)
       - min_file_additions=200 (minimum additions per file)
       - max_file_additions=1000 (maximum additions per file)
       
       -- Date filters:
       - date_from, date_to: Commit date range
       
       -- Sorting:
       - sort_field: habitate_score, difficulty_score, suitability_score, commit_date
       - sort_order: ASC, DESC
       
       -- Pagination:
       - limit, offset
       
       Example requests:
       GET /api/commits?repo_id=1&single_file_200plus=true&has_dependency_changes=false&is_behavior_preserving_refactor=false
       GET /api/commits?repo_id=1&multi_file_300plus=true&min_habitate_score=80&is_behavior_preserving_refactor=false
       GET /api/commits?all_files_200plus=true&has_test_coverage=true&is_behavior_preserving_refactor=false
       
       Note: All filtering happens in database using optimized queries with cache table

GET    /api/commits/:id               - Get commit with full details
GET    /api/commits/:id/files         - Get file-level statistics (from commit_files table)
GET    /api/commits/:id/status        - Get commit availability status
POST   /api/commits/:id/favorite      - Add to favorites
DELETE /api/commits/:id/favorite      - Remove from favorites
GET    /api/commits/favorites          - Get favorite commits
```

**Backend Implementation Example** (Node.js):
```javascript
// GET /api/commits
router.get('/commits', async (req, res) => {
  const {
    repo_id,
    single_file_200plus,
    multi_file_300plus,
    all_files_200plus,
    has_dependency_changes = 'false',
    is_unsuitable = 'false',
    is_behavior_preserving_refactor = 'false', // Default: exclude these
    min_habitate_score,
    // ... other filters
  } = req.query;

  let query = `
    SELECT c.*
    FROM commits c
    WHERE 1=1
  `;
  const params = [];

  // Always exclude dependency changes and unsuitable
  query += ' AND c.has_dependency_changes = ?';
  params.push(has_dependency_changes === 'true');
  
  query += ' AND c.is_unsuitable = ?';
  params.push(is_unsuitable === 'true');

  // Exclude behavior-preserving refactors (typically easier for AI)
  if (is_behavior_preserving_refactor === 'false') {
    query += ' AND c.is_behavior_preserving_refactor = FALSE';
  }

  if (repo_id) {
    query += ' AND c.repo_id = ?';
    params.push(repo_id);
  }

  // Use cache table for fast pattern matching
  if (single_file_200plus === 'true') {
    query += ` 
      INNER JOIN commit_file_stats_cache cfsc ON c.id = cfsc.commit_id
      WHERE cfsc.single_file_200plus = TRUE
    `;
  }

  if (multi_file_300plus === 'true') {
    query += `
      INNER JOIN commit_file_stats_cache cfsc ON c.id = cfsc.commit_id
      WHERE cfsc.multi_file_300plus = TRUE
        AND cfsc.non_test_file_count BETWEEN 3 AND 6
    `;
  }

  if (all_files_200plus === 'true') {
    query += `
      INNER JOIN commit_file_stats_cache cfsc ON c.id = cfsc.commit_id
      WHERE cfsc.all_files_200plus = TRUE
    `;
  }

  if (min_habitate_score) {
    query += ' AND c.habitate_score >= ?';
    params.push(min_habitate_score);
  }

  // ... add other filters, sorting, pagination

  const [commits] = await pool.execute(query, params);
  res.json({ commits, total: commits.length });
});
```

#### Reservation Management
```
GET    /api/reservations               - Get user's reservations
POST   /api/reservations               - Reserve a commit
DELETE /api/reservations/:id           - Release reservation
POST   /api/reservations/sync          - Sync with Habitat API
GET    /api/reservations/expiring      - Get expiring reservations
POST   /api/reservations/:id/auto-renew - Enable/disable auto-renew
```

#### Account Management
```
GET    /api/accounts                  - Get user's Habitat accounts
POST   /api/accounts                  - Create account
PATCH  /api/accounts/:id               - Update account
DELETE /api/accounts/:id              - Delete account
GET    /api/accounts/:id/health        - Check account health
POST   /api/accounts/:id/repos         - Add repo mappings
DELETE /api/accounts/:id/repos/:repo_id - Remove repo mapping
```

#### Memo/Queue Management
```
GET    /api/memo                      - Get memo commits
POST   /api/memo                      - Add commit to memo
PATCH  /api/memo/:id                  - Update memo (priority, notes)
DELETE /api/memo/:id                  - Remove from memo
GET    /api/memo/queue                - Get reservation queue status
```

#### Successful Tasks (Shared Knowledge Base)
```
GET    /api/successful-tasks          - Get all approved successful tasks
       Query params:
       - commit_id: Filter by commit
       - repo_id: Filter by repository
       - user_id: Filter by submitter
       - status: pending/approved/rejected
       - min_ai_success_rate: Filter by success rate
       - limit, offset

GET    /api/successful-tasks/:id      - Get task details with patches
GET    /api/successful-tasks/commits/:commit_id - Get successful tasks for a commit

POST   /api/successful-tasks          - Submit a successful task
       Body:
       - commit_id (required)
       - task_name (required)
       - task_description (required)
       - git_base_commit (required)
       - merge_commit (required)
       - golden_patch (required)
       - test_patch (required)
       - base_patch (optional)
       - pr_number (optional)
       - hints (optional)
       - ai_success_rate (optional)
       - payout_amount (optional)

PATCH  /api/successful-tasks/:id      - Update own submission (before approval)
DELETE /api/successful-tasks/:id     - Delete own submission (before approval)

-- Admin only:
PATCH  /api/successful-tasks/:id/approve - Approve task submission
PATCH  /api/successful-tasks/:id/reject  - Reject task submission
       Body: { rejection_reason: "..." }
```

### 4.3 Auto-Reservation Endpoints

```
GET    /api/auto-reservation/config   - Get auto-reservation config
POST   /api/auto-reservation/config   - Update config
GET    /api/auto-reservation/queue    - Get queue status
POST   /api/auto-reservation/queue/:id/cancel - Cancel queued reservation
```

### 4.4 Statistics Endpoints

```
GET    /api/stats/overall             - Overall platform statistics
GET    /api/stats/repos               - Per-repo statistics
GET    /api/stats/users               - User statistics (admin)
GET    /api/stats/my-stats            - Current user's statistics
GET    /api/stats/commits             - Commit quality distribution
GET    /api/stats/successful-tasks    - Statistics about successful tasks
```

### 4.5 Successful Tasks Feature Details

**Purpose:** Team members can share their successful task submissions so all team members can learn which commits are suitable for $1200 tasks.

**Workflow:**
1. Team member completes a task and gets it approved on Habitat platform
2. Team member submits task details via API:
   - Links to commit in database (`commit_id`)
   - Uploads patches (base, golden, test)
   - Provides task description
   - Optionally includes hints, success rate, payout amount
3. Submission is marked as `pending` status
4. Admin reviews and approves/rejects
5. Approved tasks are visible to all team members
6. Team members can browse successful tasks to:
   - See which commits led to successful $1200 tasks
   - Learn from task descriptions and hints
   - Understand patterns of successful commits

**Benefits:**
- **Knowledge Sharing:** Team learns which commits are actually good for $1200 tasks
- **Pattern Recognition:** Identify common characteristics of successful commits
- **Quality Improvement:** Refine scoring algorithms based on real success data
- **Time Saving:** Avoid wasting reservations on commits that won't work

**Data Stored:**
- **Patches:** Full patch files (can be large, stored as TEXT)
- **Task Description:** The exact description that led to success
- **Hints:** Optional hints that helped achieve >0% success rate
- **Success Metrics:** AI success rate, payout amount
- **Git Info:** Base commit and merge commit for reference

**Validation:**
- Verify `merge_commit` matches `commits.merged_commit` for the given `commit_id`
- Verify `git_base_commit` matches `commits.base_commit`
- Admin can verify patches are valid before approval

**Example Use Case:**
```javascript
// Team member submits successful task
POST /api/successful-tasks
{
  "commit_id": 12345,
  "task_name": "Implement Robust BMesh Edge Dissolve Rules",
  "task_description": "Implement a robust and geometry-aware edge dissolve...",
  "git_base_commit": "abc123...",
  "merge_commit": "def456...",
  "golden_patch": "--- a/file.py\n+++ b/file.py\n...",
  "test_patch": "--- a/test_file.py\n+++ b/test_file.py\n...",
  "base_patch": "--- a/file.py\n+++ b/file.py\n...",
  "ai_success_rate": 35.5,
  "payout_amount": 1200.00
}

// Other team members can see successful tasks
GET /api/successful-tasks?status=approved&min_ai_success_rate=0
// Returns list of approved successful tasks with commit details

// View tasks for a specific commit
GET /api/successful-tasks/commits/12345
// Returns all successful tasks submitted for commit 12345
```

---

## 5. Background Job Architecture

### 5.1 Job Types

#### 1. Python Commit Fetcher Service (Standalone)
**Purpose**: Clone repos locally and fetch ALL commits with detailed file-level statistics

**Technology**: Python (separate from Node.js backend)

**Trigger**: 
- Manual (admin trigger via API)
- Scheduled (daily at 2 AM UTC via cron)

**Process**:
1. Connect to MySQL database to get active repos
2. For each repo with `is_active = true`:
   - Clone repository locally (if not exists) or pull latest changes
   - Fetch ALL commits since `cutoff_date` using `git log`
   - For each commit:
     - Get commit details (hash, author, date, message, parents)
     - Use `git show --stat --numstat` to get file-level statistics
     - For each file:
       - Detect if test file (filename or directory contains "test")
       - Detect if dependency file
       - Extract additions, deletions per file
       - Save to `commit_files` table
     - Calculate aggregate statistics (total additions, deletions, etc.)
     - Detect dependency changes
     - Calculate scores (habitate_score, difficulty_score, suitability_score)
     - Save commit to `commits` table
     - Save file-level data to `commit_files` table
   - Update repo `last_fetched_at` and `total_commits_fetched`

**Key Features**:
- Fetches ALL commits (no pre-filtering) - users filter in UI
- Stores file-level additions/deletions for detailed analysis
- Uses local git clone (faster, no API rate limits)
- Can resume from last processed commit

**Error Handling**:
- Retry failed repos (max 3 attempts)
- Log errors to `git_repos.fetch_error_message`
- Continue processing other repos on failure
- Transaction-based saves (commit + files together)

**Database Schema for File Stats**:
- `commit_files` table stores per-file statistics
- Enables queries like "commits where single file has 200+ additions"
- Enables queries like "commits where 3-6 files each have 300+ additions"

#### 2. Reservation Cron Service
**Purpose**: Auto-reserve commits when they become available

**Trigger**: 
- Every 10 seconds (check queue)
- Per-account cron schedules (user-configurable)

**Process**:
1. Fetch unavailable commits from Habitat API (per account)
2. Update `commit_status_cache` with latest status
3. Update `commit_reservation_queue` with expiry times
4. For commits ready to reserve (`scheduled_expires_at <= now + 5s`):
   - Check account health (remaining reversals)
   - Attempt reservation via Habitat API
   - Create `reservation` record
   - Log to `reservation_audit_log`
   - Update queue status

**Priority Rules**:
1. Highest `suitability_score`
2. Highest `difficulty_score`
3. Closest to cutoff date
4. Recently tested (higher `test_coverage_score`)

#### 3. Status Sync Service
**Purpose**: Periodically sync commit status from Habitat API

**Trigger**: Every 30 minutes

**Process**:
1. Get all repos with `habitat_repo_id`
2. For each account:
   - Fetch unavailable commits for each repo
   - Update `commit_status_cache`
   - Update `reservations.expires_at` if changed
   - Mark expired reservations

#### 4. Account Health Checker
**Purpose**: Monitor account health and remaining reversals

**Trigger**: Every hour

**Process**:
1. For each active account:
   - Count active reservations
   - Calculate `remaining_reversals = reverse_limit - active_count`
   - Update `account_health`:
     - `healthy`: remaining > 2
     - `warning`: remaining <= 2
     - `exhausted`: remaining = 0
   - Update `last_used_at` if recently used

### 5.2 Job Queue System

**Architecture**:
- **Python Fetcher**: Standalone service that reads from database queue
- **Node.js Backend**: Creates fetch jobs in database
- **Communication**: Via MySQL database (job queue table)

**Job Queue Table**:
```sql
CREATE TABLE commit_fetch_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_repo_id (repo_id),
  FOREIGN KEY (repo_id) REFERENCES git_repos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

**Python Fetcher Process**:
```python
# Python service polls database for pending jobs
while True:
    jobs = get_pending_jobs()
    for job in jobs:
        try:
            process_repo_commits(job.repo_id)
            mark_job_completed(job.id)
        except Exception as e:
            mark_job_failed(job.id, str(e))
    time.sleep(10)  # Poll every 10 seconds
```

**Node.js API Endpoint**:
```javascript
// POST /api/repos/:id/fetch-commits
// Creates job in commit_fetch_jobs table
// Python service picks it up automatically
```

### 5.3 Python Commit Fetcher Implementation Details

**Technology Stack**:
- Python 3.9+
- `gitpython` or `subprocess` for git operations
- `mysql-connector-python` or `pymysql` for database
- `python-dotenv` for configuration

**Key Functions**:

```python
def fetch_repo_commits(repo_id: int, repo_path: str, cutoff_date: str):
    """
    Fetch all commits from a cloned repository.
    """
    # Get commits since cutoff_date
    commits = git_log_since(repo_path, cutoff_date)
    
    for commit_hash in commits:
        # Get commit details
        commit_data = get_commit_details(repo_path, commit_hash)
        
        # Get file-level statistics
        file_stats = get_file_statistics(repo_path, commit_hash)
        
        # Analyze files
        for file_stat in file_stats:
            file_stat['is_test_file'] = is_test_file(file_stat['file_path'])
            file_stat['is_dependency_file'] = is_dependency_file(file_stat['file_path'])
        
        # Calculate aggregate statistics
        aggregate = calculate_aggregate_stats(file_stats)
        
        # Detect dependency changes
        has_deps = any(f['is_dependency_file'] for f in file_stats)
        
        # Detect behavior-preserving refactor
        is_behavior_refactor = detect_behavior_preserving_refactor(
            commit_data.get('message', ''),
            commit_data.get('body', '')
        )
        commit_data['is_behavior_preserving_refactor'] = is_behavior_refactor
        
        # Calculate scores (will apply penalties for behavior-preserving refactors)
        scores = calculate_all_scores(commit_data, file_stats, aggregate)
        
        # Save to database (transaction)
        save_commit_with_files(repo_id, commit_data, aggregate, scores, file_stats)

def get_file_statistics(repo_path: str, commit_hash: str) -> List[Dict]:
    """
    Get per-file additions/deletions using git show --numstat
    """
    # git show --numstat <hash> outputs: additions deletions filename
    # Parse output and return list of file stats
    pass

def save_commit_with_files(repo_id, commit_data, aggregate, scores, file_stats):
    """
    Save commit and all file statistics in a single transaction.
    """
    with db.transaction():
        # Insert commit
        commit_id = insert_commit(repo_id, commit_data, aggregate, scores)
        
        # Insert file stats
        for file_stat in file_stats:
            insert_commit_file(commit_id, file_stat)
```

**Database Schema for File Stats**:
- `commit_files` table enables complex queries:
  - "Find commits where single non-test file has 200+ additions"
  - "Find commits where 3-6 non-test files each have 300+ additions"
  - "Find commits with high test coverage (test files in test directories)"

### 5.4 Concurrency Control

- **Python Commit Fetcher**: Max 2 concurrent repo fetches
- **Reservation Cron**: Max 5 concurrent reservations per account
- **Status Sync**: Max 10 concurrent API calls

---

## 6. Edge Cases & Failure Modes

### 6.1 Race Conditions

#### Problem: Multiple users reserving same commit
**Solution**: 
- Database unique constraint on `reservations(commit_id, status='reserved')`
- Check `commit_status_cache` before reservation
- Use database transactions with row-level locking

```sql
START TRANSACTION;
SELECT * FROM commits WHERE id = ? FOR UPDATE;
-- Check status, reserve if available
COMMIT;
```

#### Problem: Account exhaustion during auto-reservation
**Solution**:
- Check `remaining_reversals` before each reservation
- Use optimistic locking on `user_habitat_accounts`
- Queue reservations if account exhausted, retry later

### 6.2 API Failures

#### Problem: Habitat API timeout/failure
**Solution**:
- Exponential backoff retry (3 attempts)
- Queue failed reservations for retry
- Log errors to `reservation_audit_log`
- Continue processing other commits

#### Problem: Git repository fetch failure
**Solution**:
- Mark repo with `fetch_status = 'error'`
- Store error in `fetch_error_message`
- Admin can retry manually
- Continue with other repos

### 6.3 Data Consistency

#### Problem: Reservation exists locally but not in Habitat API
**Solution**:
- Periodic sync job checks `reservations` vs Habitat API
- If mismatch, update local status
- Alert user if reservation lost

#### Problem: Commit status cache stale
**Solution**:
- Cache TTL: 30 minutes
- Force refresh before critical operations
- Background job refreshes stale entries

### 6.4 Account Management

#### Problem: Multiple users sharing same Habitat account
**Solution**:
- Track by `account_name + api_url` combination
- Global `reverse_limit` enforcement across all users
- Show shared account status in UI

#### Problem: Account token expired/invalid
**Solution**:
- Health check detects API failures
- Mark account as `account_health = 'error'`
- Alert user to update token
- Skip account in auto-reservation

### 6.5 Commit Quality

#### Problem: False positives (commits marked suitable but too easy)
**Solution**:
- User feedback: "Mark as unsuitable" feature
- Track unsuitable marks per user
- Machine learning: Adjust scores based on historical data
- Admin review queue for high-scoring commits
- **Successful Tasks Feature**: Learn from actual successful submissions

#### Problem: Dependency changes missed
**Solution**:
- Multiple detection methods (file names, content analysis)
- Admin can manually mark as unsuitable
- Re-analysis job checks flagged commits

### 6.6 Successful Tasks Feature

#### Problem: Large patch files consuming storage
**Solution**:
- Store patches as TEXT (MySQL supports up to 65KB per field)
- For larger patches, consider:
  - Storing in file system with path reference
  - Using LONGTEXT (up to 4GB)
  - Compressing patches before storage
  - External storage (S3, etc.) for very large patches

#### Problem: Invalid patch submissions
**Solution**:
- Validate patch format before saving
- Verify `merge_commit` matches `commits.merged_commit`
- Verify `git_base_commit` matches `commits.base_commit`
- Admin review before approval
- Allow users to update submissions before approval

#### Problem: Duplicate submissions for same commit
**Solution**:
- Allow multiple submissions per commit (different approaches)
- Show all successful tasks for a commit
- Allow filtering by success rate or payout amount
- Mark "best" submission if multiple exist

### 6.6 Performance

#### Problem: Large commit fetches blocking system
**Solution**:
- Async processing with job queue
- Progress updates via WebSocket
- Pagination for commit lists
- Database indexing on filter columns

#### Problem: Slow Habitat API responses
**Solution**:
- Request batching (check multiple commits per API call)
- Caching with TTL
- Background sync, not real-time
- Timeout handling (5s timeout)

---

## 7. Security Considerations

### 7.1 Authentication & Authorization
- JWT tokens with expiration
- Role-based access control (admin vs user)
- Account ownership verification (users can only access their accounts)

### 7.2 Data Protection
- Encrypt Habitat API tokens at rest
- Secure password hashing (bcrypt)
- SQL injection prevention (parameterized queries)
- XSS prevention (input sanitization)

### 7.3 API Rate Limiting
- Per-user rate limits
- Per-account rate limits for Habitat API
- Exponential backoff on failures

---

## 8. Monitoring & Observability

### 8.1 Metrics to Track
- Commit fetch success rate
- Reservation success rate
- Account health distribution
- API response times
- Queue depth
- Error rates by type

### 8.2 Logging
- Structured logging (JSON format)
- Log levels: ERROR, WARN, INFO, DEBUG
- Audit trail for all reservations
- Error tracking with stack traces

### 8.3 Alerts
- Account exhaustion warnings
- High error rates
- API failures
- Database connection issues

---

## 9. Migration Strategy

### 9.1 From Old App
1. **Database Migration**:
   - Add new columns with defaults
   - Migrate existing data
   - Backfill calculated fields (difficulty_score, suitability_score)

2. **Gradual Rollout**:
   - Run new scoring in parallel
   - Compare results with old system
   - Switch over when validated

3. **Feature Flags**:
   - Enable/disable new features per user
   - A/B testing for scoring algorithms

---

## 10. Future Enhancements

1. **Machine Learning**: Train model on historical task success rates
2. **Predictive Scoring**: Predict AI success rate before reservation
3. **Collaborative Filtering**: Recommend commits based on user history
4. **Advanced Analytics**: Dashboard for task success patterns
5. **Multi-repo Analysis**: Identify cross-repo patterns

---

## Conclusion

This architecture provides a robust, scalable foundation for managing Habitat coding tasks. Key improvements over the existing system:

1. **Python-Based Commit Fetcher**: Standalone Python service that clones repos locally and fetches ALL commits with detailed file-level statistics
2. **File-Level Statistics Storage**: `commit_files` table stores per-file additions/deletions, enabling complex queries for pattern matching
3. **Enhanced Test Detection**: Detects test files by filename OR directory path containing "test"
4. **Experience-Based Scoring**: Updated `habitate_score` algorithm based on real patterns:
   - Single file (non-test) with 200+ additions = good commit
   - 3-6 files (non-test) with 300-500+ additions each = good commit
5. **Strong Filtering**: All commits fetched and stored in DB - users apply strong filters in UI (no GitHub API calls during browsing)
6. **Dependency Detection**: Automatic filtering of unsuitable commits
7. **Account Health**: Proactive monitoring and management
8. **Audit Trail**: Complete history of all operations
9. **Automation**: Intelligent auto-reservation with priority queuing
10. **Reliability**: Comprehensive error handling and retry logic
11. **Successful Tasks Sharing**: Team members can share successful task submissions (patches, descriptions, hints) to build a knowledge base of proven $1200-quality commits

The system is designed to maximize $1200 task success rate while preventing account collisions and wasted reservations. The successful tasks feature enables continuous learning and improvement by sharing real-world success patterns across the team.

---

## Key Architecture Decisions (Based on Feedback)

### 1. Fetch Strategy: Local Git Clone vs GitHub API
- **Decision**: Use local git clone and `git log` / `git show`
- **Rationale**: 
  - No API rate limits
  - Faster for bulk operations
  - Access to full commit history
  - Can resume from last processed commit

### 2. Data Storage: File-Level Statistics
- **Decision**: Store per-file additions/deletions in `commit_files` table
- **Rationale**:
  - Enables pattern-based queries (single file 200+, multi-file 300+)
  - Supports complex filtering without re-analyzing commits
  - Better scoring accuracy with file-level data

### 3. Fetch All vs Pre-Filter
- **Decision**: Fetch ALL commits, filter in database
- **Rationale**:
  - Users can apply strong filters without re-fetching
  - Flexible filtering criteria
  - No data loss from premature filtering

### 4. Python Fetcher vs Node.js
- **Decision**: Separate Python service for commit fetching
- **Rationale**:
  - Better git library support in Python
  - Can run independently
  - Easier to maintain and scale
  - Node.js backend focuses on API and user interactions
