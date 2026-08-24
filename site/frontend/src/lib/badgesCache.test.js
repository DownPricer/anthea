import {
  fetchBadgesCached,
  getBadgesCache,
  invalidateAllBadgesCache,
  setBadgesCache,
} from './badgesCache';

describe('badgesCache', () => {
  beforeEach(() => {
    invalidateAllBadgesCache();
  });

  test('returns cached data without refetching for same user', async () => {
    const ctx = { scope: 'solo', userId: 'user-a' };
    setBadgesCache(ctx, { badges: [{ id: 'b1' }], summary: { total: 1 } });
    let calls = 0;
    const data = await fetchBadgesCached(ctx, async () => {
      calls += 1;
      return { badges: [{ id: 'b2' }] };
    });
    expect(calls).toBe(0);
    expect(data.badges[0].id).toBe('b1');
    expect(getBadgesCache(ctx)?.badges[0].id).toBe('b1');
  });

  test('isolates solo cache between users QA-A and QA-B', async () => {
    setBadgesCache(
      { scope: 'solo', userId: 'qa-a' },
      { badges: [{ id: 'badge-qa-a' }] },
    );

    let fetchCalls = 0;
    const dataB = await fetchBadgesCached({ scope: 'solo', userId: 'qa-b' }, async () => {
      fetchCalls += 1;
      return { badges: [{ id: 'badge-qa-b' }] };
    });

    expect(fetchCalls).toBe(1);
    expect(dataB.badges[0].id).toBe('badge-qa-b');
    expect(getBadgesCache({ scope: 'solo', userId: 'qa-a' })?.badges[0].id).toBe('badge-qa-a');
    expect(getBadgesCache({ scope: 'solo', userId: 'qa-b' })?.badges[0].id).toBe('badge-qa-b');
  });

  test('scopes duo cache by pairKey and user', async () => {
    const pairKey = '507f1f77bcf86cd799439011_507f191e810c19729de860ea';
    setBadgesCache(
      { scope: 'duo', userId: 'user-a', pairKey },
      { badges: [{ id: 'duo-1' }] },
    );
    expect(getBadgesCache({ scope: 'duo', userId: 'user-a', pairKey })?.badges[0].id).toBe('duo-1');
    expect(getBadgesCache({ scope: 'duo', userId: 'user-b', pairKey })).toBeNull();
    expect(getBadgesCache({ scope: 'solo', userId: 'user-a' })).toBeNull();
  });
});
