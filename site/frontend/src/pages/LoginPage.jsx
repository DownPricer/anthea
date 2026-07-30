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

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const { login, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const startCooldown = (seconds = 60) => {
    setResendCooldown(seconds);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error(t('login.fillAllFields'));
      return;
    }

    setIsLoading(true);
    setUnverifiedEmail('');
    const result = await login(email.trim(), password);
    setIsLoading(false);

    if (result.success) {
      toast.success(t('login.success'));
      navigate(from, { replace: true });
      return;
    }

    if (result.code === 'email_not_verified') {
      setUnverifiedEmail(email.trim());
      toast.error(t('login.emailNotVerified'));
      return;
    }

    toast.error(result.error || t('login.invalidCredentials'));
  };

  const handleResend = async () => {
    if (!unverifiedEmail || resendCooldown > 0) return;
    const result = await resendVerification(unverifiedEmail);
    if (result.success) {
      toast.success(t('verify.resendSent'));
      startCooldown(result.detail?.retry_after || 60);
    } else if (result.code === 'resend_cooldown') {
      startCooldown(result.detail?.retry_after || 60);
      toast.error(result.error);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-10">
          <AntheaLogo className="h-14 w-14 mb-4" />
          <h1 className="text-3xl font-black text-foreground tracking-tight font-['Outfit']">
            {t('common:app.brand')}
          </h1>
          <p className="text-subtle text-sm mt-2">{t('login.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted text-sm">
              {t('login.email')}
            </Label>
            <Input
              id="email"
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@email.com"
              className="h-14 rounded-xl bg-surface-elevated border-border text-foreground placeholder:text-subtle focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)]"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-muted text-sm">
                {t('login.password')}
              </Label>
              <Link
                to="/forgot-password"
                data-testid="forgot-password-link"
                className="text-xs text-[var(--theme-primary)] hover:underline"
              >
                {t('login.forgotPassword')}
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                data-testid="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 rounded-xl bg-surface-elevated border-border text-foreground placeholder:text-subtle focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] pr-12"
                autoComplete="current-password"
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

          {unverifiedEmail ? (
            <div className="rounded-xl border border-border bg-surface-elevated p-3 space-y-2">
              <p className="text-sm text-muted">{t('login.emailNotVerified')}</p>
              <Button
                type="button"
                variant="outline"
                disabled={resendCooldown > 0}
                onClick={handleResend}
                data-testid="login-resend-verification"
                className="w-full h-11 rounded-xl"
              >
                {resendCooldown > 0
                  ? t('verify.resendCooldown', { seconds: resendCooldown })
                  : t('login.resendVerification')}
              </Button>
            </div>
          ) : null}

          <Button
            type="submit"
            data-testid="login-submit"
            disabled={isLoading}
            className="w-full h-14 rounded-xl font-bold text-foreground btn-primary"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login.submit')}
          </Button>
        </form>

        <p className="text-center mt-6 text-subtle text-sm">
          <Link
            to="/legacy-account"
            data-testid="legacy-account-link"
            className="text-[var(--theme-primary)] hover:underline font-medium"
          >
            {t('login.legacyAccount')}
          </Link>
        </p>

        <p className="text-center mt-4 text-subtle text-sm">
          {t('login.noAccount')}{' '}
          <Link
            to="/register"
            data-testid="register-link"
            className="text-[var(--theme-primary)] hover:underline font-medium"
          >
            {t('login.createAccount')}
          </Link>
        </p>
      </div>
    </div>
  );
}
