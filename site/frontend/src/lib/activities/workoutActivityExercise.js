/**
 * Transforme un preset FitMatch en exercice de séance (compatible blocs workout).
 * Namespace stable : activity:<preset_id>
 */

import { getPresetById } from './activityPresets';

export const ACTIVITY_EXERCISE_ID_PREFIX = 'activity:';

const DEFAULT_INTERVAL_CONFIG = {
  work_seconds: 30,
  rest_seconds: 30,
  rounds: 8,
};

export function activityExerciseId(presetId) {
  if (!presetId) return null;
  if (String(presetId).startsWith(ACTIVITY_EXERCISE_ID_PREFIX)) return String(presetId);
  return `${ACTIVITY_EXERCISE_ID_PREFIX}${presetId}`;
}

export function parseActivityPresetId(exerciseId) {
  if (!exerciseId || typeof exerciseId !== 'string') return null;
  if (!exerciseId.startsWith(ACTIVITY_EXERCISE_ID_PREFIX)) return null;
  return exerciseId.slice(ACTIVITY_EXERCISE_ID_PREFIX.length) || null;
}

export function isTrackedActivityExercise(exercise) {
  if (!exercise) return false;
  if (exercise.source === 'activity_preset') return true;
  return Boolean(parseActivityPresetId(exercise.exercise_id));
}

export function defaultActivityConfig(trackingMode) {
  const mode = trackingMode || 'timer';
  const base = {
    target_duration_seconds: null,
    target_distance_meters: null,
    pool_length_meters: null,
    interval_config: null,
  };
  if (mode === 'laps') {
    return { ...base, pool_length_meters: 25 };
  }
  if (mode === 'intervals') {
    return { ...base, interval_config: { ...DEFAULT_INTERVAL_CONFIG } };
  }
  return base;
}

export function buildActivityExerciseFromPreset(preset, { locale = 'fr', order = 0 } = {}) {
  const full = typeof preset?.activity_tracking_mode === 'string' && preset?.name
    ? preset
    : getPresetById(preset?.id || preset);
  if (!full) {
    throw new Error(`Unknown activity preset: ${preset?.id || preset}`);
  }

  const lang = (locale || 'fr').split('-')[0].toLowerCase();
  const nameI18n = full.name || {};
  const localizedName =
    nameI18n[lang] || nameI18n.fr || nameI18n.en || full.id;
  const mode = full.activity_tracking_mode || 'timer';

  return {
    exercise_id: activityExerciseId(full.id),
    source: 'activity_preset',
    preset_id: full.id,
    name: localizedName,
    description: '',
    exercise_type: 'activity',
    duration: null,
    reps: null,
    rest_after: 0,
    order,
    tts_enabled: true,
    image_url: null,
    exercise_name_snapshot: localizedName,
    exercise_name_i18n_snapshot: {
      fr: nameI18n.fr || localizedName,
      en: nameI18n.en || localizedName,
      es: nameI18n.es || localizedName,
    },
    media_snapshot: null,
    tracking_type_snapshot: mode,
    activity_kind: full.activity_kind || 'other',
    activity_tracking_mode: mode,
    activity_config: defaultActivityConfig(mode),
    icon: full.icon || null,
  };
}

export function getActivityTrackingMode(exercise) {
  if (!exercise) return null;
  return (
    exercise.activity_tracking_mode ||
    exercise.tracking_type_snapshot ||
    null
  );
}

export function formatActivityModeBadgeKey(mode) {
  const map = {
    gps: 'gps',
    timer: 'timer',
    manual_distance: 'manualDistance',
    laps: 'laps',
    intervals: 'intervals',
  };
  return map[mode] || mode;
}

/** Clé stable pour démarrer un exercice suivi dans une séance (anti-doublon). */
export function buildStartIdempotencyKey({
  workoutSessionId,
  scheduledWorkoutId,
  exerciseIndex,
  presetId,
}) {
  const workoutPart = workoutSessionId || scheduledWorkoutId || 'unknown';
  const preset = presetId || 'unknown';
  return `workout:${workoutPart}:exercise:${exerciseIndex}:preset:${preset}`;
}
