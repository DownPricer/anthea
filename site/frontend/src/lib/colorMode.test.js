import {
  applyColorModeToDocument,
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
  normalizeColorMode,
  readStoredColorMode,
  resolveColorMode,
  THEME_META_COLORS,
  updateThemeColorMeta,
  writeStoredColorMode,
} from './colorMode';

describe('colorMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    document.documentElement.style.removeProperty('--theme-primary');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.remove();
  });

  test('normalizeColorMode accepts only dark and light', () => {
    expect(normalizeColorMode('dark')).toBe('dark');
    expect(normalizeColorMode('light')).toBe('light');
    expect(normalizeColorMode('system')).toBeNull();
    expect(normalizeColorMode('default')).toBeNull();
    expect(normalizeColorMode('girly')).toBeNull();
    expect(normalizeColorMode(null)).toBeNull();
  });

  test('resolveColorMode prefers local then user then dark fallback', () => {
    expect(resolveColorMode({ stored: 'light', userAppearance: 'dark' })).toBe('light');
    expect(resolveColorMode({ stored: null, userAppearance: 'light' })).toBe('light');
    expect(resolveColorMode({})).toBe(DEFAULT_COLOR_MODE);
    expect(DEFAULT_COLOR_MODE).toBe('dark');
  });

  test('persists and reads localStorage', () => {
    writeStoredColorMode('light');
    expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('light');
    expect(readStoredColorMode()).toBe('light');
    writeStoredColorMode('dark');
    expect(readStoredColorMode()).toBe('dark');
  });

  test('applyColorModeToDocument sets data-theme and color-scheme', () => {
    applyColorModeToDocument('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');

    applyColorModeToDocument('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  test('updateThemeColorMeta follows mode', () => {
    updateThemeColorMeta('light');
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe(
      THEME_META_COLORS.light
    );
    updateThemeColorMeta('dark');
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe(
      THEME_META_COLORS.dark
    );
  });
});
