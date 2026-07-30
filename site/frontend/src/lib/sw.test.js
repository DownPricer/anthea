const fs = require('fs');
const path = require('path');

describe('service worker bundle refresh', () => {
  const swSrc = fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8');

  test('defines a new cache version for same-origin API rollout', () => {
    expect(swSrc).toMatch(/SW_CACHE_VERSION\s*=\s*'fitgather-v2-same-origin-api'/);
  });

  test('clears legacy fitgather-* caches on activate without touching IndexedDB', () => {
    expect(swSrc).toMatch(/key\.startsWith\('fitgather-'\)/);
    expect(swSrc).not.toMatch(/indexedDB|fitgather_activities/i);
  });
});
