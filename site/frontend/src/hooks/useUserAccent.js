import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const THEME_DEFAULTS = {
  default: '#06B6D4',
  girly: '#D946EF',
};

/** Applique la couleur d'accent utilisateur (indépendante du thème global). */
export function useUserAccent() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const accent = user?.accent_color || THEME_DEFAULTS[theme] || THEME_DEFAULTS.default;
  const partnerAccent = null; // fourni par le parent si besoin

  useEffect(() => {
    const root = document.documentElement;
    if (user?.accent_color) {
      root.style.setProperty('--user-accent', user.accent_color);
      root.style.setProperty('--user-accent-glow', `${user.accent_color}4D`);
    } else {
      root.style.removeProperty('--user-accent');
      root.style.removeProperty('--user-accent-glow');
    }
  }, [user?.accent_color]);

  return { accent, partnerAccent, themeDefault: THEME_DEFAULTS[theme] };
}

export function getAccentForUser(userObj, theme = 'default') {
  return userObj?.accent_color || THEME_DEFAULTS[theme] || THEME_DEFAULTS.default;
}
