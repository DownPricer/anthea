import { badgeNotificationDeepLink, isBadgeUnlockNotification } from './badgeNotificationLink';

describe('badgeNotificationDeepLink', () => {
  test('solo badge opens exact badge sheet route', () => {
    expect(
      badgeNotificationDeepLink({
        type: 'badge_unlocked',
        badge_id: 'solo_first_workout',
        scope: 'solo',
      })
    ).toBe('/badges?scope=solo&badge=solo_first_workout');
  });

  test('duo badge opens duo scope', () => {
    expect(
      badgeNotificationDeepLink({
        type: 'duo_badge_unlocked',
        badge_id: 'duo_first_common_workout',
        scope: 'duo',
      })
    ).toBe('/badges?scope=duo&badge=duo_first_common_workout');
  });

  test('legacy without badge_id opens catalog', () => {
    expect(badgeNotificationDeepLink({ type: 'badge_unlocked' })).toBe('/badges?scope=solo');
  });

  test('prefers url already containing badge=', () => {
    expect(
      badgeNotificationDeepLink({
        type: 'badge_unlocked',
        badge_id: 'solo_first_workout',
        url: '/badges?scope=solo&badge=solo_ten_workouts',
      })
    ).toBe('/badges?scope=solo&badge=solo_ten_workouts');
  });
});

describe('isBadgeUnlockNotification', () => {
  test('recognizes badge types', () => {
    expect(isBadgeUnlockNotification('badge_unlocked')).toBe(true);
    expect(isBadgeUnlockNotification('duo_badge_unlocked')).toBe(true);
    expect(isBadgeUnlockNotification('follow_request')).toBe(false);
  });
});
