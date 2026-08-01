import {
  __clearHomeCacheForTests,
  fetchHomeWeekCached,
  homeCacheKey,
  HOME_STALE,
} from './homeCache';

describe('homeCache week SWR', () => {
  beforeEach(() => {
    __clearHomeCacheForTests();
  });

  test('dedupes simultaneous fetches for the same week key', async () => {
    const fetcher = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { '2026-08-03': { my_completed: true } };
    });

    const p1 = fetchHomeWeekCached('user1', '2026-08-03', '2026-08-09', fetcher);
    const p2 = fetchHomeWeekCached('user1', '2026-08-03', '2026-08-09', fetcher);
    const [a, b] = await Promise.all([p1, p2]);

    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('returns stale data immediately while revalidating', async () => {
    jest.useFakeTimers();
    const base = new Date('2026-08-01T12:00:00Z').getTime();
    jest.setSystemTime(base);

    await fetchHomeWeekCached('user1', '2026-08-03', '2026-08-09', async () => ({ v: 1 }));

    jest.setSystemTime(base + HOME_STALE.week + 5000);
    const fetcher = jest.fn(async () => ({ v: 2 }));
    const result = await fetchHomeWeekCached('user1', '2026-08-03', '2026-08-09', fetcher);

    expect(result).toEqual({ v: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    jest.useRealTimers();
  });

  test('cache keys include user id', () => {
    const k1 = homeCacheKey('week', 'user-a', '2026-08-03', '2026-08-09');
    const k2 = homeCacheKey('week', 'user-b', '2026-08-03', '2026-08-09');
    expect(k1).not.toBe(k2);
  });
});
