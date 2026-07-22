import fs from 'fs';
import path from 'path';

describe('WorkoutPlayerPage mobile GIF layout', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'WorkoutPlayerPage.jsx'),
    'utf8'
  );

  it('keeps the exercise stage within the viewport width', () => {
    expect(source).toContain('player-exercise-stage');
    expect(source).toMatch(
      /player-exercise-stage[\s\S]*?w-full max-w-full min-w-0/
    );
    expect(source).toContain('overflow-hidden');
  });

  it('compacts the animated GIF on mobile without removing it', () => {
    expect(source).toContain('player-exercise-gif');
    expect(source).toContain('max-w-[200px]');
    expect(source).toContain('max-h-[200px]');
    expect(source).toContain('object-contain');
    expect(source).toContain('mx-auto');
    expect(source).toMatch(/md:max-w-sm/);
  });

  it('keeps controls centered and wrappable within the screen', () => {
    expect(source).toContain('player-controls');
    expect(source).toMatch(/player-controls[\s\S]*?flex-wrap/);
    expect(source).toMatch(/min-h-10 min-w-10/);
    expect(source).toContain('pause-btn');
    expect(source).toContain('skip-exercise-btn');
  });

  it('does not change player progression mechanics', () => {
    expect(source).toContain('completeCurrentExercise');
    expect(source).toContain('skipCurrentExercise');
    expect(source).toContain('addTime(15)');
    expect(source).toContain('duoLive');
  });
});
