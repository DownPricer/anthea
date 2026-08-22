import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, UserPlus, UserMinus } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { usersApi, formatApiError } from '../../lib/api';
import { UserAvatar } from '../UserAvatar';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { getPublicHandle } from '../../lib/userProfile';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

function RequestUserRow({ user, dateLabel, children }) {
  const handle = getPublicHandle(user);
  return (
    <div className="card p-4 flex items-start gap-3" data-testid="follow-request-row">
      <Link to={handle ? `/profile/${handle}` : '#'} className="shrink-0">
        <UserAvatar user={user} className="w-11 h-11 text-base" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={handle ? `/profile/${handle}` : '#'}
          className="font-medium text-foreground hover:underline text-sm"
        >
          {user.display_name || user.username}
        </Link>
        {handle ? <p className="text-subtle text-xs">{handle}</p> : null}
        {dateLabel ? <p className="text-subtle text-xs mt-1">{dateLabel}</p> : null}
        <div className="flex flex-wrap gap-2 mt-2">{children}</div>
      </div>
    </div>
  );
}

export function FollowRequestsPanel() {
  const { t } = useTranslation(['notifications', 'profile', 'common']);
  const { formatDateTime } = useLocaleFormat();
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.getFollowRequests();
      setIncoming(data?.incoming || []);
      setOutgoing(data?.outgoing || []);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (requestId) => {
    setActionLoading(`accept-${requestId}`);
    try {
      await usersApi.acceptFollowRequest(requestId);
      toast.success(t('notifications:followRequestAccepted', { defaultValue: 'Demande acceptée' }));
      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    setActionLoading(`reject-${requestId}`);
    try {
      await usersApi.rejectFollowRequest(requestId);
      toast.success(t('notifications:followRequestRejected', { defaultValue: 'Demande refusée' }));
      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (requestId) => {
    setActionLoading(`cancel-${requestId}`);
    try {
      await usersApi.cancelFollowRequest(requestId);
      toast.success(t('profile:followRequestCancelled', { defaultValue: 'Demande annulée' }));
      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="follow-requests-panel">
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-2">
          {t('notifications:followRequests.incoming', { defaultValue: 'Reçues' })}
        </h2>
        {incoming.length === 0 ? (
          <p className="text-muted text-sm py-4">{t('notifications:followRequests.emptyIncoming', { defaultValue: 'Aucune demande reçue.' })}</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((req) => {
              const user = {
                id: req.user_id,
                username: req.username,
                handle: req.handle,
                display_name: req.display_name,
                avatar_url: req.avatar_url,
              };
              const dateLabel = req.created_at ? formatDateTime(parseISO(req.created_at)) : '';
              const busy = actionLoading?.startsWith('accept-') || actionLoading?.startsWith('reject-');
              return (
                <RequestUserRow key={req.request_id} user={user} dateLabel={dateLabel}>
                  <Button
                    size="sm"
                    className="rounded-xl btn-primary text-foreground min-h-10"
                    disabled={busy}
                    onClick={() => handleAccept(req.request_id)}
                    data-testid={`accept-follow-${req.request_id}`}
                  >
                    {actionLoading === `accept-${req.request_id}` ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      t('notifications:actions.accept', { defaultValue: 'Accepter' })
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-border min-h-10"
                    disabled={busy}
                    onClick={() => handleReject(req.request_id)}
                    data-testid={`reject-follow-${req.request_id}`}
                  >
                    {actionLoading === `reject-${req.request_id}` ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      t('notifications:actions.reject', { defaultValue: 'Refuser' })
                    )}
                  </Button>
                </RequestUserRow>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-2">
          {t('notifications:followRequests.outgoing', { defaultValue: 'Envoyées' })}
        </h2>
        {outgoing.length === 0 ? (
          <p className="text-muted text-sm py-4">{t('notifications:followRequests.emptyOutgoing', { defaultValue: 'Aucune demande envoyée.' })}</p>
        ) : (
          <div className="space-y-2">
            {outgoing.map((req) => {
              const user = {
                id: req.user_id,
                username: req.username,
                handle: req.handle,
                display_name: req.display_name,
                avatar_url: req.avatar_url,
              };
              const dateLabel = req.created_at ? formatDateTime(parseISO(req.created_at)) : '';
              return (
                <RequestUserRow key={req.request_id} user={user} dateLabel={dateLabel}>
                  <span className="inline-flex items-center h-10 px-3 rounded-xl bg-hover text-muted text-xs border border-border">
                    {t('profile:requestSent')}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-border min-h-10"
                    disabled={!!actionLoading}
                    onClick={() => handleCancel(req.request_id)}
                    data-testid={`cancel-follow-${req.request_id}`}
                  >
                    {actionLoading === `cancel-${req.request_id}` ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <UserMinus size={14} className="mr-1" />
                        {t('profile:cancelFollowRequest', { defaultValue: 'Annuler la demande' })}
                      </>
                    )}
                  </Button>
                </RequestUserRow>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
