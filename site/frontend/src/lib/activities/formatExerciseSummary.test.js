import {
  formatExerciseSummaryMetrics,
  getExerciseSummaryDisplayName,
} from './formatExerciseSummary';

describe('formatExerciseSummaryMetrics', () => {
  test('shows distance and duration for running', () => {
    const line = formatExerciseSummaryMetrics({
      name: 'Course extérieure',
      tracking_mode: 'gps',
      distance_meters: 4800,
      moving_seconds: 1862,
      average_pace_seconds_per_km: 388,
    });
    expect(line).toContain('4,8');
    expect(line).toContain('31:02');
    expect(line).not.toMatch(/NaN|Infinity|0:00\/km/);
  });

  test('shows swimming laps', () => {
    const line = formatExerciseSummaryMetrics({
      name: 'Natation',
      tracking_mode: 'laps',
      distance_meters: 1000,
      laps: 40,
      moving_seconds: 1692,
    });
    expect(line).toContain('1');
    expect(line).toContain('40');
    expect(line).toContain('28:12');
  });

  test('shows timer duration', () => {
    expect(
      formatExerciseSummaryMetrics({
        name: 'Yoga',
        tracking_mode: 'timer',
        elapsed_seconds: 480,
      }),
    ).toBe('08:00');
  });

  test('never shows invalid pace', () => {
    const line = formatExerciseSummaryMetrics({
      tracking_mode: 'gps',
      distance_meters: 1000,
      moving_seconds: 300,
      average_pace_seconds_per_km: 0,
    });
    expect(line).not.toContain('/km');
    expect(line).not.toMatch(/NaN|Infinity/);
  });

  test('classic reps', () => {
    expect(
      formatExerciseSummaryMetrics({
        name: 'Pompes',
        sets: 4,
        reps: 48,
      }),
    ).toContain('4');
    expect(
      formatExerciseSummaryMetrics({
        name: 'Pompes',
        sets: 4,
        reps: 48,
      }),
    ).toContain('48');
  });

  test('display name helper', () => {
    expect(getExerciseSummaryDisplayName({ name: 'Marche' })).toBe('Marche');
    expect(
      getExerciseSummaryDisplayName({ name_i18n: { en: 'Walking' } }, 'fr'),
    ).toBe('Walking');
  });
});
