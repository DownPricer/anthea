import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { AntheaLogo } from '../components/branding/AntheaLogo';

export function LegacyAccountPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { legacyLogin, legacyEmail } = useAuth();
  const [step, setStep] = useState(1);
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleStep1 = async (e) => {
    e.preventDefault();
    if (!handle.trim() || !password) {
      toast.error(t('login.fillAllFields'));
      return;
    }
    setIsLoading(true);
    const result = await legacyLogin(handle.trim(), password);
    setIsLoading(false);
    if (result.success) {
      setStep(2);
    } else {
      toast.error(result.error);
    }
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t('register.errors.emailRequired'));
      return;
    }
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
      toast.error(t('legacy.emailMismatch'));
      return;
    }
    setIsLoading(true);
    const result = await legacyEmail(email.trim(), emailConfirm.trim());
    setIsLoading(false);
    if (result.success) {
      setDone(true);
      toast.success(t('legacy.emailSent'));
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <AntheaLogo className="h-12 w-12 mb-3" />
          <h1 className="text-2xl font-black text-foreground font-['Outfit']">
            {t('legacy.title')}
          </h1>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-muted" data-testid="legacy-email-sent">
              {t('legacy.emailSent')}
            </p>
            <Link
              to="/login"
              className="text-[var(--theme-primary)] hover:underline text-sm font-medium"
            >
              {t('legacy.backToLogin')}
            </Link>
          </div>
        ) : step === 1 ? (
          <>
            <p className="text-muted text-sm mb-6">{t('legacy.intro')}</p>
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legacy-handle">{t('legacy.handle')}</Label>
                <Input
                  id="legacy-handle"
                  data-testid="legacy-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/\s/g, ''))}
                  className="h-14 rounded-xl bg-surface-elevated border-border"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legacy-password">{t('legacy.password')}</Label>
                <div className="relative">
                  <Input
                    id="legacy-password"
                    data-testid="legacy-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-xl bg-surface-elevated border-border pr-12"
                    autoComplete="current-password"
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
              <Button
                type="submit"
                data-testid="legacy-login-submit"
                disabled={isLoading}
                className="w-full h-14 rounded-xl btn-primary"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('legacy.continue')}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t('legacy.emailStepTitle')}
            </h2>
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legacy-email">{t('legacy.email')}</Label>
                <Input
                  id="legacy-email"
                  data-testid="legacy-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 rounded-xl bg-surface-elevated border-border"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legacy-email-confirm">{t('legacy.emailConfirm')}</Label>
                <Input
                  id="legacy-email-confirm"
                  data-testid="legacy-email-confirm"
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  className="h-14 rounded-xl bg-surface-elevated border-border"
                  autoComplete="email"
                />
              </div>
              <Button
                type="submit"
                data-testid="legacy-email-submit"
                disabled={isLoading}
                className="w-full h-14 rounded-xl btn-primary"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('legacy.sendLink')}
              </Button>
            </form>
          </>
        )}

        {!done ? (
          <p className="text-center mt-8 text-subtle text-sm">
            <Link to="/login" className="text-[var(--theme-primary)] hover:underline">
              {t('legacy.backToLogin')}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
