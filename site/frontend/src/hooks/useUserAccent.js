import { useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  resolveUserAccent,
  applyAccentToDocument,
  THEME_DEFAULTS,
  getAccentForUser,
} from '../lib/userAccent';

export { THEME_DEFAULTS, getAccentForUser };

/** Applique la couleur d'accent utilisateur (indépendante du thème global). */
export function useUserAccent() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const accent = useMemo(
    () => resolveUserAccent(user, theme),
    [user?.accent_color, user?.id, theme]
  );

  useEffect(() => {
    applyAccentToDocument(accent);
  }, [accent]);

  return { accent, themeDefault: THEME_DEFAULTS[theme] };
}
