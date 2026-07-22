import fs from 'fs';
import path from 'path';

describe('LiveWorkoutReactions', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'LiveWorkoutReactions.jsx'),
    'utf8'
  );

  it('exposes ephemeral reaction emojis', () => {
    expect(source).toContain('🔥');
    expect(source).toContain('❤️');
    expect(source).toContain('👏');
    expect(source).toContain('💪');
  });

  it('rate-limits sends around 300ms', () => {
    expect(source).toContain('SEND_COOLDOWN_MS = 300');
  });

  it('respects prefers-reduced-motion', () => {
    expect(source).toContain('prefers-reduced-motion');
  });
});

describe('WorkoutPlayerPage live UI', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../pages/WorkoutPlayerPage.jsx'),
    'utf8'
  );

  it('does not mount live chat', () => {
    expect(source).not.toContain('LiveWorkoutChat');
    expect(source).not.toContain('openChat');
  });

  it('shows dual progress bars and reactions', () => {
    expect(source).toContain('LiveWorkoutReactions');
    expect(source).toContain('duo-live-progress');
    expect(source).toContain('myProgress');
  });

  it('uses 60s heartbeat and 12s partner detection', () => {
    expect(source).toContain('60000');
    expect(source).toContain('12000');
  });
});
