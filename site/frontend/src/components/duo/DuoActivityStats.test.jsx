import fs from 'fs';
import path from 'path';

describe('Duo activity / statistics reorganization', () => {
  const duoPage = fs.readFileSync(
    path.join(__dirname, '../../pages/DuoPage.jsx'),
    'utf8'
  );
  const activityStart = duoPage.indexOf('duo-activity-tab');
  const historyStart = duoPage.indexOf('duo-history-tab');
  const activityBlock = duoPage.slice(activityStart, historyStart);
  const fr = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../i18n/locales/fr/duo.json'), 'utf8')
  );
  const en = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../i18n/locales/en/duo.json'), 'utf8')
  );
  const es = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../i18n/locales/es/duo.json'), 'utf8')
  );

  it('does not render activity-bottom stats cards', () => {
    expect(activityBlock).toContain('duo-activity-tab');
    expect(activityBlock).not.toContain('statsCards.streak');
    expect(activityBlock).not.toContain('statsCards.together');
    expect(activityBlock).not.toContain('this_week_partner');
    expect(activityBlock).not.toContain('DuoStatsCardsSkeleton');
  });

  it('shows enriched statistics in the stats tab', () => {
    expect(duoPage).toContain('duo-stats-scope-duo');
    expect(duoPage).toContain('duo-stats-scope-member');
    expect(duoPage).toContain('stat-duo-streak-current');
    expect(duoPage).toContain('stat-duo-streak-best');
    expect(duoPage).toContain('stat-member-streak-current');
    expect(duoPage).toContain('stat-member-streak-best');
    expect(duoPage).toContain('DuoCompactStatCard');
  });

  it('uses loading placeholder instead of forcing zero', () => {
    expect(duoPage).toMatch(/loading=\{statsBootLoading && !duoStats\}/);
    const card = fs.readFileSync(
      path.join(__dirname, 'DuoCompactStatCard.jsx'),
      'utf8'
    );
    expect(card).toContain("'—'");
    expect(card).toMatch(/loading \|\| value === null/);
  });

  it('localizes new streak / active-day keys in FR EN ES', () => {
    const keys = [
      'currentDuoStreak',
      'bestDuoStreak',
      'personalCurrentStreak',
      'personalBestStreak',
      'partnerCurrentStreak',
      'partnerBestStreak',
      'activeDays',
      'lastSharedWorkout',
    ];
    for (const key of keys) {
      expect(fr.statsCards[key]).toBeTruthy();
      expect(en.statsCards[key]).toBeTruthy();
      expect(es.statsCards[key]).toBeTruthy();
      expect(fr.statsCards[key]).not.toMatch(/^duo:/);
      expect(en.statsCards[key]).not.toMatch(/^duo:/);
    }
    expect(en.statsCards.currentDuoStreak).toBe('Current duo streak');
    expect(en.statsCards.bestDuoStreak).toBe('Best duo streak');
    expect(en.statsCards.lastSharedWorkout).toBe('Last shared workout');
    expect(fr.statsCards.currentDuoStreak).toMatch(/Streak Duo/i);
    expect(es.statsCards.activeDays).toMatch(/Días activos/i);
  });
});
