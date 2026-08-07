/**
 * Helpers : presets d'activité comme exercices de séance
 */

import {
  ACTIVITY_PRESETS,
  ACTIVITY_PRESET_IDS,
} from './activityPresets';
import {
  activityExerciseId,
  buildActivityExerciseFromPreset,
  defaultActivityConfig,
  isTrackedActivityExercise,
  parseActivityPresetId,
  getActivityTrackingMode,
} from './workoutActivityExercise';

describe('workoutActivityExercise', () => {
  test('builds stable activity:<preset_id> namespace', () => {
    const ex = buildActivityExerciseFromPreset(
      ACTIVITY_PRESETS.find((p) => p.id === ACTIVITY_PRESET_IDS.OUTDOOR_RUNNING),
      { locale: 'fr', order: 0 },
    );
    expect(ex.exercise_id).toBe('activity:outdoor_running');
    expect(ex.source).toBe('activity_preset');
    expect(ex.preset_id).toBe('outdoor_running');
    expect(ex.activity_tracking_mode).toBe('gps');
    expect(ex.reps).toBeNull();
    expect(ex.duration).toBeNull();
    expect(ex.rest_after).toBe(0);
    expect(ex.exercise_name_i18n_snapshot.fr).toBeTruthy();
    expect(ex.exercise_name_i18n_snapshot.en).toBeTruthy();
  });

  test('swimming defaults pool length 25m', () => {
    const ex = buildActivityExerciseFromPreset(
      ACTIVITY_PRESETS.find((p) => p.id === ACTIVITY_PRESET_IDS.POOL_SWIMMING),
      { locale: 'fr' },
    );
    expect(ex.activity_tracking_mode).toBe('laps');
    expect(ex.activity_config.pool_length_meters).toBe(25);
  });

  test('yoga is timer free', () => {
    const ex = buildActivityExerciseFromPreset(
      ACTIVITY_PRESETS.find((p) => p.id === ACTIVITY_PRESET_IDS.YOGA_SESSION),
      { locale: 'fr' },
    );
    expect(ex.activity_tracking_mode).toBe('timer');
    expect(defaultActivityConfig('timer').target_duration_seconds).toBeNull();
  });

  test('parse and detect helpers', () => {
    expect(parseActivityPresetId('activity:outdoor_running')).toBe('outdoor_running');
    expect(parseActivityPresetId('exdb-123')).toBeNull();
    expect(activityExerciseId('outdoor_running')).toBe('activity:outdoor_running');
    expect(isTrackedActivityExercise({ source: 'activity_preset' })).toBe(true);
    expect(isTrackedActivityExercise({ exercise_id: 'activity:tabata' })).toBe(true);
    expect(isTrackedActivityExercise({ exercise_id: 'abc', exercise_type: 'reps' })).toBe(false);
    expect(getActivityTrackingMode({ activity_tracking_mode: 'gps' })).toBe('gps');
  });

  test('catalog exdb exercises are not treated as activity presets', () => {
    const catalogEx = {
      exercise_id: 'exdb_1760',
      name: 'Squat goblet avec haltères',
      exercise_type: 'reps',
      reps: 10,
      tracking_type_snapshot: 'reps_weight',
    };
    expect(isTrackedActivityExercise(catalogEx)).toBe(false);
    expect(parseActivityPresetId('exdb_1760')).toBeNull();
  });

  test('mixed exdb catalog and activity preset in one block', () => {
    const running = buildActivityExerciseFromPreset(
      ACTIVITY_PRESETS.find((p) => p.id === ACTIVITY_PRESET_IDS.OUTDOOR_RUNNING),
      { order: 0 },
    );
    const catalogEx = {
      exercise_id: 'exdb_1760',
      name: 'Squat goblet',
      exercise_type: 'reps',
      reps: 10,
      tracking_type_snapshot: 'reps_weight',
    };
    const block = [running, catalogEx];
    expect(block.filter(isTrackedActivityExercise)).toHaveLength(1);
    expect(isTrackedActivityExercise(catalogEx)).toBe(false);
  });

  test('mixed session can include running pushups stretching', () => {
    const running = buildActivityExerciseFromPreset(
      ACTIVITY_PRESETS.find((p) => p.id === ACTIVITY_PRESET_IDS.OUTDOOR_RUNNING),
      { order: 0 },
    );
    const pushups = {
      exercise_id: 'pushups',
      name: 'Pompes',
      exercise_type: 'reps',
      reps: 12,
      rest_after: 30,
    };
    const stretch = buildActivityExerciseFromPreset(
      ACTIVITY_PRESETS.find((p) => p.id === ACTIVITY_PRESET_IDS.STRETCHING_SESSION),
      { order: 2 },
    );
    const block = [running, pushups, stretch];
    expect(block.filter(isTrackedActivityExercise)).toHaveLength(2);
    expect(isTrackedActivityExercise(pushups)).toBe(false);
  });
});
