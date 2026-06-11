export const THEME_DEFAULTS = {
  default: '#06B6D4',
  girly: '#D946EF',
};

/** Normalise une couleur hex (#RRGGBB). */
export function normalizeAccentColor(value) {
  if (!value || !String(value).trim()) return null;
  let color = String(value).trim();
  if (!color.startsWith('#')) color = `#${color}`;
  if (color.length === 4) {
    color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color;
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
