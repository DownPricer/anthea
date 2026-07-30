const fs = require('fs');
const path = require('path');

const LEGACY_API_HOST = 'https://anthea.sitereadyshd.fr';

describe('api client same-origin configuration', () => {
  const apiSrc = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
  const checkpointSrc = fs.readFileSync(
    path.join(__dirname, 'activities', 'activityCheckpoint.js'),
    'utf8'
  );

  test('axios uses resolveApiBaseUrl with withCredentials', () => {
    expect(apiSrc).toMatch(/baseURL:\s*resolveApiBaseUrl\(\)/);
    expect(apiSrc).toMatch(/withCredentials:\s*true/);
  });

  test('login endpoint path is /auth/login (base /api)', () => {
    expect(apiSrc).toMatch(/login:\s*\([^)]*\)\s*=>\s*api\.post\('\/auth\/login'/);
  });

  test('auth/me endpoint path is /auth/me (base /api)', () => {
    expect(apiSrc).toMatch(/me:\s*\(\)\s*=>\s*api\.get\('\/auth\/me'/);
  });

  test('no legacy anthea API host in api.js', () => {
    expect(apiSrc).not.toContain(LEGACY_API_HOST);
  });

  test('activity checkpoint uses resolveApiBaseUrl, not legacy host', () => {
    expect(checkpointSrc).toMatch(/resolveApiBaseUrl\(\)/);
    expect(checkpointSrc).not.toContain(LEGACY_API_HOST);
    expect(checkpointSrc).toMatch(/credentials:\s*'include'/);
  });

  test('IndexedDB fitgather_activities store is preserved', () => {
    const storeSrc = fs.readFileSync(
      path.join(__dirname, 'activities', 'activityStore.js'),
      'utf8'
    );
    expect(storeSrc).toContain("DB_NAME = 'fitgather_activities'");
  });
});
