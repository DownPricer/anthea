/**
 * Anti-doublon démarrage activité dans le Player
 */

import fs from 'fs';
import path from 'path';
import { buildStartIdempotencyKey } from '../lib/activities/workoutActivityExercise';

describe('buildStartIdempotencyKey', () => {
  test('builds stable workout exercise preset key', () => {
    expect(
      buildStartIdempotencyKey({
        scheduledWorkoutId: 'w1',
        exerciseIndex: 0,
        presetId: 'outdoor_running',
      }),
    ).toBe('workout:w1:exercise:0:preset:outdoor_running');
  });

  test('prefers workoutSessionId when present', () => {
    expect(
      buildStartIdempotencyKey({
        workoutSessionId: 'sess',
        scheduledWorkoutId: 'w1',
        exerciseIndex: 2,
        presetId: 'yoga_session',
      }),
    ).toBe('workout:sess:exercise:2:preset:yoga_session');
  });
});

describe('TrackedActivityInPlayer start guards (source)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../components/player/TrackedActivityInPlayer.jsx'),
    'utf8',
  );

  test('guards with startPendingRef before POST', () => {
    expect(src).toContain('startPendingRef');
    expect(src).toMatch(/if \(startPendingRef\.current \|\| startedRef\.current/);
    expect(src).toContain('startPendingRef.current = true');
    expect(src).toContain('idempotency_key');
    expect(src).toContain('buildStartIdempotencyKey');
  });

  test('disables start button while pending', () => {
    expect(src).toContain('disabled={startPending}');
    expect(src).toContain('tracked-activity-start-btn');
  });

  test('resolves conflicts automatically without dialog', () => {
    expect(src).not.toContain('tracked-conflict-resume');
    expect(src).not.toContain('tracked-conflict-discard-start');
    expect(src).not.toContain('tracked-conflict-cancel');
    expect(src).not.toContain('Une autre activité est déjà en cours');
    expect(src).toContain('redirectIfOtherExercise');
    expect(src).toContain('onRedirectToExercise');
  });

  test('reload recovers linked activity without start POST in recovery effect', () => {
    expect(src).toContain('activitiesApi.getCurrent');
    expect(src).toContain('isLinkedCurrent');
    expect(src).toContain('Reprise après reload');
    expect(src).toMatch(/handleStart[\s\S]*activitiesApi\.start/);
  });

  test('stays on player route for workout-linked resume', () => {
    expect(src).toContain('onRedirectToExercise');
    expect(src).not.toContain("navigate('/activity/start'");
  });
});
