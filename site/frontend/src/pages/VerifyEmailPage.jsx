import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AntheaLogo } from '../components/branding/AntheaLogo';

export function VerifyEmailPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [errorCode, setErrorCode] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setStatus('error');
      setErrorCode('token_missing');
      return;
    }

    (async () => {
      const result = await verifyEmail(token);
      if (result.success) {
        setStatus('success');
        toast.success(t('verify.success'));
        setTimeout(() => navigate('/', { replace: true }), 1200);
      } else {
        setStatus('error');
        setErrorCode(result.code || 'token_invalid');
      }
    })();
  }, [token, verifyEmail, navigate, t]);

  const errorMessage = () => {
    if (errorCode === 'token_expired') return t('verify.tokenExpired');
    if (errorCode === 'token_used') return t('verify.tokenUsed');
    if (errorCode === 'token_missing') return t('verify.tokenMissing');
    if (errorCode === 'network') return t('verify.networkError');
    return t('verify.tokenInvalid');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <AntheaLogo className="h-12 w-12 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-foreground font-['Outfit'] mb-4">
          {t('verify.title')}
        </h1>

        {status === 'loading' ? (
          <div className="flex flex-col items-center gap-3 text-muted">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p>{t('verify.loading')}</p>
          </div>
        ) : null}

        {status === 'success' ? (
          <div className="space-y-3">
            <p className="text-foreground font-medium" data-testid="verify-success">
              {t('verify.success')}
            </p>
            <p className="text-subtle text-sm">{t('verify.redirecting')}</p>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="space-y-4">
            <p className="text-muted" data-testid="verify-error">
              {errorMessage()}
            </p>
            <Button asChild className="w-full h-12 rounded-xl btn-primary">
              <Link to="/login">{t('checkEmail.backToLogin')}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
