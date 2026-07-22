import {
  getHomeCache,
  setHomeCache,
  homeCacheKey,
  HOME_STALE,
  __clearHomeCacheForTests,
} from './homeCache';

describe('homeCache', () => {
  beforeEach(() => {
    __clearHomeCacheForTests();
  });

  it('stores and returns week data within TTL', () => {
    const key = homeCacheKey('week', '2026-07-20', '2026-07-26');
    setHomeCache(key, { days: [{ date: '2026-07-20' }] }, HOME_STALE.week);
    expect(getHomeCache(key)).toEqual({ days: [{ date: '2026-07-20' }] });
  });

  it('expires stale entries', () => {
    const key = homeCacheKey('week', 'stale');
    setHomeCache(key, { days: [] }, -1);
    expect(getHomeCache(key)).toBeNull();
  });

  it('uses a short TTL for week data (30–60s)', () => {
    expect(HOME_STALE.week).toBeGreaterThanOrEqual(30_000);
    expect(HOME_STALE.week).toBeLessThanOrEqual(60_000);
  });
});
