import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, formatApiError } from '../lib/api';
import { setAppLocale } from '../i18n';
import { writeStoredTimeFormat } from '../i18n/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = not auth, object = auth
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Listen for logout events
    const handleLogout = () => {
      setUser(false);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [checkAuth]);

  // Applique les préférences côté user (sans F5) + persiste en local pour éviter le flash.
  useEffect(() => {
    if (!user || typeof user !== 'object') return;
    const locale = user?.locale;
    if (locale) {
      setAppLocale(locale).catch(() => {});
    }
    const tf = user?.time_format;
    if (tf) {
      writeStoredTimeFormat(tf);
    }
  }, [user]);

  const login = async (username, password) => {
    try {
      const { data } = await authApi.login({ username, password });
      setUser(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: formatApiError(error) };
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await authApi.register(userData);
      setUser(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: formatApiError(error) };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(false);
    }
  };

  const updateProfile = async (data) => {
    try {
      const { data: updated } = await authApi.updateProfile(data);
      setUser(updated);
      window.dispatchEvent(new CustomEvent('user:profile-updated', { detail: updated }));
      return { success: true, user: updated };
    } catch (error) {
      return { success: false, error: formatApiError(error) };
    }
  };

  const patchUser = (partial) => {
    setUser((prev) => (prev && typeof prev === 'object' ? { ...prev, ...partial } : prev));
  };

  const refreshUser = async () => {
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      // Ignore errors
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        patchUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
