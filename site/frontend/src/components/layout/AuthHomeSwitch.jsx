import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PublicLandingPage } from '../../pages/PublicLandingPage';
import { AntheaLogo } from '../branding/AntheaLogo';

export function AuthSplash() {
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
      </div>
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
