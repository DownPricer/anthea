import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { AntheaLogo } from '../components/branding/AntheaLogo';

export function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error(t('reset.tokenMissing'));
      return;
    }
    if (!password || password.length < 6) {
      toast.error(t('register.errors.passwordMin'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('register.errors.passwordMismatch'));
      return;
    }
    setIsLoading(true);
    const result = await resetPassword(token, password, confirmPassword);
    setIsLoading(false);
    if (result.success) {
      toast.success(t('reset.success'));
      navigate('/login', { replace: true });
      return;
    }
    if (result.code === 'token_expired') toast.error(t('reset.tokenExpired'));
    else if (result.code === 'token_used') toast.error(t('reset.tokenUsed'));
    else toast.error(result.error || t('reset.tokenInvalid'));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <AntheaLogo className="h-12 w-12 mb-3" />
          <h1 className="text-2xl font-black text-foreground font-['Outfit']">
            {t('reset.title')}
          </h1>
        </div>

        {!token ? (
          <div className="space-y-4 text-center">
            <p className="text-muted">{t('reset.tokenMissing')}</p>
            <Link to="/forgot-password" className="text-[var(--theme-primary)] hover:underline text-sm">
              {t('forgot.title')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">{t('reset.password')}</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  data-testid="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 rounded-xl bg-surface-elevated border-border pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-subtle"
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm">{t('reset.confirmPassword')}</Label>
              <Input
                id="reset-confirm"
                data-testid="reset-confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-14 rounded-xl bg-surface-elevated border-border"
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              data-testid="reset-submit"
              disabled={isLoading}
              className="w-full h-14 rounded-xl btn-primary"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('reset.submit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
