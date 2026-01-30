# Commit Scoring Ranges & Field Explanations

## Score Ranges

### 1. `habitate_score` (INT)
**Range: 0 - 150**

**Calculation:**
- Starts at 0
- Adds points for good patterns (single file 200+, multi-file 300+, etc.)
- Subtracts points for penalties (high deletions, high test percentage, behavior-preserving refactor)
- **Capped at 150** (maximum possible score)
- **Minimum is 0** (negative scores are clamped to 0)

**Typical Values:**
- **0-30**: Low quality commits (too small, too many deletions, behavior-preserving refactors)
- **30-60**: Medium quality commits
- **60-90**: Good quality commits (meet basic patterns)
- **90-120**: Very good commits (strong patterns, high additions)
- **120-150**: Excellent commits (multiple strong indicators)

### 2. `difficulty_score` (DECIMAL 5,2)
**Range: 0.00 - 100.00**

**Calculation:**
- Starts at 0.0
- Adds points for:
  - Codebase understanding (multi-file, cross-directory)
  - Algorithmic complexity (large files, multiple high-addition files)
  - Test coverage quality
  - Domain-specific knowledge
  - Refactoring complexity
- Subtracts 30 points for behavior-preserving refactors
- **Capped at 100.0** (maximum possible score)
- **Minimum is 0.0** (negative scores are clamped to 0.0)

**Typical Values:**
- **0-20**: Very easy (simple changes, behavior-preserving refactors)
- **20-40**: Easy (small scope, single file)
- **40-60**: Medium difficulty (moderate complexity)
- **60-80**: Hard (multi-file, cross-module, complex logic)
- **80-100**: Very hard (large scale, deep codebase understanding required)

### 3. `suitability_score` (DECIMAL 5,2)
**Range: 0.00 - 100.00**

**Calculation:**
- Starts at 50.0 (neutral)
- **Returns 0.0 immediately** if has dependency changes (critical disqualifier)
- Adds points for positive indicators (high difficulty, test coverage, high habitate_score)
- Subtracts points for negative indicators (too narrow, too broad, too small, behavior-preserving refactor)
- **Capped at 100.0** (maximum possible score)
- **Minimum is 0.0** (negative scores are clamped to 0.0)

**Typical Values:**
- **0**: Disqualified (has dependency changes) or very poor
- **0-30**: Poor suitability (too easy, too small, behavior-preserving refactor)
- **30-50**: Below average
- **50-70**: Good suitability (meets basic requirements)
- **70-85**: Very good suitability (strong indicators)
- **85-100**: Excellent suitability (multiple strong indicators, high difficulty, good tests)

## Field Explanations

### `source_sha` (VARCHAR(40))
**Purpose:** The source commit hash (typically same as `merged_commit` for regular commits, but could differ for merge commits)

**Current Implementation:**
- Set to `commit_hash` (same as `merged_commit`)
- Could be enhanced to detect actual source commit for merge commits

**Default:** Same as `merged_commit`

### `complexity_indicators` (JSON)
**Purpose:** Structured indicators of commit complexity

**Contains:**
```json
{
  "multi_file": true/false,           // 4-50 files changed
  "cross_directory": true/false,      // Changes across 3+ directories
  "many_directories": true/false,      // Changes across 5+ directories
  "directory_count": 3,                // Number of top-level directories touched
  "has_core_files": true/false,       // Touches core/domain/engine/kernel/src files
  "large_single_file": true/false,    // Single file with 200+ additions
  "multiple_high_additions": true/false // 3-6 files each with 300+ additions
}
```

**Default:** Calculated from file statistics

### `is_unsuitable` (BOOLEAN)
**Purpose:** Global flag to mark commits as unsuitable (manually set by users/admins)

**Default:** `FALSE` (0)
**When set to TRUE:** Commit is marked as unsuitable and should be filtered out

### `unsuitable_reason` (VARCHAR(255))
**Purpose:** Reason why commit was marked as unsuitable

**Default:** `NULL`
**When set:** User/admin provides reason (e.g., "Too easy", "Already done", "Wrong repo")

### `last_status_check` (TIMESTAMP)
**Purpose:** Last time commit availability was checked via Habitat API

**Default:** `NULL`
**When set:** Timestamp of last Habitat API status check
**Usage:** Used to determine if status cache is stale

### `is_behavior_preserving_refactor` (BOOLEAN)
**Purpose:** Indicates if commit is a behavior-preserving refactor or performance optimization

**Default:** `FALSE` (0)
**When TRUE:** Commit is detected as:
- Performance optimization or refactor (title contains: perf/performance/refactor/optimiz)
- AND preserves behavior (body contains: preserve/same output/behavior/no functional/internal only)

**Impact on Scoring:**
- `habitate_score`: -40 points penalty
- `difficulty_score`: -30 points penalty
- `suitability_score`: -35 points penalty

## Recommended Filtering for $1200 Tasks

To find commits suitable for $1200 tasks (0-50% AI success rate):

```sql
SELECT * FROM commits
WHERE has_dependency_changes = FALSE
  AND is_unsuitable = FALSE
  AND is_behavior_preserving_refactor = FALSE
  AND habitate_score >= 60
  AND difficulty_score >= 50
  AND suitability_score >= 50
ORDER BY suitability_score DESC, difficulty_score DESC, habitate_score DESC
```

**Typical Good Commit:**
- `habitate_score`: 80-120
- `difficulty_score`: 60-90
- `suitability_score`: 70-95
