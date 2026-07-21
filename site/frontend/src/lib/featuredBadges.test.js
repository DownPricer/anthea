import {
  normalizeFeaturedBadgeIds,
  toggleFeaturedBadgeId,
  filterSelectableSoloBadges,
  getBadgeDisplayName,
} from './featuredBadges';

const unlockedSolo = [
  { id: 'solo_streak_three', unlocked: true, scope: 'solo', enabled: true, name: 'Trois jours' },
  { id: 'solo_five_workouts', unlocked: true, scope: 'solo', enabled: true, name: 'Cinq séances' },
  { id: 'solo_ten_workouts', unlocked: true, scope: 'solo', enabled: true, name: 'Dix séances' },
  { id: 'duo_first_common_workout', unlocked: true, scope: 'duo', enabled: true, name: 'Duo' },
  { id: 'solo_disabled', unlocked: true, scope: 'solo', enabled: false, name: 'Disabled' },
  { id: 'solo_locked', unlocked: false, scope: 'solo', enabled: true, name: 'Locked' },
];

describe('featured badges (profil perso)', () => {
  test('normalizeFeaturedBadgeIds: conversion legacy, ordre, max 3', () => {
    const saved = ['streak_3', 'vol_5', 'vol_10', 'vol_25'];
    expect(normalizeFeaturedBadgeIds(saved, unlockedSolo, { max: 3 })).toEqual([
      'solo_streak_three',
      'solo_five_workouts',
      'solo_ten_workouts',
    ]);
  });

  test('normalizeFeaturedBadgeIds: liste vide ok', () => {
    expect(normalizeFeaturedBadgeIds(null, unlockedSolo, { max: 3 })).toEqual([]);
    expect(normalizeFeaturedBadgeIds([], unlockedSolo, { max: 3 })).toEqual([]);
  });

  test('normalizeFeaturedBadgeIds: rejette duo, locked, unknown, disabled', () => {
    expect(
      normalizeFeaturedBadgeIds(
        ['duo_first_common_workout', 'solo_locked', 'solo_disabled', 'unknown_x'],
        unlockedSolo,
        { max: 3 }
      )
    ).toEqual([]);
  });

  test('normalizeFeaturedBadgeIds: déduplique après conversion legacy', () => {
    expect(normalizeFeaturedBadgeIds(['streak_3', 'solo_streak_three'], unlockedSolo)).toEqual([
      'solo_streak_three',
    ]);
  });

  test('filterSelectableSoloBadges: solo unlocked enabled uniquement', () => {
    const selectable = filterSelectableSoloBadges(unlockedSolo);
    expect(selectable.map((b) => b.id)).toEqual([
      'solo_streak_three',
      'solo_five_workouts',
      'solo_ten_workouts',
    ]);
  });

  test('toggleFeaturedBadgeId: ajoute, retire, refuse le 4e', () => {
    let state = [];
    state = toggleFeaturedBadgeId(state, 'solo_streak_three', 3).next;
    state = toggleFeaturedBadgeId(state, 'solo_five_workouts', 3).next;
    state = toggleFeaturedBadgeId(state, 'solo_ten_workouts', 3).next;
    expect(state).toEqual(['solo_streak_three', 'solo_five_workouts', 'solo_ten_workouts']);

    const attempt = toggleFeaturedBadgeId(state, 'solo_twenty_five_workouts', 3);
    expect(attempt.rejected).toBe(true);
    expect(attempt.next).toEqual(state);

    state = toggleFeaturedBadgeId(state, 'solo_five_workouts', 3).next;
    expect(state).toEqual(['solo_streak_three', 'solo_ten_workouts']);
  });

  test('getBadgeDisplayName: fallback sur badge.name', () => {
    const t = (key, opts) => (opts?.defaultValue ?? '');
    expect(getBadgeDisplayName({ id: 'solo_streak_three', name: 'Trois jours' }, t)).toBe('Trois jours');
  });
});
