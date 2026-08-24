import {
  fetchBadgesCached,
  getBadgesCache,
  invalidateBadgesCache,
  setBadgesCache,
} from './badgesCache';

describe('badgesCache', () => {
  beforeEach(() => {
    invalidateBadgesCache();
  });

  test('returns cached data without refetching', async () => {
    setBadgesCache('solo', { badges: [{ id: 'b1' }], summary: { total: 1 } });
    let calls = 0;
    const data = await fetchBadgesCached('solo', async () => {
      calls += 1;
      return { badges: [{ id: 'b2' }] };
    });
    expect(calls).toBe(0);
    expect(data.badges[0].id).toBe('b1');
    expect(getBadgesCache('solo')?.badges[0].id).toBe('b1');
  });
});
