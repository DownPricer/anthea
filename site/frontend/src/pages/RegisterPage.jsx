import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { AntheaLogo } from '../components/branding/AntheaLogo';
import { readNextFromSearch, withNextParam } from '../lib/safeNextPath';

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = readNextFromSearch(location.search);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedHandle = handle.trim().toLowerCase();
    if (!normalizedHandle) {
      toast.error(t('register.errors.handleRequired'));
      return;
    }
    if (!HANDLE_RE.test(normalizedHandle)) {
      toast.error(t('register.errors.handleInvalid'));
      return;
    }
    if (!email.trim()) {
      toast.error(t('register.errors.emailRequired'));
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      toast.error(t('register.errors.emailInvalid'));
      return;
    }
    if (!password) {
      toast.error(t('register.errors.passwordRequired'));
      return;
    }
    if (password.length < 6) {
      toast.error(t('register.errors.passwordMin'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('register.errors.passwordMismatch'));
      return;
    }

    setIsLoading(true);
    const result = await register({
      handle: normalizedHandle,
      email: email.trim(),
      password,
      password_confirmation: confirmPassword,
    });
    setIsLoading(false);

    if (result.success) {
      toast.success(t('register.success'));
      navigate(`/check-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
    } else if (result.code === 'email_taken') {
      toast.error(t('register.errors.emailTaken'));
    } else if (result.code === 'handle_taken') {
      toast.error(t('register.errors.handleTaken'));
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <AntheaLogo className="h-12 w-12 mb-3" />
          <h1 className="text-2xl font-black text-foreground tracking-tight font-['Outfit']">
            {t('register.title')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="handle" className="text-muted text-sm">
              {t('register.handle')}
            </Label>
            <Input
              id="handle"
              data-testid="register-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/\s/g, ''))}
              placeholder="tonpseudo"
              className="h-14 rounded-xl bg-surface-elevated border-border text-foreground placeholder:text-subtle"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted text-sm">
              {t('register.email')}
            </Label>
            <Input
              id="email"
              data-testid="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@email.com"
              className="h-14 rounded-xl bg-surface-elevated border-border text-foreground placeholder:text-subtle"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-muted text-sm">
              {t('register.password')}
            </Label>
            <div className="relative">
              <Input
                id="password"
                data-testid="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 rounded-xl bg-surface-elevated border-border text-foreground placeholder:text-subtle pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground transition-colors"
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-muted text-sm">
              {t('register.confirmPassword')}
            </Label>
            <Input
              id="confirmPassword"
              data-testid="register-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="h-14 rounded-xl bg-surface-elevated border-border text-foreground placeholder:text-subtle"
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            data-testid="register-submit"
            disabled={isLoading}
            className="w-full h-14 rounded-xl font-bold text-foreground btn-primary mt-4"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('register.submit')}
          </Button>
        </form>

        <p className="text-center mt-8 text-subtle text-sm">
          {t('register.hasAccount')}{' '}
          <Link
            to={withNextParam('/login', nextPath)}
            data-testid="login-link"
            className="text-[var(--theme-primary)] hover:underline font-medium"
          >
            {t('register.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
