import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthSplash } from './AuthHomeSwitch';

export function ProtectedRoute({ children }) {
  const { authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === 'checking') {
    return <AuthSplash />;
  }

  if (authStatus === 'anonymous') {
    const next = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}
