import fs from 'fs';
import path from 'path';

describe('WorkoutsPage selected day detail overflow', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'WorkoutsPage.jsx'),
    'utf8'
  );

  it('constrains the selected day detail panel', () => {
    expect(source).toContain('selected-day-detail-panel');
    expect(source).toMatch(
      /selected-day-detail-panel[\s\S]*?w-full max-w-full min-w-0 overflow-hidden/
    );
  });

  it('constrains workout cards and long titles without widening the layout', () => {
    expect(source).toContain('selected-day-workout-title');
    expect(source).toMatch(
      /card p-4 flex[\s\S]*?w-full max-w-full min-w-0 overflow-hidden/
    );
    expect(source).toMatch(
      /selected-day-workout-title[\s\S]*?break-words[\s\S]*?\[overflow-wrap:anywhere\][\s\S]*?line-clamp-2/
    );
    expect(source).not.toMatch(
      /selected-day-workout-title[\s\S]*?whitespace-nowrap/
    );
    expect(source).not.toMatch(
      /selected-day-workout-title[\s\S]*?\bw-max\b/
    );
  });

  it('keeps action buttons shrink-0 so long titles cannot push them off-screen', () => {
    expect(source).toMatch(/MoreVertical[\s\S]*?shrink-0/);
    expect(source).toMatch(/rounded-full px-4 sm:px-5 shrink-0/);
  });

  it('keeps agenda tab locally constrained without global overflow-x-hidden', () => {
    expect(source).toMatch(
      /TabsContent value="agenda"[\s\S]*?w-full max-w-full min-w-0 overflow-hidden/
    );
    expect(source).not.toContain('overflow-x-hidden');
  });

  it('places streak actions in agenda panel only', () => {
    expect(source).toContain('agenda-streak-actions');
    expect(source).toContain('agenda-mark-rest-day-btn');
    expect(source).toContain('getDayRelation');
    expect(source).not.toContain('loadStreakDaysForMonth');
  });
});
