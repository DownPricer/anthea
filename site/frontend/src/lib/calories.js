/** Coefficient kcal/min selon difficulté ressentie (1-10). */
export function getCaloriesRatePerMinute(difficulty) {
  if (difficulty == null || Number.isNaN(difficulty)) return 5;
  const d = Number(difficulty);
  if (d <= 3) return 3;
  if (d <= 6) return 5;
  if (d <= 8) return 7;
  return 8;
}

/** Estimation motivante — non médicale. */
export function estimateCalories(totalTimeSeconds, difficulty) {
  const minutes = Math.max(0, (totalTimeSeconds || 0) / 60);
  const rate = getCaloriesRatePerMinute(difficulty);
  return Math.round(minutes * rate);
}

export function formatCalories(kcal) {
  if (kcal == null) return '—';
  return `~${kcal} kcal`;
}
