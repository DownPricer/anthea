/**
 * Presets d'activités canoniques FitMatch (distincts du catalogue ExerciseDB).
 */

export const ACTIVITY_PRESET_IDS = {
  OUTDOOR_RUNNING: 'outdoor_running',
  OUTDOOR_WALKING: 'outdoor_walking',
  HIKING: 'hiking',
  OUTDOOR_CYCLING: 'outdoor_cycling',
  OUTDOOR_ROLLER: 'outdoor_roller',
  POOL_SWIMMING: 'pool_swimming',
  TRACK_LAPS: 'track_laps',
  SHUTTLE_RUN: 'shuttle_run',
  INTERVAL_RUNNING: 'interval_running',
  TABATA: 'tabata',
  FREE_INTERVALS: 'free_intervals',
  TREADMILL_RUNNING: 'treadmill_running',
  INDOOR_CYCLING: 'indoor_cycling',
  INDOOR_ROWING: 'indoor_rowing',
  ELLIPTICAL: 'elliptical',
  YOGA_SESSION: 'yoga_session',
  STRETCHING_SESSION: 'stretching_session',
};

/** Presets affichés en section principale sur /activity/start */
export const START_PAGE_PRESET_IDS = [
  ACTIVITY_PRESET_IDS.OUTDOOR_RUNNING,
  ACTIVITY_PRESET_IDS.OUTDOOR_WALKING,
  ACTIVITY_PRESET_IDS.HIKING,
  ACTIVITY_PRESET_IDS.OUTDOOR_CYCLING,
  ACTIVITY_PRESET_IDS.POOL_SWIMMING,
  ACTIVITY_PRESET_IDS.TREADMILL_RUNNING,
  ACTIVITY_PRESET_IDS.INDOOR_CYCLING,
  ACTIVITY_PRESET_IDS.INDOOR_ROWING,
  ACTIVITY_PRESET_IDS.ELLIPTICAL,
  ACTIVITY_PRESET_IDS.INTERVAL_RUNNING,
  ACTIVITY_PRESET_IDS.YOGA_SESSION,
  ACTIVITY_PRESET_IDS.STRETCHING_SESSION,
];

export const ACTIVITY_PRESETS = [
  {
    id: ACTIVITY_PRESET_IDS.OUTDOOR_RUNNING,
    activity_kind: 'running',
    activity_tracking_mode: 'gps',
    icon: '🏃',
    name: { fr: 'Course extérieure', en: 'Outdoor running', es: 'Carrera al aire libre' },
  },
  {
    id: ACTIVITY_PRESET_IDS.OUTDOOR_WALKING,
    activity_kind: 'walking',
    activity_tracking_mode: 'gps',
    icon: '🚶',
    name: { fr: 'Marche', en: 'Walking', es: 'Caminata' },
  },
  {
    id: ACTIVITY_PRESET_IDS.HIKING,
    activity_kind: 'hiking',
    activity_tracking_mode: 'gps',
    icon: '⛰️',
    name: { fr: 'Randonnée', en: 'Hiking', es: 'Senderismo' },
  },
  {
    id: ACTIVITY_PRESET_IDS.OUTDOOR_CYCLING,
    activity_kind: 'cycling',
    activity_tracking_mode: 'gps',
    icon: '🚴',
    name: { fr: 'Vélo extérieur', en: 'Outdoor cycling', es: 'Ciclismo al aire libre' },
  },
  {
    id: ACTIVITY_PRESET_IDS.OUTDOOR_ROLLER,
    activity_kind: 'roller',
    activity_tracking_mode: 'gps',
    icon: '🛼',
    name: { fr: 'Roller', en: 'Inline skating', es: 'Patinaje en línea' },
  },
  {
    id: ACTIVITY_PRESET_IDS.POOL_SWIMMING,
    activity_kind: 'swimming',
    activity_tracking_mode: 'laps',
    icon: '🏊',
    name: { fr: 'Natation', en: 'Swimming', es: 'Natación' },
  },
  {
    id: ACTIVITY_PRESET_IDS.TRACK_LAPS,
    activity_kind: 'track',
    activity_tracking_mode: 'laps',
    icon: '🏟️',
    name: { fr: 'Tours de piste', en: 'Track laps', es: 'Vueltas de pista' },
  },
  {
    id: ACTIVITY_PRESET_IDS.SHUTTLE_RUN,
    activity_kind: 'shuttle',
    activity_tracking_mode: 'laps',
    icon: '↔️',
    name: { fr: 'Course navette', en: 'Shuttle run', es: 'Carrera de ida y vuelta' },
  },
  {
    id: ACTIVITY_PRESET_IDS.INTERVAL_RUNNING,
    activity_kind: 'running',
    activity_tracking_mode: 'intervals',
    icon: '⚡',
    name: { fr: 'Fractionné', en: 'Interval running', es: 'Entrenamiento por intervalos' },
  },
  {
    id: ACTIVITY_PRESET_IDS.TABATA,
    activity_kind: 'hiit',
    activity_tracking_mode: 'intervals',
    icon: '🔥',
    name: { fr: 'Tabata', en: 'Tabata', es: 'Tabata' },
  },
  {
    id: ACTIVITY_PRESET_IDS.FREE_INTERVALS,
    activity_kind: 'other',
    activity_tracking_mode: 'intervals',
    icon: '⏱️',
    name: { fr: 'Intervalles libres', en: 'Free intervals', es: 'Intervalos libres' },
  },
  {
    id: ACTIVITY_PRESET_IDS.TREADMILL_RUNNING,
    activity_kind: 'running',
    activity_tracking_mode: 'manual_distance',
    icon: '🏃‍♂️',
    name: { fr: 'Course sur tapis', en: 'Treadmill running', es: 'Cinta de correr' },
  },
  {
    id: ACTIVITY_PRESET_IDS.INDOOR_CYCLING,
    activity_kind: 'cycling',
    activity_tracking_mode: 'manual_distance',
    icon: '🚴‍♀️',
    name: { fr: 'Vélo intérieur', en: 'Indoor cycling', es: 'Ciclismo indoor' },
  },
  {
    id: ACTIVITY_PRESET_IDS.INDOOR_ROWING,
    activity_kind: 'rowing',
    activity_tracking_mode: 'manual_distance',
    icon: '🚣',
    name: { fr: 'Rameur', en: 'Indoor rowing', es: 'Remo indoor' },
  },
  {
    id: ACTIVITY_PRESET_IDS.ELLIPTICAL,
    activity_kind: 'elliptical',
    activity_tracking_mode: 'manual_distance',
    icon: '🔄',
    name: { fr: 'Elliptique', en: 'Elliptical', es: 'Elíptica' },
  },
  {
    id: ACTIVITY_PRESET_IDS.YOGA_SESSION,
    activity_kind: 'yoga',
    activity_tracking_mode: 'timer',
    icon: '🧘',
    name: { fr: 'Yoga', en: 'Yoga', es: 'Yoga' },
  },
  {
    id: ACTIVITY_PRESET_IDS.STRETCHING_SESSION,
    activity_kind: 'stretching',
    activity_tracking_mode: 'timer',
    icon: '🤸',
    name: { fr: 'Étirements', en: 'Stretching', es: 'Estiramientos' },
  },
];

export function getPresetById(presetId) {
  return ACTIVITY_PRESETS.find((p) => p.id === presetId) || null;
}

export function getStartPagePresets() {
  return START_PAGE_PRESET_IDS.map((id) => getPresetById(id)).filter(Boolean);
}

export function localizePreset(preset, locale = 'fr') {
  const lang = (locale || 'fr').split('-')[0].toLowerCase();
  const label = preset.name?.[lang] || preset.name?.en || preset.id;
  return {
    id: preset.id,
    kind: preset.activity_kind,
    mode: preset.activity_tracking_mode,
    icon: preset.icon,
    label,
    labelKey: `activity:presets.${preset.id}`,
    source: 'activity_preset',
  };
}

export function getLocalizedStartPagePresets(locale = 'fr') {
  return getStartPagePresets().map((p) => localizePreset(p, locale));
}

/** Exercices catalogue à ne jamais proposer comme activité GPS */
export const BLOCKED_CATALOG_GPS_PATTERNS = [
  /rollerout/i,
  /rollout/i,
  /barbell skier/i,
  /skin the cat/i,
  /kayak row/i,
  /wrist roller/i,
];

export function isBlockedCatalogExercise(exercise) {
  const name = exercise?.name || exercise?.provider_name || '';
  return BLOCKED_CATALOG_GPS_PATTERNS.some((re) => re.test(name));
}

export function filterReliableCompatibleExercises(exercises) {
  return (exercises || []).filter((ex) => {
    if (isBlockedCatalogExercise(ex)) return false;
    const mode = ex.activity_tracking_mode;
    if (!mode || mode === 'standard' || mode === 'gps') return false;
    return ex.activity_classification_confidence === 'high';
  });
}
