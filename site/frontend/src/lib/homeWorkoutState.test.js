import { format, addDays, startOfDay } from 'date-fns';
import {
  getPrimaryWorkoutAction,
  shouldShowEmptyTodayCard,
  getCompletedTodayWorkouts,
  getWorkoutListSubtitle,
  getDayRelation,
  getWorkoutsForDate,
} from './homeWorkoutState';

describe('homeWorkoutState day navigation', () => {
  const today = startOfDay(new Date('2026-08-24'));

  test('classifies past, today and future', () => {
    expect(getDayRelation(today, today)).toBe('today');
    expect(getDayRelation(addDays(today, -1), today)).toBe('past');
    expect(getDayRelation(addDays(today, 1), today)).toBe('future');
  });

  test('filters workouts for a given date', () => {
    const rows = [
      { id: 'a', scheduled_date: '2026-08-22', is_draft: false },
      { id: 'b', scheduled_date: '2026-08-24', is_draft: false },
      { id: 'c', scheduled_date: '2026-08-24', is_draft: true },
    ];
    expect(getWorkoutsForDate(rows, today)).toHaveLength(1);
    expect(getWorkoutsForDate(rows, today)[0].id).toBe('b');
  });
});

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
