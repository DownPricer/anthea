import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const THEME_STORAGE_KEY = 'anthea-theme';
const LEGACY_THEME_STORAGE_KEY = 'fitduo-theme';

function readStoredTheme() {
  return (
    localStorage.getItem(THEME_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_THEME_STORAGE_KEY) ||
    'default'
  );
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readStoredTheme());

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    
    // Apply theme class to root element
    const root = document.documentElement;
    if (theme === 'girly') {
      root.classList.add('theme-girly');
    } else {
      root.classList.remove('theme-girly');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'default' ? 'girly' : 'default'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
