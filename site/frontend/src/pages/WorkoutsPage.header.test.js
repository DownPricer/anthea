import fs from 'fs';
import path from 'path';

describe('WorkoutsPage Mes séances header', () => {
  const source = fs.readFileSync(path.join(__dirname, 'WorkoutsPage.jsx'), 'utf8');

  test('keeps Nouvelle button and navigates to create', () => {
    expect(source).toContain("t('workouts:new')");
    expect(source).toContain("navigate('/create')");
    expect(source).toContain('workouts-new-btn');
  });

  test('does not render long subtitle in header', () => {
    expect(source).not.toMatch(/PageHeader[\s\S]*subtitle=\{t\('workouts:subtitle'\)\}/);
  });

  test('does not show Démarrer une activité in Mes séances header', () => {
    expect(source).not.toContain("navigate('/activity/start')");
    expect(source).not.toContain('activity:start.title');
  });
});
