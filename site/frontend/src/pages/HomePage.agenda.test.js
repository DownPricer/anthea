import fs from 'fs';
import path from 'path';

describe('HomePage day navigation', () => {
  const source = fs.readFileSync(path.join(__dirname, 'HomePage.jsx'), 'utf8');

  it('uses read-only day panel instead of streak modal', () => {
    expect(source).toContain('home-day-readonly-panel');
    expect(source).toContain('getDayRelation');
    expect(source).toContain('getWorkoutsForDate');
    expect(source).not.toContain('showStreakModal');
    expect(source).not.toContain('mark-rest-day-btn');
    expect(source).not.toContain('mark-skip-day-btn');
  });

  it('keeps active today experience separate from other days', () => {
    expect(source).toContain('viewingToday');
    expect(source).toContain('setViewDay');
  });
});
