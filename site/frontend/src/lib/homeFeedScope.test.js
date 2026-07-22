import { resolveHomeFeedScope, HOME_FEED_TAB_ORDER } from './homeFeedScope';

describe('homeFeedScope', () => {
  it('defaults to global (Monde)', () => {
    expect(resolveHomeFeedScope(null)).toBe('global');
    expect(resolveHomeFeedScope(undefined)).toBe('global');
    expect(resolveHomeFeedScope('')).toBe('global');
    expect(resolveHomeFeedScope('global')).toBe('global');
  });

  it('keeps following when explicitly selected', () => {
    expect(resolveHomeFeedScope('following')).toBe('following');
  });

  it('orders World then Following', () => {
    expect(HOME_FEED_TAB_ORDER).toEqual(['global', 'following']);
  });
});
