/**
 * Constantes pour le système de suivi d'activité FitMatch
 */

export const TRACKING_MODES = {
  TIMER: 'timer',
  MANUAL_DISTANCE: 'manual_distance',
  LAPS: 'laps',
  INTERVALS: 'intervals',
  GPS: 'gps',
};

export const ACTIVITY_KINDS = {
  RUNNING: 'running',
  WALKING: 'walking',
  HIKING: 'hiking',
  CYCLING: 'cycling',
  ROWING: 'rowing',
  SWIMMING: 'swimming',
  YOGA: 'yoga',
  STRETCHING: 'stretching',
  HIIT: 'hiit',
  OTHER: 'other',
};

export const QUICK_START_TYPES = [
  {
    id: 'outdoor_run',
    labelKey: 'activity:quickStart.outdoorRun',
    label: 'Course extérieure',
    icon: '🏃',
    mode: TRACKING_MODES.GPS,
    kind: ACTIVITY_KINDS.RUNNING,
  },
  {
    id: 'walk',
    labelKey: 'activity:quickStart.walk',
    label: 'Marche',
    icon: '🚶',
    mode: TRACKING_MODES.GPS,
    kind: ACTIVITY_KINDS.WALKING,
  },
  {
    id: 'hike',
    labelKey: 'activity:quickStart.hike',
    label: 'Randonnée',
    icon: '⛰️',
    mode: TRACKING_MODES.GPS,
    kind: ACTIVITY_KINDS.HIKING,
  },
  {
    id: 'outdoor_bike',
    labelKey: 'activity:quickStart.outdoorBike',
    label: 'Vélo extérieur',
    icon: '🚴',
    mode: TRACKING_MODES.GPS,
    kind: ACTIVITY_KINDS.CYCLING,
  },
  {
    id: 'treadmill',
    labelKey: 'activity:quickStart.treadmill',
    label: 'Course sur tapis',
    icon: '🏃‍♂️',
    mode: TRACKING_MODES.MANUAL_DISTANCE,
    kind: ACTIVITY_KINDS.RUNNING,
  },
  {
    id: 'indoor_bike',
    labelKey: 'activity:quickStart.indoorBike',
    label: 'Vélo intérieur',
    icon: '🚴‍♀️',
    mode: TRACKING_MODES.MANUAL_DISTANCE,
    kind: ACTIVITY_KINDS.CYCLING,
  },
  {
    id: 'rowing',
    labelKey: 'activity:quickStart.rowing',
    label: 'Rameur',
    icon: '🚣',
    mode: TRACKING_MODES.MANUAL_DISTANCE,
    kind: ACTIVITY_KINDS.ROWING,
  },
  {
    id: 'swim',
    labelKey: 'activity:quickStart.swim',
    label: 'Natation',
    icon: '🏊',
    mode: TRACKING_MODES.LAPS,
    kind: ACTIVITY_KINDS.SWIMMING,
  },
  {
    id: 'yoga',
    labelKey: 'activity:quickStart.yoga',
    label: 'Yoga',
    icon: '🧘',
    mode: TRACKING_MODES.TIMER,
    kind: ACTIVITY_KINDS.YOGA,
  },
  {
    id: 'stretching',
    labelKey: 'activity:quickStart.stretching',
    label: 'Étirements',
    icon: '🤸',
    mode: TRACKING_MODES.TIMER,
    kind: ACTIVITY_KINDS.STRETCHING,
  },
  {
    id: 'hiit',
    labelKey: 'activity:quickStart.hiit',
    label: 'Fractionné',
    icon: '⚡',
    mode: TRACKING_MODES.INTERVALS,
    kind: ACTIVITY_KINDS.HIIT,
  },
  {
    id: 'other',
    labelKey: 'activity:quickStart.other',
    label: 'Autre',
    icon: '💪',
    mode: TRACKING_MODES.TIMER,
    kind: ACTIVITY_KINDS.OTHER,
  },
];

export const ACTIVITY_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  DISCARDED: 'discarded',
};

export const GPS_STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  GRANTED: 'granted',
  DENIED: 'denied',
  TRACKING: 'tracking',
  ERROR: 'error',
};

export const VISIBILITY_OPTIONS = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  PRIVATE: 'private',
};

export const ROUTE_SHARE_OPTIONS = {
  SUMMARY_ONLY: 'summary_only',
  TRIMMED: 'trimmed_route',
  FULL: 'full_route',
};
