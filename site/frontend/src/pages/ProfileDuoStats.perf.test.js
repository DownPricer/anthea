import fs from 'fs';
import path from 'path';

describe('ProfilePage stats loading', () => {
  const source = fs.readFileSync(path.join(__dirname, 'ProfilePage.jsx'), 'utf8');

  test('does not call getStats twice on boot', () => {
    expect(source).toContain('fetchDuoCached');
    expect(source).toContain('Promise.allSettled');
    const getStatsMatches = source.match(/duoApi\.getStats/g) || [];
    expect(getStatsMatches.length).toBeLessThanOrEqual(1);
  });

  test('uses duo cache TTL and invalidates narrowly on save', () => {
    expect(source).toContain('DUO_STALE');
    expect(source).toContain('invalidateDuoDomain');
    expect(source).toContain("loadStats({ force: true })");
  });
});

describe('ProfileStatsTab loading UX', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/profile/ProfileStatsTab.jsx'),
    'utf8',
  );

  test('uses local skeletons instead of full-screen spinner', () => {
    expect(source).toContain('profile-stats-skeletons');
    expect(source).not.toMatch(/Loader2[\s\S]*min-h-screen/);
    expect(source).not.toContain('Loader2');
  });
});

describe('DuoPage / SoloDashboard no GPS routes in stats', () => {
  const duoSrc = fs.readFileSync(path.join(__dirname, 'DuoPage.jsx'), 'utf8');
  const soloSrc = fs.readFileSync(
    path.join(__dirname, '../components/duo/SoloDashboard.jsx'),
    'utf8',
  );

  test('Duo uses dedupeInflight for stats dedupe', () => {
    expect(duoSrc).toContain('dedupeInflight');
  });

  test('SoloDashboard reuses detailed stats cache', () => {
    expect(soloSrc).toContain('fetchDuoCached');
    expect(soloSrc).toContain("duoCacheKey('detailedStats'");
  });

  test('no activity route chunk fetches', () => {
    expect(duoSrc).not.toMatch(/include_route|route_chunks|getActivity\(/);
    expect(soloSrc).not.toMatch(/include_route|route_chunks/);
  });
});
