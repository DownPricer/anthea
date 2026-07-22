/** Normalise les stats duo depuis /duo/stats ou /duos/{tag}/stats. */
export function normalizeDuoStats(data) {
  if (!data) return null;
  const sessions = data.sessions_together ?? data.total_workouts_together ?? 0;
  const totalTime = data.total_training_time ?? data.total_training_time_together ?? 0;
  const streak = data.streak ?? data.duo_streak_current ?? 0;
  return {
    ...data,
    sessions_together: sessions,
    total_workouts_together: sessions,
    total_training_time: totalTime,
    total_training_time_together: totalTime,
    streak,
    duo_streak_current: data.duo_streak_current ?? streak ?? 0,
    duo_streak_best: data.duo_streak_best ?? 0,
    training_days_together: data.training_days_together ?? sessions,
    last_common_session: data.last_common_session ?? null,
    estimated_calories: data.estimated_calories ?? 0,
    challenges_completed: data.challenges_completed ?? 0,
    badges_unlocked: data.badges_unlocked ?? (data.badges || []).filter((b) => b.unlocked).length,
    badges: data.duo_badges || data.badges || [],
  };
}

/** Aligne le format activité feed Duo (/duo/activity-feed) sur le profil duo. */
export function normalizeDuoActivityItem(item) {
  if (!item) return item;
  if (item.type === 'common_session') return item;
  if (item.type === 'session' && !item.session) {
    const { type, user_repost_id, duo_wall_post_id, ...session } = item;
    return { type: 'session', session };
  }
  return item;
}
