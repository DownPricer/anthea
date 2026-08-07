/**
 * Logique d'état des séances du jour sur l'accueil.
 */

export function getPrimaryWorkoutAction(todayWorkouts, userId) {
  const mineInProg = todayWorkouts.find(
    (w) => w.for_user_id === userId && w.status === 'in_progress',
  );
  if (mineInProg) return { workout: mineInProg, resume: true };
  const pending = todayWorkouts.filter((w) => w.status === 'pending');
  const next = pending[0];
  if (next) return { workout: next, resume: false };
  return null;
}

/** Afficher la carte « pas de séance » uniquement s'il n'y a aucune séance aujourd'hui. */
export function shouldShowEmptyTodayCard(todayWorkouts) {
  return todayWorkouts.length === 0;
}

/** Séances terminées aujourd'hui sans action pending/in_progress. */
export function getCompletedTodayWorkouts(todayWorkouts) {
  return todayWorkouts.filter((w) => w.status === 'completed');
}

export function getWorkoutListSubtitle(workout, userId, t) {
  if (workout.status === 'completed') {
    return t('workouts:status.completed');
  }
  if (workout.status === 'in_progress' && workout.for_user_id === userId) {
    return t('home:pausedPlayer');
  }
  return workout.scheduled_time || t('home:flexible');
}
