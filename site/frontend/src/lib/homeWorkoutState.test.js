import {
  getPrimaryWorkoutAction,
  shouldShowEmptyTodayCard,
  getCompletedTodayWorkouts,
  getWorkoutListSubtitle,
} from './homeWorkoutState';

describe('homeWorkoutState', () => {
  const userId = 'user-1';
  const t = (key) => {
    const map = {
      'home:pausedPlayer': 'En pause',
      'home:flexible': 'Flexible',
      'workouts:status.completed': 'Terminée',
    };
    return map[key] || key;
  };

  test('returns in_progress workout first', () => {
    const workouts = [
      { id: '1', for_user_id: userId, status: 'pending', title: 'A' },
      { id: '2', for_user_id: userId, status: 'in_progress', title: 'B' },
    ];
    const action = getPrimaryWorkoutAction(workouts, userId);
    expect(action.workout.id).toBe('2');
    expect(action.resume).toBe(true);
  });

  test('returns first pending when no in_progress', () => {
    const workouts = [
      { id: '1', for_user_id: userId, status: 'completed', title: 'Done' },
      { id: '2', for_user_id: userId, status: 'pending', title: 'Next' },
    ];
    const action = getPrimaryWorkoutAction(workouts, userId);
    expect(action.workout.id).toBe('2');
    expect(action.resume).toBe(false);
  });

  test('returns null when only completed workouts remain', () => {
    const workouts = [{ id: '1', for_user_id: userId, status: 'completed', title: 'Done' }];
    expect(getPrimaryWorkoutAction(workouts, userId)).toBeNull();
  });

  test('shouldShowEmptyTodayCard only when no workouts', () => {
    expect(shouldShowEmptyTodayCard([])).toBe(true);
    expect(shouldShowEmptyTodayCard([{ status: 'completed' }])).toBe(false);
    expect(shouldShowEmptyTodayCard([{ status: 'pending' }])).toBe(false);
  });

  test('completed subtitle replaces flexible label', () => {
    const subtitle = getWorkoutListSubtitle(
      { status: 'completed', for_user_id: userId },
      userId,
      t,
    );
    expect(subtitle).toBe('Terminée');
    expect(subtitle).not.toBe('Flexible');
  });

  test('flexible label for pending without scheduled_time', () => {
    const subtitle = getWorkoutListSubtitle(
      { status: 'pending', for_user_id: userId },
      userId,
      t,
    );
    expect(subtitle).toBe('Flexible');
  });

  test('getCompletedTodayWorkouts filters completed only', () => {
    const workouts = [
      { status: 'completed' },
      { status: 'pending' },
      { status: 'completed' },
    ];
    expect(getCompletedTodayWorkouts(workouts)).toHaveLength(2);
  });
});
