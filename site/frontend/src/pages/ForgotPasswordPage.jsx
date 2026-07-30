import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AntheaLogo } from '../components/branding/AntheaLogo';

export function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t('register.errors.emailRequired'));
      return;
    }
    setIsLoading(true);
    const result = await forgotPassword(email.trim());
    setIsLoading(false);
    if (result.success) {
      setSent(true);
      toast.success(t('forgot.sent'));
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
            {t('forgot.title')}
          </h1>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-muted" data-testid="forgot-sent">
              {t('forgot.sent')}
            </p>
            <Link to="/login" className="text-[var(--theme-primary)] hover:underline text-sm">
              {t('forgot.backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">{t('forgot.email')}</Label>
              <Input
                id="forgot-email"
                data-testid="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 rounded-xl bg-surface-elevated border-border"
                autoComplete="email"
              />
            </div>
            <Button
              type="submit"
              data-testid="forgot-submit"
              disabled={isLoading}
              className="w-full h-14 rounded-xl btn-primary"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('forgot.submit')}
            </Button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-[var(--theme-primary)] hover:underline">
                {t('forgot.backToLogin')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
