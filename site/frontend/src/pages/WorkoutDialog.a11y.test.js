/**
 * Accessibilité DialogContent — dialogue Ajouter un exercice
 */
import fs from 'fs';
import path from 'path';

describe('CreateWorkoutPage dialog a11y (source)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, 'CreateWorkoutPage.jsx'),
    'utf8',
  );

  test('exercise dialog has DialogDescription', () => {
    expect(src).toContain('DialogDescription');
    expect(src).toContain('chooseExerciseDescription');
    expect(src).toContain('sr-only');
  });
});

describe('TrackedActivity conflict dialog removed (source)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../components/player/TrackedActivityInPlayer.jsx'),
    'utf8',
  );

  test('no conflict dialog UI remains', () => {
    expect(src).not.toContain('tracked-conflict-resume');
    expect(src).not.toContain('DialogDescription');
    expect(src).toContain('redirectIfOtherExercise');
  });
});
