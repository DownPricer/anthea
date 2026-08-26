/** Alias hero exercise_id → médias catalogue (miroir backend). */

const ALIASES = {
  'hero:bike': {
    catalogId: 'exdb_H1PESYI',
    gifUrl: 'https://static.exercisedb.dev/media/H1PESYI.gif',
  },
  'hero:trap-bar-deadlift-bands': {
    catalogId: 'exdb_jQGwmxN',
    gifUrl: 'https://static.exercisedb.dev/media/jQGwmxN.gif',
  },
  'hero:box-jump': {
    catalogId: 'exdb_iPm26QU',
    gifUrl: 'https://static.exercisedb.dev/media/iPm26QU.gif',
  },
  'hero:sled-sprint': {
    catalogId: null,
    gifUrl: null,
    fallback: 'cardio',
  },
  'hero:med-ball-slam': {
    catalogId: 'exdb_oHg8eop',
    gifUrl: 'https://static.exercisedb.dev/media/oHg8eop.gif',
  },
  'hero:lat-pulldown': {
    catalogId: 'exdb_ecpY0rH',
    gifUrl: 'https://static.exercisedb.dev/media/ecpY0rH.gif',
  },
  'hero:lateral-raise': {
    catalogId: 'exdb_goJ6ezq',
    gifUrl: 'https://static.exercisedb.dev/media/goJ6ezq.gif',
  },
};

export function resolveHeroExerciseMedia(exerciseId) {
  return ALIASES[exerciseId] || null;
}

export function heroExerciseImageUrl(exercise) {
  if (!exercise) return null;
  if (exercise.image_url || exercise.media_snapshot) {
    return exercise.image_url || exercise.media_snapshot;
  }
  const alias = resolveHeroExerciseMedia(exercise.exercise_id);
  return alias?.gifUrl || null;
}

export function heroExerciseHasMediaFallback(exercise) {
  if (heroExerciseImageUrl(exercise)) return false;
  const alias = resolveHeroExerciseMedia(exercise?.exercise_id);
  return Boolean(alias?.fallback || exercise?.media_fallback);
}
