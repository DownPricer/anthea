import { computeValidFeaturedBadgeIds, toggleFeaturedBadgeId } from './featuredBadges';

describe('featured badges (profil perso)', () => {
  test('computeValidFeaturedBadgeIds: filtre par badges débloqués, garde l’ordre, max 3', () => {
    const saved = ['a', 'b', 'c', 'd'];
    const unlocked = [{ id: 'b' }, { id: 'a' }, { id: 'd' }];
    expect(computeValidFeaturedBadgeIds(saved, unlocked, 3)).toEqual(['a', 'b', 'd']);
  });

  test('computeValidFeaturedBadgeIds: accepte vide et ids invalides', () => {
    expect(computeValidFeaturedBadgeIds(null, [], 3)).toEqual([]);
    expect(computeValidFeaturedBadgeIds(['x'], [], 3)).toEqual([]);
  });

  test('toggleFeaturedBadgeId: ajoute, retire, refuse le 4e uniquement au clic', () => {
    let state = [];
    state = toggleFeaturedBadgeId(state, 'a', 3).next;
    state = toggleFeaturedBadgeId(state, 'b', 3).next;
    state = toggleFeaturedBadgeId(state, 'c', 3).next;
    expect(state).toEqual(['a', 'b', 'c']);

    const attempt = toggleFeaturedBadgeId(state, 'd', 3);
    expect(attempt.rejected).toBe(true);
    expect(attempt.next).toEqual(['a', 'b', 'c']);

    state = toggleFeaturedBadgeId(state, 'b', 3).next;
    expect(state).toEqual(['a', 'c']);
  });
});

