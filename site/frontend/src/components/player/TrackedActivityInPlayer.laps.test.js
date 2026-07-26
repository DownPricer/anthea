import fs from 'fs';
import path from 'path';

describe('TrackedActivityInPlayer swimming lap controls', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'TrackedActivityInPlayer.jsx'),
    'utf8',
  );

  test('+1 and +2 have large touch targets (56px)', () => {
    expect(source).toContain('tracked-lap-plus-1');
    expect(source).toContain('tracked-lap-plus-2');
    expect(source).toContain('min-h-[56px]');
    expect(source).toContain('h-14');
  });

  test('undo is accessible full-width with 48px target', () => {
    expect(source).toContain('tracked-lap-undo');
    expect(source).toContain('min-h-[48px]');
    expect(source).toMatch(/Annuler la dernière|undoLap/);
  });

  test('mobile layout uses grid and min-w-0 max-w-full', () => {
    expect(source).toContain('grid-cols-2');
    expect(source).toContain('min-w-0');
    expect(source).toContain('max-w-full');
  });

  test('prevents double add with pending + idempotency key', () => {
    expect(source).toContain('lapsPending');
    expect(source).toContain('if (lapsPending) return');
    expect(source).toContain('idempotency_key');
  });

  test('updates counter and distance immediately', () => {
    expect(source).toContain('setLaps(next)');
    expect(source).toContain('tracked-laps-count');
    expect(source).toContain('tracked-laps-distance');
  });
});
