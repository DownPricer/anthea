import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { startOfWeek, addDays, format } from 'date-fns';
import { authApi, formatApiError, streakApi } from '../lib/api';
import { setAppLocale } from '../i18n';
import { writeStoredTimeFormat } from '../i18n/storage';
import { calendarDaysToMap } from '../lib/agendaDayMap';
import { preloadHomeWeek } from '../lib/homeCache';
import { invalidateAllBadgesCache } from '../lib/badgesCache';

const AuthContext = createContext(null);

function authDebug(label) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[auth] ${label}`, performance.now());
  }
}

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
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState('checking');
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const userRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const loading = authStatus === 'checking';

  const commitUser = useCallback((nextUser) => {
    userRef.current = nextUser;
    if (mountedRef.current) setUser(nextUser);
  }, []);

  const checkAuth = useCallback(async ({ manual = false } = {}) => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (manual && !userRef.current) setAuthStatus('checking');
    authDebug('auth_me_start');
    try {
      const { data } = await authApi.me();
      authDebug('auth_me_end');
      if (!mountedRef.current) return;
      commitUser(data);
      setAuthStatus('authenticated');
      setAuthUnavailable(false);
      retryAttemptRef.current = 0;
      authDebug('auth_resolution:authenticated');
      preloadHomeWeek(data.id, async () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        const wsStr = format(weekStart, 'yyyy-MM-dd');
        const weStr = format(weekEnd, 'yyyy-MM-dd');
        const calRes = await streakApi.getCalendar(wsStr, weStr);
        return calendarDaysToMap(calRes.data?.days || []);
      });
    } catch (error) {
      authDebug('auth_me_end');
      if (!mountedRef.current) return;
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        commitUser(false);
        setAuthStatus('anonymous');
        setAuthUnavailable(false);
        retryAttemptRef.current = 0;
        authDebug('auth_resolution:anonymous');
        return;
      }

      setAuthUnavailable(true);
      setAuthStatus(userRef.current ? 'authenticated' : 'checking');
      authDebug(`auth_resolution:retry_${retryAttemptRef.current}`);
      const delays = [2000, 5000, 10000, 30000];
      const delay = delays[Math.min(retryAttemptRef.current, delays.length - 1)];
      retryAttemptRef.current += 1;
      retryTimerRef.current = window.setTimeout(() => {
        checkAuth();
      }, delay);
    }
  }, [commitUser]);

  useEffect(() => {
    mountedRef.current = true;
    authDebug('auth_start');
    checkAuth();

    const handleInvalidSession = () => {
      invalidateAllBadgesCache();
      commitUser(false);
      setAuthStatus('anonymous');
      setAuthUnavailable(false);
    };
    const handleTemporaryFailure = () => setAuthUnavailable(true);
    const handleConnectionRestored = () => setAuthUnavailable(false);
    window.addEventListener('auth:session-invalid', handleInvalidSession);
    window.addEventListener('auth:temporary-unavailable', handleTemporaryFailure);
    window.addEventListener('auth:connection-restored', handleConnectionRestored);
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      window.removeEventListener('auth:session-invalid', handleInvalidSession);
      window.removeEventListener('auth:temporary-unavailable', handleTemporaryFailure);
      window.removeEventListener('auth:connection-restored', handleConnectionRestored);
    };
  }, [checkAuth, commitUser]);

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
      commitUser(data);
      setAuthStatus('authenticated');
      setAuthUnavailable(false);
      return { success: true };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await authApi.register(userData);
      if (data?.user) {
        commitUser(data.user);
        setAuthStatus('authenticated');
        setAuthUnavailable(false);
      }
      return { success: true, data };
    } catch (error) {
      return authErrorPayload(error);
    }
  };

  const verifyEmail = async (token) => {
    try {
      const { data } = await authApi.verifyEmail({ token });
      if (data?.user) {
        commitUser(data.user);
        setAuthStatus('authenticated');
        setAuthUnavailable(false);
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
      invalidateAllBadgesCache();
      commitUser(false);
      setAuthStatus('anonymous');
      setAuthUnavailable(false);
    }
  };

  const updateProfile = async (data) => {
    try {
      const { data: updated } = await authApi.updateProfile(data);
      commitUser(updated);
      window.dispatchEvent(new CustomEvent('user:profile-updated', { detail: updated }));
      return { success: true, user: updated };
    } catch (error) {
      return { success: false, error: formatApiError(error) };
    }
  };

  const patchUser = (partial) => {
    if (userRef.current && typeof userRef.current === 'object') {
      commitUser({ ...userRef.current, ...partial });
    }
  };

  const refreshUser = async () => {
    try {
      const { data } = await authApi.me();
      commitUser(data);
      setAuthStatus('authenticated');
      setAuthUnavailable(false);
    } catch {
      // Ignore errors
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authStatus,
        authUnavailable,
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
        retryAuth: () => checkAuth({ manual: true }),
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
