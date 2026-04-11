import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, formatApiError } from '../lib/api';

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
      return { success: true };
    } catch (error) {
      return { success: false, error: formatApiError(error) };
    }
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
