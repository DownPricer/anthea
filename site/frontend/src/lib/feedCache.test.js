import { isPostNew, markFeedSeenNow, getFeedLastSeenAt, getFeedCache, setFeedCache, invalidateFeedCache } from './feedCache';

describe('feedCache', () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateFeedCache();
  });

  it('badge Nouveau selon last_seen sans retirer du fil', () => {
    markFeedSeenNow();
    const lastSeen = getFeedLastSeenAt();
    const oldPost = { id: '1', created_at: '2020-01-01T00:00:00.000Z' };
    const newPost = { id: '2', created_at: '2099-01-01T00:00:00.000Z' };
    expect(isPostNew(oldPost)).toBe(false);
    expect(isPostNew(newPost)).toBe(true);
    expect(lastSeen).toBeTruthy();
  });

  it('caches following/global séparés', () => {
    setFeedCache('following', { posts: [{ id: 'a' }], cursor: 'c1' });
    setFeedCache('global', { posts: [{ id: 'b' }], cursor: 'c2' });
    expect(getFeedCache('following').posts[0].id).toBe('a');
    expect(getFeedCache('global').posts[0].id).toBe('b');
    invalidateFeedCache();
    expect(getFeedCache('following').posts).toEqual([]);
    expect(getFeedCache('global').posts).toEqual([]);
  });
});