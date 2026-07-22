import fs from 'fs';
import path from 'path';

describe('LiveWorkoutReactions', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'LiveWorkoutReactions.jsx'),
    'utf8'
  );

  it('exposes exactly three ephemeral reaction emojis', () => {
    expect(source).toContain('🔥');
    expect(source).toContain('❤️');
    expect(source).toContain('💪');
    expect(source).not.toMatch(/emoji: '👏'/);
  });

  it('uses a floating FAB bubble with close button', () => {
    expect(source).toContain('fixed z-40');
    expect(source).toContain('bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]');
    expect(source).toContain('reactions.close');
    expect(source).toContain('<X');
  });

  it('rate-limits sends around 300ms', () => {
    expect(source).toContain('SEND_COOLDOWN_MS = 300');
  });

  it('respects prefers-reduced-motion', () => {
    expect(source).toContain('prefers-reduced-motion');
  });

  it('closes on Escape and outside click', () => {
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('mousedown');
  });
});

describe('WorkoutPlayerPage live UI', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../pages/WorkoutPlayerPage.jsx'),
    'utf8'
  );

  it('does not mount live chat or duo card', () => {
    expect(source).not.toContain('LiveWorkoutChat');
    expect(source).not.toContain('openChat');
    expect(source).not.toContain('duo-live-progress');
    expect(source).not.toContain("t('player:duo')");
    expect(source).not.toContain("t('player:myProgress')");
  });

  it('wires yellow top bar to partner and blue bar to self', () => {
    expect(source).toContain('partner-progress-bar');
    expect(source).toContain('my-progress-bar');
    expect(source).toContain('bg-amber-400');
    expect(source).toContain('bg-[var(--theme-primary)]');
    expect(source).toContain('LiveWorkoutReactions');
  });

  it('uses 60s heartbeat and 12s partner detection', () => {
    expect(source).toContain('60000');
    expect(source).toContain('12000');
  });
});
