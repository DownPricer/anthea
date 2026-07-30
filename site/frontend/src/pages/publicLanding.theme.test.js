/**
 * Tests thème clair/sombre pour la landing (classes design system).
 */
const fs = require('fs');
const path = require('path');

describe('public landing theme compatibility', () => {
  const landing = fs.readFileSync(
    path.join(__dirname, 'PublicLandingPage.jsx'),
    'utf8'
  );

  test('uses theme tokens not hardcoded purple/dark-only colors', () => {
    expect(landing).toContain('bg-background');
    expect(landing).toContain('text-foreground');
    expect(landing).toContain('var(--theme-primary)');
    expect(landing).not.toMatch(/bg-purple-|from-purple-|to-indigo-/);
  });
});
