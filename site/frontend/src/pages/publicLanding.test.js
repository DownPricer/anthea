/**
 * Tests landing publique / partage / next path (source-scan + unit).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('public landing routing', () => {
  test('App mounts AuthHomeSwitch and /post/:postId publicly', () => {
    const src = read('App.js');
    expect(src).toContain('AuthHomeSwitch');
    expect(src).toContain('PublicPostPage');
    expect(src).toContain('path="/post/:postId"');
    expect(src).toContain('<AuthHomeSwitch>');
    expect(src).toContain('<AppLayout />');
  });

  test('AuthHomeSwitch shows PublicLandingPage when anonymous on /', () => {
    const src = read('components/layout/AuthHomeSwitch.jsx');
    expect(src).toContain('PublicLandingPage');
    expect(src).toContain('auth-home-skeleton');
    expect(src).toContain('isExactHome');
  });

  test('PublicLandingPage does not mount HomePage private hooks', () => {
    const src = read('pages/PublicLandingPage.jsx');
    expect(src).toContain('publicFeedApi.getTrending');
    expect(src).not.toContain('workoutsApi');
    expect(src).not.toContain('notificationsApi');
    expect(src).not.toContain('partnerApi');
    expect(src).not.toContain('HomeFeed');
    expect(src).not.toContain('usePartnerLiveSession');
  });
});

describe('public marketing config', () => {
  const {
    COMMUNITY_MEMBER_COUNT,
    formatCommunityMemberCount,
    buildPublicPostUrl,
    PUBLIC_SITE_ORIGIN,
  } = require('../lib/publicMarketingConfig');

  test('community count is centralized and positive', () => {
    expect(COMMUNITY_MEMBER_COUNT).toBeGreaterThan(0);
    expect(PUBLIC_SITE_ORIGIN).toBe('https://fitgather.fr');
  });

  test('formats FR / EN / ES without duplicating raw count in components', () => {
    const fr = formatCommunityMemberCount('fr-FR');
    const en = formatCommunityMemberCount('en-US');
    const es = formatCommunityMemberCount('es-ES');
    expect(fr.replace(/\s/g, ' ')).toMatch(/5 ?000/);
    expect(en).toBe('5,000');
    expect(String(es).replace(/\./g, '').replace(/\s/g, '')).toContain('5000');
    const landing = read('pages/PublicLandingPage.jsx');
    expect(landing).toContain('formatCommunityMemberCount');
    expect(landing).not.toMatch(/\b5000\b/);
  });

  test('canonical post URL uses fitgather.fr never legacy host', () => {
    const url = buildPublicPostUrl('abc123');
    expect(url).toBe('https://fitgather.fr/post/abc123');
    expect(url).not.toContain('anthea.sitereadyshd.fr');
  });
});

describe('safe next path', () => {
  const { sanitizeNextPath, withNextParam, readNextFromSearch } = require('../lib/safeNextPath');

  test('allows internal paths', () => {
    expect(sanitizeNextPath('/post/xyz')).toBe('/post/xyz');
    expect(sanitizeNextPath('/profile/alice')).toBe('/profile/alice');
  });

  test('blocks external redirects', () => {
    expect(sanitizeNextPath('https://evil.com')).toBe('/');
    expect(sanitizeNextPath('//evil.com')).toBe('/');
    expect(sanitizeNextPath('http://fitgather.fr/post/1')).toBe('/');
    expect(sanitizeNextPath('\\evil')).toBe('/');
  });

  test('withNextParam and readNextFromSearch', () => {
    expect(withNextParam('/login', '/post/1')).toBe('/login?next=%2Fpost%2F1');
    expect(readNextFromSearch('?next=%2Fpost%2F1')).toBe('/post/1');
    expect(readNextFromSearch('?next=https://evil.com')).toBe(null);
    expect(sanitizeNextPath(readNextFromSearch('?next=https://evil.com') || '/', '/')).toBe('/');
  });
});

describe('share public post', () => {
  test('share helper targets fitgather.fr', () => {
    const src = read('lib/sharePublicPost.js');
    expect(src).toContain('buildPublicPostUrl');
    expect(src).toContain('navigator.share');
    expect(src).toContain('clipboard.writeText');
    expect(src).not.toContain('anthea.sitereadyshd.fr');
  });

  test('PostCard share button uses sharePublicPost', () => {
    const src = read('components/social/PostCard.jsx');
    expect(src).toContain('sharePublicPost');
    expect(src).toContain('post-share-button');
  });
});

describe('public post page & join modal', () => {
  test('PublicPostPage handles locked / unavailable / share', () => {
    const src = read('pages/PublicPostPage.jsx');
    expect(src).toContain('publicPostsApi.getOne');
    expect(src).toContain('public-post-locked');
    expect(src).toContain('public-post-unavailable');
    expect(src).toContain('sharePublicPost');
    expect(src).toContain('JoinFitGatherModal');
  });

  test('PublicPostCard like/comment open join modal without API like', () => {
    const src = read('components/public/PublicPostCard.jsx');
    expect(src).toContain('onRequireAuth');
    expect(src).not.toContain('postsApi.toggleLike');
    expect(src).not.toContain('postsApi.addComment');
  });

  test('JoinFitGatherModal preserves next', () => {
    const src = read('components/public/JoinFitGatherModal.jsx');
    expect(src).toContain('withNextParam');
    expect(src).toContain('join-fitgather-modal');
  });

  test('trending grid capped at 6', () => {
    const src = read('pages/PublicLandingPage.jsx');
    expect(src).toContain('TRENDING_LIMIT = 6');
    expect(src).toContain('slice(0, TRENDING_LIMIT)');
  });
});

describe('i18n public FR/EN/ES', () => {
  test('public namespace parity keys', () => {
    const fr = require('../i18n/locales/fr/public.json');
    const en = require('../i18n/locales/en/public.json');
    const es = require('../i18n/locales/es/public.json');
    expect(fr.hero.title).toBeTruthy();
    expect(en.hero.title).toBeTruthy();
    expect(es.hero.title).toBeTruthy();
    expect(Object.keys(fr.hero).sort()).toEqual(Object.keys(en.hero).sort());
    expect(Object.keys(fr.hero).sort()).toEqual(Object.keys(es.hero).sort());
  });
});

describe('no legacy public URL in public sources', () => {
  test('public landing and share sources exclude anthea.sitereadyshd.fr', () => {
    const files = [
      'pages/PublicLandingPage.jsx',
      'pages/PublicPostPage.jsx',
      'lib/publicMarketingConfig.js',
      'lib/sharePublicPost.js',
      'components/public/PublicPostCard.jsx',
    ];
    files.forEach((f) => {
      expect(read(f).toLowerCase()).not.toContain('anthea.sitereadyshd.fr');
    });
  });
});

describe('login next sanitization', () => {
  test('LoginPage uses sanitizeNextPath', () => {
    const src = read('pages/LoginPage.jsx');
    expect(src).toContain('sanitizeNextPath');
    expect(src).toContain('readNextFromSearch');
  });
});

describe('ActivityBootRecovery skips anonymous', () => {
  test('does not call activities API when no user', () => {
    const src = read('components/activities/ActivityBootRecovery.jsx');
    expect(src).toContain('if (!user) return');
    expect(src).toContain('useAuth');
  });
});
