const fs = require('fs');
const path = require('path');

describe('service worker bundle refresh', () => {
  const swSrc = fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8');

  test('defines a new cache version for network-only auth', () => {
    expect(swSrc).toMatch(/SW_CACHE_VERSION\s*=\s*'fitgather-v3-auth-network-only'/);
  });

  test('clears legacy fitgather-* caches on activate without touching IndexedDB', () => {
    expect(swSrc).toMatch(/key\.startsWith\('fitgather-'\)/);
    expect(swSrc).not.toMatch(/indexedDB|fitgather_activities/i);
  });

  test('all /api/auth/* requests bypass caches and use the network', () => {
    expect(swSrc).toContain("AUTH_NETWORK_ONLY_PREFIX = '/api/auth/'");
    expect(swSrc).toContain("url.pathname.startsWith(AUTH_NETWORK_ONLY_PREFIX)");
    expect(swSrc).toContain("fetch(event.request, { cache: 'no-store' })");
    expect(swSrc).not.toMatch(/caches\.match[^]*AUTH_NETWORK_ONLY_PREFIX/);
  });
});
