# Data needed on tables for a good success-prediction model

## Tables and columns we use today

### 1. **commit_status_cache**
| Column   | Use |
|----------|-----|
| `commit_id` | Join to commits |
| `status`    | **Label**: `paid_out` = 1 (good), `too_easy` = 0 |

**Need:** Every commit you want to train on must have a row here with `status` in (`paid_out`, `too_easy`). Correct, consistent labels are critical.

---

### 2. **commits** (14 features)

| Column | Type | Used as feature? |
|--------|------|------------------|
| `habitate_score` | int | ✓ |
| `difficulty_score` | decimal | ✓ |
| `suitability_score` | decimal | ✓ |
| `repo_id` | int | ✓ |
| `file_changes` | int | ✓ |
| `additions` | int | ✓ |
| `deletions` | int | ✓ |
| `net_change` | int | ✓ |
| `test_additions` | int | ✓ |
| `non_test_additions` | int | ✓ |
| `is_merge` | bool | ✓ (0/1) |
| `has_dependency_changes` | bool | ✓ (0/1) |
| `test_coverage_score` | decimal | ✓ |
| `is_behavior_preserving_refactor` | bool | ✓ (0/1) |

**Need:** All of these should be **non-NULL** (or filled with 0/false) for commits that have a label in `commit_status_cache`. The pipeline fills NULLs with 0, but missing or wrong values hurt the model.

**Not used (and why):**
- `pr_number` – identifier, not predictive
- `branch`, `message`, `author` – high cardinality / text
- `unsuitable_reason` – text
- `files`, `habitat_signals`, `complexity_indicators` – JSON (could be used later; see “Optional” below)

---

## Optional: extra data (now included in CSV)

The following are **included** in the CSV and used for training (28 features total). Tables should have these populated where possible.

| Source | Column / concept | In CSV as |
|--------|-------------------|------------------|
| **commits** | `commit_date` | `commit_month` (1–12), `commit_dow` (0–6) |
| **commits** | `complexity_indicators` (JSON) | `multi_file`, `cross_directory`, `many_directories`, `has_core_files`, `large_single_file`, `multiple_high_additions`, `directory_count` (0/1 or int) |
| **commit_file_stats_cache** | `test_file_count`, `non_test_file_count` | same names (0 if missing) |
| **commit_file_stats_cache** | `single_file_200plus`, `multi_file_300plus` | 0/1 |
| **commit_test_analysis** | `has_test_changes` | 0/1 (0 if no row) |
| **git_repos** | (not yet) | We use `repo_id` only; repo-level stats could be added later. |

---

## Data quality checklist for a good model

1. **Labels**
   - `commit_status_cache.status` is correct and only `paid_out` or `too_easy` for training rows.
   - Enough examples of **both** classes (imbalance is handled with `scale_pos_weight`, but very few of one class hurts).

2. **Commits**
   - All 14 feature columns above are populated (or 0/false) for every commit that has a label.
   - Scores (`habitate_score`, `difficulty_score`, `suitability_score`) and file stats (`file_changes`, `additions`, `deletions`, …) are computed consistently (e.g. by `fetch_commits.py`).

3. **No leakage**
   - Don’t use future-only or post-outcome data (e.g. “checked at” time after payout) as features.
   - Don’t use identifiers (e.g. `pr_number`, commit hash) as features.

4. **Volume**
   - More (correctly labeled) commits generally help; current ~4.5k rows is workable; 10k+ is better if you can get it.

---

## Summary

- **Required for current model:**  
  **commit_status_cache** (commit_id, status) + **commits** (the 14 columns above), with correct labels and non-NULL/non-missing feature values.

- **Optional (now in pipeline):**  
  `commit_date` → month/dow, `complexity_indicators` → flags + directory_count, `commit_file_stats_cache` (test/non_test file count, single_file_200plus, multi_file_300plus), `commit_test_analysis.has_test_changes`. Re-export CSV and retrain to use the full 28-feature model.
