import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { withNextParam } from '../../lib/safeNextPath';

/**
 * Modale légère — interactions réservées aux comptes connectés.
 */
export function JoinFitGatherModal({ open, onClose, nextPath = '/' }) {
  const { t } = useTranslation('public');
  if (!open) return null;

  const loginTo = withNextParam('/login', nextPath);
  const registerTo = withNextParam('/register', nextPath);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-fitgather-title"
      data-testid="join-fitgather-modal"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-xl motion-safe:animate-fade-in sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="join-fitgather-title" className="text-xl font-bold text-foreground font-['Outfit']">
          {t('joinModal.title')}
        </h2>
        <p className="mt-2 text-sm text-muted">{t('joinModal.body')}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="min-h-12 rounded-xl font-bold btn-primary">
            <Link to={loginTo} data-testid="join-modal-login">
              {t('joinModal.login')}
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-12 rounded-xl">
            <Link to={registerTo} data-testid="join-modal-register">
              {t('joinModal.register')}
            </Link>
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 text-sm text-subtle hover:text-foreground transition-colors"
            data-testid="join-modal-continue"
          >
            {t('joinModal.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
