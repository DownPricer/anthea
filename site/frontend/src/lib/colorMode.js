/** Modes d'apparence (clair / sombre) — distincts de la palette d'accent default/girly. */

export const COLOR_MODE_STORAGE_KEY = 'anthea-color-mode';
export const COLOR_MODES = Object.freeze(['dark', 'light']);
export const DEFAULT_COLOR_MODE = 'dark';

export const THEME_META_COLORS = Object.freeze({
  dark: '#09090B',
  light: '#F4F5F7',
});

export function normalizeColorMode(value) {
  if (value === 'light' || value === 'dark') return value;
  return null;
}

/**
 * Ordre de résolution :
 * 1. localStorage
 * 2. préférence utilisateur (backend)
 * 3. sombre (fallback actuel)
 */
export function resolveColorMode({ stored, userAppearance } = {}) {
  return (
    normalizeColorMode(stored) ||
    normalizeColorMode(userAppearance) ||
    DEFAULT_COLOR_MODE
  );
}

export function readStoredColorMode() {
  if (typeof localStorage === 'undefined') return null;
  try {
    return normalizeColorMode(localStorage.getItem(COLOR_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredColorMode(mode) {
  const normalized = normalizeColorMode(mode) || DEFAULT_COLOR_MODE;
  try {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, normalized);
  } catch {
    // ignore quota / private mode
  }
  return normalized;
}

export function updateThemeColorMeta(mode) {
  if (typeof document === 'undefined') return;
  const color = THEME_META_COLORS[mode] || THEME_META_COLORS.dark;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

/**
 * Applique le mode sur <html> : data-theme, color-scheme, meta theme-color.
 * Safe à appeler hors React (anti-flash).
 */
export function applyColorModeToDocument(mode) {
  const normalized = normalizeColorMode(mode) || DEFAULT_COLOR_MODE;
  if (typeof document === 'undefined') return normalized;

  const root = document.documentElement;
  root.setAttribute('data-theme', normalized);
  root.style.colorScheme = normalized;
  updateThemeColorMeta(normalized);
  return normalized;
}
