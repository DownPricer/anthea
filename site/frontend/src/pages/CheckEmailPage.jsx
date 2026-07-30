import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { AntheaLogo } from '../components/branding/AntheaLogo';

export function CheckEmailPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [searchParams] = useSearchParams();
  const email = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const { resendVerification } = useAuth();
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  const startCooldown = (seconds = 60) => {
    setCooldown(seconds);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || sending) return;
    setSending(true);
    const result = await resendVerification(email);
    setSending(false);
    if (result.success) {
      toast.success(t('verify.resendSent'));
      startCooldown(60);
    } else if (result.code === 'resend_cooldown') {
      startCooldown(result.detail?.retry_after || 60);
      toast.error(result.error);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center animate-fade-in space-y-4">
        <AntheaLogo className="h-12 w-12 mx-auto" />
        <h1 className="text-2xl font-black text-foreground font-['Outfit']">
          {t('checkEmail.title')}
        </h1>
        <p className="text-muted text-sm">{t('checkEmail.body')}</p>
        {email ? <p className="text-subtle text-xs break-all">{email}</p> : null}

        <Button
          type="button"
          data-testid="check-email-resend"
          disabled={!email || cooldown > 0 || sending}
          onClick={handleResend}
          className="w-full h-12 rounded-xl btn-primary"
        >
          {cooldown > 0
            ? t('verify.resendCooldown', { seconds: cooldown })
            : t('checkEmail.resend')}
        </Button>

        <Link
          to="/login"
          className="block text-sm text-[var(--theme-primary)] hover:underline"
        >
          {t('checkEmail.backToLogin')}
        </Link>
      </div>
    </div>
  );
}
