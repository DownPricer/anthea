import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { withNextParam } from '../../lib/safeNextPath';

/**
 * Modale légère — interactions réservées aux comptes connectés.
 * Bottom sheet mobile, modale centrée desktop.
 */
export function JoinFitGatherModal({ open, onClose, nextPath = '/' }) {
  const { t } = useTranslation('public');
  if (!open) return null;

  const loginTo = withNextParam('/login', nextPath);
  const registerTo = withNextParam('/register', nextPath);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden bg-black/50 px-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-fitgather-title"
      data-testid="join-fitgather-modal"
      onClick={onClose}
    >
      <div
        className="w-[min(100%,calc(100vw-32px))] max-w-md max-h-[calc(100dvh-32px-env(safe-area-inset-bottom))] overflow-x-hidden overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-xl motion-safe:animate-fade-in sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="join-fitgather-title" className="text-xl font-bold text-foreground font-['Outfit'] break-words">
          {t('joinModal.title')}
        </h2>
        <p className="mt-2 text-sm text-muted break-words">{t('joinModal.body')}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild className="min-h-11 w-full min-w-0 rounded-xl font-bold btn-primary sm:min-h-12 sm:flex-1">
            <Link to={loginTo} data-testid="join-modal-login">
              {t('joinModal.login')}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-11 w-full min-w-0 rounded-xl sm:min-h-12 sm:flex-1"
          >
            <Link to={registerTo} data-testid="join-modal-register">
              {t('joinModal.register')}
            </Link>
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full text-sm text-subtle hover:text-foreground transition-colors sm:min-h-12"
            data-testid="join-modal-continue"
          >
            {t('joinModal.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
