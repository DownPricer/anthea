/**
 * Intégration Player : activités trackées dans le flux séance
 */

import fs from 'fs';
import path from 'path';

describe('WorkoutPlayerPage tracked activities (source)', () => {
  const playerSrc = fs.readFileSync(
    path.join(__dirname, 'WorkoutPlayerPage.jsx'),
    'utf8',
  );
  const trackedSrc = fs.readFileSync(
    path.join(__dirname, '../components/player/TrackedActivityInPlayer.jsx'),
    'utf8',
  );
  const createSrc = fs.readFileSync(
    path.join(__dirname, 'CreateWorkoutPage.jsx'),
    'utf8',
  );

  test('keeps WorkoutPlayerPage route and header shell', () => {
    expect(playerSrc).toContain('export function WorkoutPlayerPage');
    expect(playerSrc).toContain('TrackedActivityInPlayer');
    expect(playerSrc).toContain('completeTrackedActivity');
    expect(playerSrc).toContain('workout-mixed-summary');
  });

  test('tracked panel starts only after explicit Start click', () => {
    expect(trackedSrc).toContain('tracked-activity-start-btn');
    expect(trackedSrc).toContain('tracked-activity-finish-btn');
    expect(trackedSrc).toContain("Terminer l'exercice");
    expect(trackedSrc).toContain('createLocationTracker');
    expect(trackedSrc).toMatch(/handleStart[\s\S]*activitiesApi\.start/);
    expect(trackedSrc).toContain('scheduled_workout_id');
    expect(trackedSrc).toContain('workout_exercise_index');
  });

  test('GPS permission only after start (not on mount ready)', () => {
    expect(trackedSrc).toContain("phase === 'ready'");
    expect(trackedSrc).toMatch(/startGps[\s\S]*tracker\.start/);
    expect(trackedSrc).toMatch(/TRACKING_MODES\.GPS[\s\S]*phase !== 'active'/);
  });

  test('modes covered: timer gps laps intervals manual_distance', () => {
    expect(trackedSrc).toContain('TRACKING_MODES.TIMER');
    expect(trackedSrc).toContain('TRACKING_MODES.GPS');
    expect(trackedSrc).toContain('TRACKING_MODES.LAPS');
    expect(trackedSrc).toContain('TRACKING_MODES.INTERVALS');
    expect(trackedSrc).toContain('TRACKING_MODES.MANUAL_DISTANCE');
  });

  test('create workout adds preset without navigating to activity/start', () => {
    expect(createSrc).toContain('buildActivityExerciseFromPreset');
    expect(createSrc).not.toMatch(
      /handleActivityPresetSelect[\s\S]{0,400}navigate\(`\/activity\/start/,
    );
  });

  test('mixed flow Course → Pompes → Étirements supported in player', () => {
    expect(playerSrc).toContain('isTrackedActivityExercise');
    expect(playerSrc).toContain('activitySummaries');
    expect(playerSrc).toContain('activity_summary');
    expect(playerSrc).toMatch(/completeTrackedActivity[\s\S]*finishExercisePhase/);
  });

  test('StartActivityPage recovery redirects to player when workout-linked', () => {
    const startSrc = fs.readFileSync(
      path.join(__dirname, 'StartActivityPage.jsx'),
      'utf8',
    );
    expect(startSrc).toContain('scheduled_workout_id');
    expect(startSrc).toMatch(/scheduled_workout_id[\s\S]*\/player\//);
  });

  test('mobile overflow guards preserved', () => {
    expect(playerSrc).toContain('player-exercise-stage');
    expect(playerSrc).toContain('min-w-0');
    expect(playerSrc).toContain('max-w-full');
    expect(trackedSrc).toContain('max-w-md');
  });
});
