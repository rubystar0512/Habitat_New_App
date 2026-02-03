# Calculation Logic: Scores, Priority, Focus Rate & Win Rate

This document explains how the application **uses** commit scores (habitate, suitability, difficulty) and related metrics. For how those raw scores are *computed* (ranges, typical values, penalties), see [SCORE_RANGES.md](./SCORE_RANGES.md).

---

## 1. Raw Commit Scores (Inputs)

Each commit has three score fields stored in the database. The app reads these and does not recompute them; they are produced by the scoring pipeline (e.g. repofind / Habitat).

| Field (DB)           | Model (JS)        | Typical range | Meaning (brief) |
|----------------------|-------------------|---------------|-----------------|
| `habitate_score`     | `habitateScore`   | 0–150         | Quality / fit for the platform (patterns, size, penalties). |
| `suitability_score`  | `suitabilityScore` | 0–100         | How suitable the commit is (0 = disqualified e.g. dependency changes). |
| `difficulty_score`   | `difficultyScore` | 0–100         | How hard the commit is (codebase understanding, complexity). |

Scores may be stored as:

- **Integer** (`habitate_score`)
- **Decimal 0–1 or 0–100** (`suitability_score`, `difficulty_score`). The app treats values ≤ 1 as a 0–1 scale and normalizes to 0–100 internally.

---

## 2. Priority (0–100) — Single-Commit Score

**Purpose:** One number per commit to rank reservations and memo items (“which commit to focus on”). Used when creating reservations/memos and for “suggested priority” in the UI.

**Formula:** Priority is the sum of four parts, capped to 0–100 and rounded to an integer.

### 2.1 Habitate part (max 40 points)

- **Input:** `habitateScore` (or `habitate_score`).
- **Normalization:** `score / 5`, clamped to [0, 40].
- **Code:** `habitatePart = min(40, max(0, h / 5))`.
- So habitate 0 → 0 pts, 200 → 40 pts (capped).

### 2.2 Suitability part (max 30 points)

- **Input:** `suitabilityScore` (or `suitability_score`).
- **Scale:** If value ≤ 1, treat as 0–1 and multiply by 100; otherwise treat as 0–100.
- **Normalization:** `(sNorm / 100) * 30`, clamped to [0, 30].
- **Code:** `sNorm = s <= 1 ? s * 100 : s`; `suitabilityPart = min(30, max(0, (sNorm/100)*30))`.

### 2.3 Difficulty part (max 20 points)

- **Input:** `difficultyScore` (or `difficulty_score`).
- **Scale:** Same as suitability (≤ 1 → 0–100, else 0–100).
- **Normalization:** `(dNorm / 100) * 20`, clamped to [0, 20].
- **Code:** `dNorm = d <= 1 ? d * 100 : d`; `difficultyPart = min(20, max(0, (dNorm/100)*20))`.

### 2.4 Pattern bonus (0, 5, or 10 points)

- **Inputs:** `fileChanges` (or `file_changes`), `additions`.
- **Rules:**
  - **+5** if single-file with 200+ additions: `fileChanges === 1 && additions >= 200`.
  - **+5** if multi-file with 300+ additions: `fileChanges >= 3 && additions >= 300`.
- Both can apply (max +10).

### 2.5 Final priority

```
raw   = habitatePart + suitabilityPart + difficultyPart + patternBonus
priority = round(clamp(raw, 0, 100))
```

**Where it’s used:**

- **Reservations:** On create, `priority` is set from `computePriorityFromCommit(commit)`. GET returns `suggestedPriority` (same formula) for display / “Apply suggested”.
- **Memo:** On add, `priority` defaults to `computePriorityFromCommit(commit)` if not provided. GET returns `suggestedPriority`.
- **Statistics:** Focus rate per repo is an average of this priority over a set of commits (see below).

**Implementation:** `backend/services/priorityCalculator.js` — `computePriorityFromCommit(commit)`. Accepts both camelCase and snake_case keys for raw query results.

---

## 3. Focus Rate (0–100) — Per Repository

**Purpose:** “Which repo to focus on first” for the team. One number per repo, shown in the Statistics chart.

**Definition:**

- For each repo we define a **focus rate** in [0, 100].
- It is the **average** of `computePriorityFromCommit(commit)` over a chosen set of commits in that repo.

**Which commits are used:**

1. **If the repo has at least one paid_out commit:**  
   Focus rate = average priority over **paid_out** commits only (quality of wins).
2. **If the repo has no paid_out commits yet (e.g. just started):**  
   Focus rate = average priority over **all** commits in that repo (potential from available commits).

**Formula (per repo):**

```
commits_set = (paid_out count > 0) ? paid_out_commits_in_repo : all_commits_in_repo
focusRate = average( computePriorityFromCommit(c) for c in commits_set )
```

Averages are over the chosen set; result is rounded to two decimals. Repos with no commits get focus rate 0.

**Where it’s used:** Statistics page — “Which repo to focus on first” chart (horizontal bar, sorted by focus rate descending).

**Implementation:** `backend/routes/stats.js` — `GET /stats/repo-win-rates`. Returns `repoWinRates[]` with `focusRate`, `winRate`, `paidOutCount`, `totalCommits` per repo.

---

## 4. Win Rate (%) — Per Repository

**Purpose:** Share of commits in a repo that have been paid out (team success rate in that repo).

**Formula:**

```
winRate = (total commits in repo > 0) ? round((paid_out count / total commits) * 10000) / 100 : 0
```

- **paid_out count:** Commits in that repo that have a row in `commit_status_cache` with `status = 'paid_out'`.
- **total commits:** All commits in that repo.
- Result is in 0–100 (%) with up to 2 decimal places.

**Where it’s used:** Statistics (same endpoint as focus rate), Reservations table (“This repo: X% team win rate”), Memo table (same label).

---

## 5. Summary Table

| Metric        | Range   | Inputs | Meaning |
|---------------|---------|--------|--------|
| **Priority**  | 0–100   | habitate, suitability, difficulty, fileChanges, additions | Single-commit “focus” score (scores + pattern). |
| **Focus rate**| 0–100   | Average of priority over (paid_out or all) commits per repo | Which repo to focus on first. |
| **Win rate** | 0–100%  | paid_out count, total commits per repo | % of commits in repo that are paid out. |

---

## 6. File Reference

| Logic / endpoint | File |
|------------------|------|
| Priority from commit (habitate, suitability, difficulty, pattern) | `backend/services/priorityCalculator.js` |
| Focus rate & win rate per repo | `backend/routes/stats.js` — `GET /stats/repo-win-rates` |
| Priority on reservation create / suggested | `backend/routes/reservations.js` |
| Priority on memo add / suggested | `backend/routes/memo.js` |
| Commit model (score fields) | `backend/models/Commit.js` |
| Raw score ranges and semantics | [SCORE_RANGES.md](./SCORE_RANGES.md) |
