import fs from 'fs';
import path from 'path';

describe('PostCard workout exercise summaries', () => {
  const source = fs.readFileSync(path.join(__dirname, 'PostCard.jsx'), 'utf8');

  test('renders exercise summaries when session details visible', () => {
    expect(source).toContain('workout-exercise-summaries');
    expect(source).toContain('formatExerciseSummaryMetrics');
    expect(source).toContain('getExerciseSummaryDisplayName');
    expect(source).toContain('can_view_session_details');
  });

  test('does not render GPS coordinates', () => {
    expect(source).not.toMatch(/exercise_summaries[\s\S]{0,200}coordinates/);
    expect(source).not.toContain('simplified_route');
  });
});
