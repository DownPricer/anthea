import { filterDuoHistoryFeed, getHistoryItemKey } from './duoHistory';

describe('duoHistory', () => {
  const userId = 'user-a';
  const partnerId = 'user-b';

  const commonSession = {
    type: 'common_session',
    date: '2026-01-10',
    created_at: '2026-01-10T12:00:00Z',
    session_a: { id: 'sa', user_id: userId },
    session_b: { id: 'sb', user_id: partnerId },
  };

  const mySession = {
    type: 'session',
    id: 'mine-1',
    user_id: userId,
    created_at: '2026-01-09T10:00:00Z',
  };

  const partnerSession = {
    type: 'session',
    id: 'partner-1',
    user_id: partnerId,
    created_at: '2026-01-08T10:00:00Z',
  };

  const feed = [commonSession, mySession, partnerSession];

  test('filters mine with common sessions', () => {
    const result = filterDuoHistoryFeed(feed, 'mine', userId, partnerId);
    expect(result).toHaveLength(2);
    expect(result.some((item) => item.type === 'common_session')).toBe(true);
    expect(result.some((item) => item.id === 'mine-1')).toBe(true);
  });

  test('filters partner with common sessions', () => {
    const result = filterDuoHistoryFeed(feed, 'partner', userId, partnerId);
    expect(result).toHaveLength(2);
    expect(result.some((item) => item.id === 'partner-1')).toBe(true);
  });

  test('deduplicates identical common session from multiple sources', () => {
    const duplicateFeed = [...feed, { ...commonSession }];
    const result = filterDuoHistoryFeed(duplicateFeed, 'all', userId, partnerId);
    const keys = result.map(getHistoryItemKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(result).toHaveLength(3);
    expect(getHistoryItemKey(commonSession)).toBe('common:sa:sb');
  });

  test('keeps two common sessions on the same day when session ids differ', () => {
    const commonSameDayA = {
      type: 'common_session',
      date: '2026-01-10',
      created_at: '2026-01-10T08:00:00Z',
      session_a: { id: 'sa-morning', user_id: userId },
      session_b: { id: 'sb-morning', user_id: partnerId },
    };
    const commonSameDayB = {
      type: 'common_session',
      date: '2026-01-10',
      created_at: '2026-01-10T20:00:00Z',
      session_a: { id: 'sa-evening', user_id: userId },
      session_b: { id: 'sb-evening', user_id: partnerId },
    };
    const result = filterDuoHistoryFeed(
      [commonSameDayA, commonSameDayB],
      'all',
      userId,
      partnerId,
    );
    expect(result).toHaveLength(2);
    expect(getHistoryItemKey(commonSameDayA)).not.toBe(getHistoryItemKey(commonSameDayB));
  });
});
