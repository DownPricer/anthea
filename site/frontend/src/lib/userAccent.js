export const THEME_DEFAULTS = {
  default: '#06B6D4',
  girly: '#D946EF',
};

/** Normalise une couleur hex (#RRGGBB). */
export function normalizeAccentColor(value) {
  if (!value || !String(value).trim()) return null;
  let raw = String(value).trim();
  if (raw.startsWith('#')) raw = raw.slice(1);

  // Supporte #RGB -> #RRGGBB
  if (raw.length === 3) {
    raw = `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }

  if (raw.length !== 6) return null;
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toUpperCase()}`;
}

/** Source unique pour la couleur d'accent affichée (profil → agenda → duo). */
export function resolveUserAccent(user, theme = 'default') {
  const normalized = normalizeAccentColor(user?.accent_color);
  if (normalized) return normalized;
  return THEME_DEFAULTS[theme] || THEME_DEFAULTS.default;
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeAccentColor(hex);
  if (!normalized) return `rgba(6, 182, 212, ${alpha})`;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Applique l'accent global UI — l'agenda gère ses propres variables localement. */
export function applyAccentToDocument(color) {
  const root = document.documentElement;
  if (color) {
    root.style.setProperty('--user-accent', color);
    root.style.setProperty('--user-accent-glow', hexToRgba(color, 0.3));
    // Couleur perso = accent principal dans les deux thèmes
    root.style.setProperty('--theme-primary', color);
    root.style.setProperty('--theme-primary-glow', hexToRgba(color, 0.3));
    root.style.setProperty('--theme-surface-active', hexToRgba(color, 0.12));
  } else {
    root.style.removeProperty('--user-accent');
    root.style.removeProperty('--user-accent-glow');
    root.style.removeProperty('--theme-primary');
    root.style.removeProperty('--theme-primary-glow');
    root.style.removeProperty('--theme-surface-active');
  }
}

export function getAccentForUser(userObj, theme = 'default') {
  return resolveUserAccent(userObj, theme);
}
