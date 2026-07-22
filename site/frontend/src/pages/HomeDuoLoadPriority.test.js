import fs from 'fs';
import path from 'path';

describe('HomePage weekly load priority', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'HomePage.jsx'),
    'utf8'
  );

  it('prioritizes today and week before secondary partner/request data', () => {
    expect(source).toContain('getToday()');
    expect(source).toContain('getCalendar');
    expect(source).toContain('Promise.allSettled([todayPromise, weekPromise])');
    expect(source).toContain('scheduleNonBlocking');
    const weekIdx = source.indexOf('weekPromise');
    const secondaryIdx = source.indexOf('partnerApi.getInfo()');
    expect(weekIdx).toBeGreaterThan(-1);
    expect(secondaryIdx).toBeGreaterThan(weekIdx);
  });

  it('uses a short memory cache for week data and shows it immediately', () => {
    expect(source).toContain("from '../lib/homeCache'");
    expect(source).toContain('getHomeCache');
    expect(source).toContain('setHomeCache');
    expect(source).toContain('HOME_STALE.week');
    expect(source).toMatch(/if \(cachedWeek\)[\s\S]*setWeekLoading\(false\)/);
  });

  it('keeps skeleton only in the Cette semaine section', () => {
    expect(source).toMatch(/weekLoading \?[\s\S]*animate-pulse/);
    expect(source).not.toMatch(/if \(loading\)[\s\S]*min-h-screen[\s\S]*Loader2/);
  });

  it('does not wait on badges before loading the week', () => {
    expect(source).not.toMatch(/await loadBadges|badgesApi|getBadges/);
  });
});

describe('DuoPage priority boot', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'DuoPage.jsx'),
    'utf8'
  );

  it('loads partner, profile and stats before secondary activity/coach', () => {
    expect(source).toContain(
      'await Promise.allSettled([partnerPromise, profilePromise, statsPromise])'
    );
    expect(source).toContain('scheduleSecondary');
    const priorityIdx = source.indexOf(
      'await Promise.allSettled([partnerPromise, profilePromise, statsPromise])'
    );
    const activityIdx = source.indexOf('getActivityFeed');
    expect(priorityIdx).toBeGreaterThan(-1);
    expect(activityIdx).toBeGreaterThan(priorityIdx);
  });

  it('hydrates duo profile and challenge caches before network refresh', () => {
    expect(source).toContain("duoCacheKey('profile'");
    expect(source).toContain('cachedProfile');
    expect(source).toContain('cachedStats');
    expect(source).toContain('current_challenge');
  });

  it('does not add an extra badges request', () => {
    expect(source).not.toMatch(/badgesApi|getBadges\(/);
  });
});
