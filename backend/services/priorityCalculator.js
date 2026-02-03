/**
 * Compute priority 0-100 from commit scores and pattern.
 * Used for reservations and memos: habitate, suitability, difficulty, and pattern (single-file 200+, multi-file 300+).
 */
function computePriorityFromCommit(commit) {
  if (!commit) return 0;

  // Support both camelCase (model) and snake_case (raw query) keys
  const h = (commit.habitateScore ?? commit.habitate_score) != null ? Number(commit.habitateScore ?? commit.habitate_score) : 0;
  const s = (commit.suitabilityScore ?? commit.suitability_score) != null ? Number(commit.suitabilityScore ?? commit.suitability_score) : 0;
  const d = (commit.difficultyScore ?? commit.difficulty_score) != null ? Number(commit.difficultyScore ?? commit.difficulty_score) : 0;
  const fileChanges = (commit.fileChanges ?? commit.file_changes) != null ? parseInt(commit.fileChanges ?? commit.file_changes, 10) : 0;
  const additions = (commit.additions ?? commit.additions) != null ? parseInt(commit.additions, 10) : 0;

  // Habitate: 0-200 -> 0-40 (score/5, cap 40)
  const habitatePart = Math.min(40, Math.max(0, h / 5));

  // Suitability: 0-1 or 0-100 -> 0-30 (if value > 1 treat as 0-100 scale)
  const sNorm = s <= 1 ? s * 100 : s;
  const suitabilityPart = Math.min(30, Math.max(0, (sNorm / 100) * 30));

  // Difficulty: 0-1 or 0-100 -> 0-20 (medium-high difficulty can be valuable)
  const dNorm = d <= 1 ? d * 100 : d;
  const difficultyPart = Math.min(20, Math.max(0, (dNorm / 100) * 20));

  // Pattern bonus: single-file 200+ additions, multi-file 300+
  let patternBonus = 0;
  if (fileChanges === 1 && additions >= 200) patternBonus += 5;
  if (fileChanges >= 3 && additions >= 300) patternBonus += 5;

  const raw = habitatePart + suitabilityPart + difficultyPart + patternBonus;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

module.exports = { computePriorityFromCommit };
