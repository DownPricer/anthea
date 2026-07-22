import { applyAccentToDocument, resolveUserAccent, THEME_DEFAULTS } from './userAccent';

describe('userAccent theme integration', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--theme-primary');
    document.documentElement.style.removeProperty('--user-accent');
    document.documentElement.style.removeProperty('--theme-primary-glow');
    document.documentElement.style.removeProperty('--theme-surface-active');
  });

  test('personal accent drives --theme-primary in both modes', () => {
    applyAccentToDocument('#EF4444');
    expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#EF4444');
    expect(document.documentElement.style.getPropertyValue('--user-accent')).toBe('#EF4444');
  });

  test('clearing accent removes inline overrides', () => {
    applyAccentToDocument('#10B981');
    applyAccentToDocument(null);
    expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--user-accent')).toBe('');
  });

  test('resolveUserAccent keeps personal color over palette', () => {
    expect(resolveUserAccent({ accent_color: '#6366F1' }, 'girly')).toBe('#6366F1');
    expect(resolveUserAccent({}, 'girly')).toBe(THEME_DEFAULTS.girly);
    expect(resolveUserAccent({}, 'default')).toBe(THEME_DEFAULTS.default);
  });
});
