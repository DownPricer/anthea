import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, formatApiError } from '../lib/api';
import { setAppLocale } from '../i18n';
import { writeStoredTimeFormat } from '../i18n/storage';

const AuthContext = createContext(null);

function authErrorPayload(error) {
  const detail = error?.response?.data?.detail;
  const code = detail && typeof detail === 'object' ? detail.code : null;
  return {
    success: false,
    error: formatApiError(error),
    code,
    detail,
    status: error?.response?.status,
  };
}

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

    const handleLogout = () => {
      setUser(false);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [checkAuth]);

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

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      setUser(data);
      return { success: true };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await authApi.register(userData);
      // Pas de session tant que l'e-mail n'est pas confirmé
      return { success: true, data };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const verifyEmail = async (token) => {
    try {
      const { data } = await authApi.verifyEmail({ token });
      if (data?.user) {
        setUser(data.user);
      } else {
        await checkAuth();
      }
      return { success: true, data };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const resendVerification = async (email) => {
    try {
      const { data } = await authApi.resendVerification({ email });
      return { success: true, data };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const legacyLogin = async (handle, password) => {
    try {
      const { data } = await authApi.legacyLogin({ handle, password });
      return { success: true, data };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const legacyEmail = async (email, emailConfirmation) => {
    try {
      const payload = { email };
      if (emailConfirmation != null) payload.email_confirmation = emailConfirmation;
      const { data } = await authApi.legacyEmail(payload);
      return { success: true, data };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const forgotPassword = async (email) => {
    try {
      const { data } = await authApi.forgotPassword({ email });
      return { success: true, data };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const resetPassword = async (token, password, passwordConfirmation) => {
    try {
      const { data } = await authApi.resetPassword({
        token,
        password,
        password_confirmation: passwordConfirmation,
      });
      return { success: true, data };
    } catch (error) {
      return authErrorPayload(error);
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
        verifyEmail,
        resendVerification,
        legacyLogin,
        legacyEmail,
        forgotPassword,
        resetPassword,
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
