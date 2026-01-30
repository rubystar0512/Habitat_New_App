# Successful Tasks Sharing Feature

## Overview

Team members can share their successful task submissions so all team members can learn which commits are suitable for $1200 tasks. This creates a knowledge base of proven successful commits.

## Database Schema

### `successful_tasks` Table

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
  merge_commit VARCHAR(40) NOT NULL, -- Merge commit hash
  
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

## API Endpoints

### Submit Successful Task

**POST** `/api/successful-tasks`

**Request Body:**
```json
{
  "commit_id": 12345,
  "task_name": "Implement Robust BMesh Edge Dissolve Rules",
  "task_description": "Implement a robust and geometry-aware edge dissolve behavior...",
  "git_base_commit": "abc123def456...",
  "merge_commit": "def456ghi789...",
  "golden_patch": "--- a/file.py\n+++ b/file.py\n@@ -10,6 +10,8 @@\n...",
  "test_patch": "--- a/test_file.py\n+++ b/test_file.py\n@@ -1,3 +1,5 @@\n...",
  "base_patch": "--- a/file.py\n+++ b/file.py\n...",  // Optional
  "pr_number": 1234,  // Optional
  "hints": "Note: The swizzle accessors must return by value...",  // Optional
  "ai_success_rate": 35.5,  // Optional: 0-100%
  "payout_amount": 1200.00  // Optional: $1200 or $200
}
```

**Response:**
```json
{
  "id": 1,
  "status": "pending",
  "message": "Task submission created successfully. Awaiting admin approval."
}
```

### Get All Successful Tasks

**GET** `/api/successful-tasks`

**Query Parameters:**
- `status`: `pending` | `approved` | `rejected` (default: `approved`)
- `commit_id`: Filter by commit
- `repo_id`: Filter by repository
- `user_id`: Filter by submitter
- `min_ai_success_rate`: Minimum success rate (0-100)
- `limit`: Pagination limit (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "tasks": [
    {
      "id": 1,
      "user_id": 5,
      "commit_id": 12345,
      "task_name": "Implement Robust BMesh Edge Dissolve Rules",
      "task_description": "...",
      "git_base_commit": "abc123...",
      "merge_commit": "def456...",
      "pr_number": 1234,
      "hints": "...",
      "status": "approved",
      "ai_success_rate": 35.5,
      "payout_amount": 1200.00,
      "created_at": "2024-01-15T10:30:00Z",
      "commit": {
        "id": 12345,
        "repo_name": "blender",
        "habitate_score": 95,
        "difficulty_score": 75.5,
        "suitability_score": 85.0
      },
      "submitter": {
        "username": "john_doe"
      }
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### Get Task Details (with patches)

**GET** `/api/successful-tasks/:id`

**Response:**
```json
{
  "id": 1,
  "user_id": 5,
  "commit_id": 12345,
  "task_name": "Implement Robust BMesh Edge Dissolve Rules",
  "task_description": "...",
  "git_base_commit": "abc123...",
  "merge_commit": "def456...",
  "base_patch": "--- a/file.py\n...",  // Full patch
  "golden_patch": "--- a/file.py\n...",  // Full patch
  "test_patch": "--- a/test_file.py\n...",  // Full patch
  "pr_number": 1234,
  "hints": "...",
  "status": "approved",
  "ai_success_rate": 35.5,
  "payout_amount": 1200.00,
  "created_at": "2024-01-15T10:30:00Z",
  "approved_at": "2024-01-15T11:00:00Z",
  "approved_by": 1
}
```

### Get Successful Tasks for a Commit

**GET** `/api/successful-tasks/commits/:commit_id`

**Response:**
```json
{
  "commit_id": 12345,
  "tasks": [
    {
      "id": 1,
      "task_name": "...",
      "status": "approved",
      "ai_success_rate": 35.5,
      "payout_amount": 1200.00,
      "created_at": "..."
    }
  ],
  "total": 1
}
```

### Update Own Submission

**PATCH** `/api/successful-tasks/:id`

**Request Body:**
```json
{
  "task_description": "Updated description...",
  "hints": "Updated hints..."
}
```

**Note:** Only allowed if `status = 'pending'` and user owns the submission.

### Delete Own Submission

**DELETE** `/api/successful-tasks/:id`

**Note:** Only allowed if `status = 'pending'` and user owns the submission.

### Admin: Approve Task

**PATCH** `/api/successful-tasks/:id/approve` (Admin only)

**Response:**
```json
{
  "message": "Task approved successfully",
  "task": { ... }
}
```

### Admin: Reject Task

**PATCH** `/api/successful-tasks/:id/reject` (Admin only)

**Request Body:**
```json
{
  "rejection_reason": "Invalid patch format"
}
```

**Response:**
```json
{
  "message": "Task rejected",
  "task": { ... }
}
```

## Validation Rules

1. **Commit Validation:**
   - `commit_id` must exist in `commits` table
   - `merge_commit` must match `commits.merged_commit` for the given `commit_id`
   - `git_base_commit` must match `commits.base_commit` for the given `commit_id`

2. **Patch Validation:**
   - Patches must be valid unified diff format
   - `test_patch` must contain `__HABITAT` markers in test function names
   - `golden_patch` must pass all tests in `test_patch`

3. **Status Workflow:**
   - New submissions: `pending` → `approved` or `rejected`
   - Users can update/delete only `pending` submissions
   - Only approved tasks are visible to all team members

## Use Cases

### 1. Team Member Submits Successful Task

```javascript
// After completing a $1200 task on Habitat platform
POST /api/successful-tasks
{
  "commit_id": 12345,
  "task_name": "Add swizzle support to VecBase",
  "task_description": "Add GLSL-style swizzle accessors...",
  "git_base_commit": "abc123...",
  "merge_commit": "def456...",
  "golden_patch": "...",
  "test_patch": "...",
  "ai_success_rate": 25.0,
  "payout_amount": 1200.00
}
```

### 2. Team Member Browses Successful Tasks

```javascript
// Find all approved $1200 tasks
GET /api/successful-tasks?status=approved&payout_amount=1200

// Find successful tasks for a specific commit
GET /api/successful-tasks/commits/12345

// Find tasks with high success rate
GET /api/successful-tasks?min_ai_success_rate=20
```

### 3. Admin Reviews Submissions

```javascript
// Get pending submissions
GET /api/successful-tasks?status=pending

// Review and approve
PATCH /api/successful-tasks/1/approve

// Or reject with reason
PATCH /api/successful-tasks/1/reject
{
  "rejection_reason": "Test patch missing __HABITAT markers"
}
```

## Benefits

1. **Knowledge Sharing**: Team learns which commits actually work for $1200 tasks
2. **Pattern Recognition**: Identify common characteristics of successful commits
3. **Quality Improvement**: Refine scoring algorithms based on real success data
4. **Time Saving**: Avoid wasting reservations on commits that won't work
5. **Learning Resource**: New team members can learn from proven successful tasks

## Implementation Notes

- **Patch Storage**: Patches stored as TEXT (up to 65KB). For larger patches, consider LONGTEXT (4GB) or external storage
- **Performance**: Index on `status`, `commit_id`, `user_id` for fast queries
- **Privacy**: Users can only see their own pending submissions + all approved submissions
- **Admin Review**: All submissions require admin approval before being visible to team
