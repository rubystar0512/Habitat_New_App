# Commit Fetcher Script

Python script to import repos from JSON and fetch all commits with detailed statistics.

## Setup

1. **Create virtual environment and install dependencies:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Note:** If `python3-venv` is not installed, install it first:
```bash
apt install python3.12-venv
```

2. **Create `.env` file** (or set environment variables):
```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=habitate
DB_PASSWORD=University12345*
DB_NAME=habitate_db
GITHUB_TOKEN=your_github_token_here  # Optional, for private repos
```

## Usage

### Step 1: Import repos from JSON
```bash
# Activate virtual environment first
source venv/bin/activate

# Run the script
python fetch_commits.py repos.json
```

This will:
- Read repos from `repos.json`
- Save/update repos in `git_repos` table
- Set all repos to `is_active = TRUE`
- Use cutoff date `2015-01-01` for repos without cutoff_date

### Step 2: Fetch commits (automatic)
After importing repos, the script automatically:
- Clones each repo to `repos/` directory
- Fetches all commits since cutoff date
- Calculates scores (habitate_score, difficulty_score, suitability_score)
- Saves commits and file-level statistics to database

### Fetch commits only (skip import)
If repos are already in database:
```bash
source venv/bin/activate
python fetch_commits.py repos.json --fetch-only
```

## What it does

1. **Saves repos** to `git_repos` table with:
   - `repo_name`, `full_name`, `habitat_repo_id`
   - `cutoff_date` (from JSON or default 2015-01-01)
   - `is_active = TRUE` (all repos)

2. **For each repo:**
   - Clones to `repos/{org}/{repo_name}/`
   - Gets all commits since cutoff date
   - For each commit:
     - Gets file-level statistics (additions/deletions per file)
     - Detects test files and dependency files
     - Analyzes dependencies in detail (type, new deps, version updates)
     - Analyzes tests in detail (added/modified/removed, coverage, quality)
     - Detects behavior-preserving refactors
     - Calculates scores
     - Saves to `commits` table
     - Saves file stats to `commit_files` table
     - Saves dependency analysis to `commit_dependency_analysis` table
     - Saves test analysis to `commit_test_analysis` table

## Output

- Cloned repos: `repos/{org}/{repo_name}/`
- Database tables:
  - `git_repos`: Repository metadata
  - `commits`: Commit details with scores
  - `commit_files`: File-level statistics
  - `commit_dependency_analysis`: Detailed dependency change analysis
  - `commit_test_analysis`: Detailed test file analysis

## ML: Success prediction (good for paid_out)

Training data is exported from `commit_status_cache` + `commits` (status `paid_out` or `too_easy`).

### 1. Export training CSV
```bash
python ml_data_convertor.py
# Output: ml_train_data.csv
# Columns: 28 features + status
```

### 2. Train the model
```bash
pip install -r requirements.txt   # pandas, scikit-learn, joblib, xgboost
python train_success_model.py [path/to/ml_train_data.csv]
# Saves: success_model.joblib, success_scaler.joblib, success_config.json
```

### 3. Predict for a commit
```bash
python success_predictor.py <habitate> <difficulty> <suitability> [threshold]
```

From Python (optional extra features):
```python
from success_predictor import predict
prob, is_good = predict(habitate_score, difficulty_score, suitability_score)
# Or: predict(h, d, s, repo_id=1, file_changes=5, ...)
```

## Notes

- Script handles duplicate commits (ON DUPLICATE KEY UPDATE)
- Progress is shown every 100 commits
- Errors are logged but don't stop processing
- Large repos may take significant time to process
