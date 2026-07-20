import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, ChevronLeft, Loader2, UserPlus, Heart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { notificationsApi, usersApi, duoProfilesApi } from '../lib/api';
import { duoProfilePath } from '../lib/duoProfile';
import { UserAvatar } from '../components/UserAvatar';
import { getPublicHandle } from '../lib/userProfile';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { formatApiError } from '../lib/api';
import { PageHeader } from '../components/layout/PageHeader';

function notificationLabel(notif) {
  switch (notif.type) {
    case 'new_follower':
      return 'a commencé à te suivre';
    case 'follow_request':
      return 'demande à te suivre';
    case 'follow_accepted':
      return 'a accepté ta demande de suivi';
    case 'follow_back':
      return 'te suit en retour — vous êtes amis mutuels';
    case 'like':
      return 'a aimé ta publication';
    case 'comment':
      return 'a commenté ta publication';
    case 'duo_follow_request':
      return 'demande à suivre votre duo';
    case 'duo_follow_accepted':
      return 'a accepté votre demande de suivi duo';
    case 'badge_unlocked':
      return notif.body || `Vous avez obtenu « ${notif.badge_name || 'un badge'} ».`;
    case 'duo_badge_unlocked':
      return notif.body || `Votre Duo a obtenu « ${notif.badge_name || 'un badge'} ».`;
    default:
      return notif.body || 'nouvelle activité';
  }
}

function NotificationIcon({ type }) {
  if (type === 'follow_back') {
    return <Heart size={16} className="text-[var(--theme-primary)]" />;
  }
  return <UserPlus size={16} className="text-[var(--theme-primary)]" />;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterDuo = searchParams.get('filter') === 'duo';
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(null);
  const [requestLoading, setRequestLoading] = useState(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.list(30, filterDuo ? 'duo' : undefined);
      setNotifications(data || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [filterDuo]);

  const displayedNotifications = useMemo(() => {
    if (!filterDuo) return notifications;
    return notifications.filter((n) => n.type?.startsWith('duo_'));
  }, [notifications, filterDuo]);

  useEffect(() => {
    loadNotifications();
    notificationsApi.markAllRead().catch(() => {});
    window.dispatchEvent(new CustomEvent('notifications:read'));
  }, [loadNotifications]);

  const handleFollowBack = async (notif) => {
    const handle = notif.actor_handle || notif.actor_username;
    if (!handle) return;

    setFollowLoading(notif.id);
    try {
      await usersApi.follow(handle);
      toast.success('Tu suis cet utilisateur !');
      await loadNotifications();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setFollowLoading(null);
    }
  };

  const handleAcceptFollowRequest = async (notif) => {
    if (!notif.request_id) return;
    setRequestLoading(notif.id);
    try {
      await usersApi.acceptFollowRequest(notif.request_id);
      toast.success('Demande acceptée');
      await loadNotifications();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRequestLoading(null);
    }
  };

  const handleRejectFollowRequest = async (notif) => {
    if (!notif.request_id) return;
    setRequestLoading(notif.id);
    try {
      await usersApi.rejectFollowRequest(notif.request_id);
      toast.success('Demande refusée');
      await loadNotifications();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRequestLoading(null);
    }
  };

  const handleAcceptDuoFollowRequest = async (notif) => {
    if (!notif.request_id) return;
    setRequestLoading(notif.id);
    try {
      await duoProfilesApi.acceptFollowRequest(notif.request_id);
      toast.success('Demande duo acceptée');
      await loadNotifications();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRequestLoading(null);
    }
  };

  const handleRejectDuoFollowRequest = async (notif) => {
    if (!notif.request_id) return;
    setRequestLoading(notif.id);
    try {
      await duoProfilesApi.rejectFollowRequest(notif.request_id);
      toast.success('Demande duo refusée');
      await loadNotifications();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRequestLoading(null);
    }
  };

  return (
    <div data-testid="notifications-page" className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle={filterDuo ? 'Activité de votre Duo' : 'Votre activité récente'}
        leading={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:text-white"
            aria-label="Retour"
          >
            <ChevronLeft size={20} />
          </button>
        }
      />

      <div className="flex gap-2 mb-4">
        <Button
          type="button"
          size="sm"
          variant={filterDuo ? 'outline' : 'default'}
          className={`rounded-full ${filterDuo ? 'border-white/15 text-white' : 'btn-primary text-white'}`}
          onClick={() => navigate('/notifications')}
        >
          Toutes
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filterDuo ? 'default' : 'outline'}
          data-testid="notifications-filter-duo"
          className={`rounded-full ${filterDuo ? 'btn-primary text-white' : 'border-white/15 text-white'}`}
          onClick={() => navigate('/notifications?filter=duo')}
        >
          Duo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
        </div>
      ) : displayedNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell size={32} className="text-zinc-600 mb-3" />
          <p className="text-zinc-400 text-sm">
            {filterDuo ? 'Aucune notification duo pour l\'instant.' : 'Aucune notification pour l\'instant.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedNotifications.map((notif) => {
            const handle = getPublicHandle({
              handle: notif.actor_handle,
              username: notif.actor_username,
            });
            const actor = {
              id: notif.actor_id,
              username: notif.actor_username,
              handle: notif.actor_handle,
              display_name: notif.actor_display_name,
              avatar_url: notif.actor_avatar_url,
            };
            const dateLabel = notif.created_at
              ? format(parseISO(notif.created_at), "d MMM 'à' HH:mm", { locale: fr })
              : '';

            return (
              <div
                key={notif.id}
                className={`card p-4 flex items-start gap-3 ${
                  !notif.read ? 'border-[var(--theme-primary)]/20 bg-[var(--theme-surface-active)]/30' : ''
                }`}
              >
                <Link to={`/profile/${handle}`} className="shrink-0">
                  <UserAvatar user={actor} className="w-11 h-11 text-base" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <NotificationIcon type={notif.type} />
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      <Link
                        to={`/profile/${handle}`}
                        className="font-medium text-white hover:underline"
                      >
                        {notif.actor_display_name || notif.actor_username}
                      </Link>{' '}
                      {notificationLabel(notif)}
                    </p>
                  </div>
                  <p className="text-zinc-600 text-xs mt-1.5">{dateLabel}</p>
                  {notif.type === 'duo_follow_request' && notif.request_id ? (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        disabled={requestLoading === notif.id}
                        onClick={() => handleAcceptDuoFollowRequest(notif)}
                        className="h-8 rounded-lg btn-primary text-white text-xs"
                      >
                        Accepter
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={requestLoading === notif.id}
                        onClick={() => handleRejectDuoFollowRequest(notif)}
                        className="h-8 rounded-lg border-white/15 text-zinc-300 text-xs"
                      >
                        Refuser
                      </Button>
                      {notif.duo_tag ? (
                        <Button asChild size="sm" variant="ghost" className="h-8 text-xs text-zinc-400">
                          <Link to={duoProfilePath(notif.duo_tag)}>Voir le duo</Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {notif.type === 'follow_request' && notif.request_id ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={requestLoading === notif.id}
                        onClick={() => handleAcceptFollowRequest(notif)}
                        className="h-8 rounded-lg btn-primary text-white text-xs"
                      >
                        Accepter
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={requestLoading === notif.id}
                        onClick={() => handleRejectFollowRequest(notif)}
                        className="h-8 rounded-lg border-white/15 text-zinc-300 text-xs"
                      >
                        Refuser
                      </Button>
                    </div>
                  ) : null}
                  {notif.type === 'new_follower' ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={followLoading === notif.id}
                      onClick={() => handleFollowBack(notif)}
                      className="mt-3 h-9 rounded-full px-4 btn-primary text-white text-xs"
                    >
                      {followLoading === notif.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        'Suivre en retour'
                      )}
                    </Button>
                  ) : null}
                  {notif.type === 'badge_unlocked' ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="mt-3 h-8 rounded-lg border-white/15 text-zinc-300 text-xs"
                    >
                      <Link to={notif.url || '/badges?scope=solo'}>Voir mes badges</Link>
                    </Button>
                  ) : null}
                  {notif.type === 'duo_badge_unlocked' ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="mt-3 h-8 rounded-lg border-white/15 text-zinc-300 text-xs"
                    >
                      <Link to={notif.url || '/duo?tab=stats&section=badges'}>Voir les badges Duo</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
