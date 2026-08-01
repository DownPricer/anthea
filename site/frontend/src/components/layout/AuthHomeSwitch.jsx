import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PublicLandingPage } from '../../pages/PublicLandingPage';
import { AntheaLogo } from '../branding/AntheaLogo';
import { Button } from '../ui/button';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';

export function AuthSplash() {
  const { t } = useTranslation('auth');
  const { authUnavailable, retryAuth } = useAuth();

  return (
    <div
      className="min-h-[100dvh] bg-background flex items-center justify-center px-4"
      data-testid="auth-home-skeleton"
      aria-busy="true"
      aria-label="FitGather"
    >
      <div className="flex flex-col items-center gap-3 text-foreground">
        <AntheaLogo className="h-12 w-12 motion-safe:animate-pulse" />
        <span className="font-['Outfit'] text-lg font-black tracking-tight">FitGather</span>
        {authUnavailable ? (
          <div className="mt-2 flex max-w-sm flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted">{t('session.temporarilyUnavailable')}</p>
            <Button type="button" variant="outline" className="min-h-11" onClick={retryAuth}>
              {t('session.retry')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AuthConnectionNotice() {
  const { t } = useTranslation('auth');
  const { authUnavailable, retryAuth } = useAuth();
  if (!authUnavailable) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex min-h-11 items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-center text-sm text-foreground backdrop-blur"
      data-testid="auth-connection-unavailable"
    >
      <WifiOff size={16} aria-hidden />
      <span>{t('session.temporarilyUnavailable')}</span>
      <button
        type="button"
        onClick={retryAuth}
        className="min-h-11 rounded-lg px-2 font-semibold text-[var(--theme-primary)]"
      >
        {t('session.retry')}
      </button>
    </div>
  );
}

/** Racine publique : aucune landing tant que la restauration n'est pas terminée. */
export function AuthHomeSwitch() {
  const { authStatus } = useAuth();

  if (authStatus === 'checking') {
    return <AuthSplash />;
  }

  if (authStatus === 'authenticated') {
    return <Navigate to="/app" replace />;
  }

  return <PublicLandingPage />;
}

/** Pages réservées aux visiteurs (connexion, inscription et migration). */
export function AuthEntryRoute({ children }) {
  const { authStatus } = useAuth();

  if (authStatus === 'checking') {
    return (
      <AuthSplash />
    );
  }

  if (authStatus === 'authenticated') {
    return <Navigate to="/app" replace />;
  }

  return children;
}
