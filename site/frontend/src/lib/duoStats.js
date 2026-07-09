/** Normalise les stats duo depuis /duo/stats ou /duos/{tag}/stats. */
export function normalizeDuoStats(data) {
  if (!data) return null;
  const sessions = data.sessions_together ?? data.total_workouts_together ?? 0;
  const totalTime = data.total_training_time ?? data.total_training_time_together ?? 0;
  return {
    ...data,
    sessions_together: sessions,
    total_workouts_together: sessions,
    total_training_time: totalTime,
    total_training_time_together: totalTime,
    duo_streak_current: data.duo_streak_current ?? 0,
    duo_streak_best: data.duo_streak_best ?? 0,
    training_days_together: data.training_days_together ?? sessions,
    estimated_calories: data.estimated_calories ?? 0,
    challenges_completed: data.challenges_completed ?? 0,
    badges_unlocked: data.badges_unlocked ?? (data.badges || []).filter((b) => b.unlocked).length,
    badges: data.duo_badges || data.badges || [],
  };
}
