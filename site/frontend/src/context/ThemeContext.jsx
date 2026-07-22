import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  applyColorModeToDocument,
  DEFAULT_COLOR_MODE,
  normalizeColorMode,
  readStoredColorMode,
  resolveColorMode,
  writeStoredColorMode,
} from '../lib/colorMode';

const ThemeContext = createContext(null);

const ACCENT_THEME_STORAGE_KEY = 'anthea-theme';
const LEGACY_THEME_STORAGE_KEY = 'fitduo-theme';

function readStoredAccentTheme() {
  try {
    const raw =
      localStorage.getItem(ACCENT_THEME_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_THEME_STORAGE_KEY) ||
      'default';
    if (raw === 'dark' || raw === 'light') return 'default';
    return raw === 'girly' ? 'girly' : 'default';
  } catch {
    return 'default';
  }
}

function applyAccentThemeClass(accentTheme) {
  const root = document.documentElement;
  if (accentTheme === 'girly') {
    root.classList.add('theme-girly');
  } else {
    root.classList.remove('theme-girly');
  }
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [colorMode, setColorModeState] = useState(() =>
    resolveColorMode({ stored: readStoredColorMode() })
  );
  const [theme, setThemeState] = useState(() => readStoredAccentTheme());

  const setColorMode = useCallback((next) => {
    const normalized = normalizeColorMode(next) || DEFAULT_COLOR_MODE;
    writeStoredColorMode(normalized);
    applyColorModeToDocument(normalized);
    setColorModeState(normalized);
  }, []);

  const setTheme = useCallback((next) => {
    const accentTheme = next === 'girly' ? 'girly' : 'default';
    try {
      localStorage.setItem(ACCENT_THEME_STORAGE_KEY, accentTheme);
      localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    } catch {
      // ignore
    }
    applyAccentThemeClass(accentTheme);
    setThemeState(accentTheme);
  }, []);

  useEffect(() => {
    applyColorModeToDocument(colorMode);
  }, [colorMode]);

  useEffect(() => {
    applyAccentThemeClass(theme);
  }, [theme]);

  // Hydrate depuis le profil si aucune préférence locale
  useEffect(() => {
    if (!user || typeof user !== 'object') return;

    const stored = readStoredColorMode();
    const fromUser = normalizeColorMode(user.appearance);

    if (stored) {
      applyColorModeToDocument(stored);
      setColorModeState(stored);
    } else if (fromUser) {
      writeStoredColorMode(fromUser);
      applyColorModeToDocument(fromUser);
      setColorModeState(fromUser);
    }

    if (user.theme === 'girly' || user.theme === 'default') {
      try {
        localStorage.setItem(ACCENT_THEME_STORAGE_KEY, user.theme);
        localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
      } catch {
        // ignore
      }
      applyAccentThemeClass(user.theme);
      setThemeState(user.theme);
    }
    // Sync ciblé : id / appearance / theme uniquement
    // eslint-disable-next-line react-hooks/exhaustive-deps -- éviter re-sync sur tout le profil
  }, [user?.id, user?.appearance, user?.theme]);

  const toggleColorMode = useCallback(() => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  }, [colorMode, setColorMode]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'default' ? 'girly' : 'default');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        colorMode,
        setColorMode,
        toggleColorMode,
        theme,
        setTheme,
        toggleTheme,
        appearance: colorMode,
        setAppearance: setColorMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
