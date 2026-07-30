import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PublicLandingPage } from '../../pages/PublicLandingPage';

/**
 * Racine `/` : landing publique si anonyme, layout app (HomePage) si connecté.
 * Autres chemins enfants : redirection login si anonyme (sans flash landing).
 */
export function AuthHomeSwitch({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isExactHome = location.pathname === '/' || location.pathname === '';

  if (loading) {
    return (
      <div
        className="min-h-screen bg-background"
        data-testid="auth-home-skeleton"
        aria-busy="true"
      >
        <div className="mx-auto max-w-5xl px-4 pt-8 space-y-4">
          <div className="h-10 w-40 rounded-xl bg-hover animate-pulse" />
          <div className="h-24 rounded-2xl bg-hover animate-pulse" />
          <div className="h-40 rounded-2xl bg-hover animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    if (isExactHome) {
      return <PublicLandingPage />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
