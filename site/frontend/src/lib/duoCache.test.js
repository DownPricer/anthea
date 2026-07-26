import {
  fetchDuoCached,
  dedupeInflight,
  getDuoCache,
  setDuoCache,
  invalidateDuoCache,
  duoCacheKey,
} from './duoCache';

describe('duoCache in-flight dedupe', () => {
  beforeEach(() => {
    invalidateDuoCache();
  });

  test('fetchDuoCached dedupes parallel fetches for the same key', async () => {
    let calls = 0;
    const key = duoCacheKey('stats', 'user-a');
    const fetcher = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return { ok: true, calls };
    };

    const [a, b] = await Promise.all([
      fetchDuoCached(key, fetcher, 60_000),
      fetchDuoCached(key, fetcher, 60_000),
    ]);

    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(getDuoCache(key)).toEqual(a);
  });

  test('fetchDuoCached returns cached value without refetch', async () => {
    const key = duoCacheKey('detailedStats', 'u1', 'all');
    setDuoCache(key, { summary: { total: 1 } }, 60_000);
    let calls = 0;
    const data = await fetchDuoCached(
      key,
      async () => {
        calls += 1;
        return { summary: { total: 2 } };
      },
      60_000,
    );
    expect(calls).toBe(0);
    expect(data.summary.total).toBe(1);
  });

  test('dedupeInflight always refreshes but shares one network call', async () => {
    let calls = 0;
    const key = duoCacheKey('stats', 'boot');
    setDuoCache(key, { stale: true }, 60_000);
    const fetcher = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { fresh: true };
    };
    const [a, b] = await Promise.all([
      dedupeInflight(key, fetcher),
      dedupeInflight(key, fetcher),
    ]);
    expect(calls).toBe(1);
    expect(a.fresh).toBe(true);
    expect(b.fresh).toBe(true);
  });
});
