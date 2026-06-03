export const THEME_DEFAULTS = {
  default: '#06B6D4',
  girly: '#D946EF',
};

/** Source unique pour la couleur d'accent affichée (profil → agenda → duo). */
export function resolveUserAccent(user, theme = 'default') {
  if (user?.accent_color) return user.accent_color;
  return THEME_DEFAULTS[theme] || THEME_DEFAULTS.default;
}

export function applyAccentToDocument(color) {
  const root = document.documentElement;
  if (color) {
    root.style.setProperty('--user-accent', color);
    root.style.setProperty('--agenda-mine', color);
    root.style.setProperty('--user-accent-glow', `${color}4D`);
  }
}

export function getAccentForUser(userObj, theme = 'default') {
  return resolveUserAccent(userObj, theme);
}
