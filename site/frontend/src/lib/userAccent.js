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

/** Applique l'accent global UI — l'agenda gère ses propres variables localement. */
export function applyAccentToDocument(color) {
  const root = document.documentElement;
  if (color) {
    root.style.setProperty('--user-accent', color);
    root.style.setProperty('--user-accent-glow', `${color}4D`);
  } else {
    root.style.removeProperty('--user-accent');
    root.style.removeProperty('--user-accent-glow');
  }
}

export function getAccentForUser(userObj, theme = 'default') {
  return resolveUserAccent(userObj, theme);
}
