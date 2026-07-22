import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, ChevronLeft, Loader2, UserPlus, Heart, Trophy } from 'lucide-react';
import { parseISO } from 'date-fns';
import { notificationsApi, usersApi, duoProfilesApi } from '../lib/api';
import { duoProfilePath } from '../lib/duoProfile';
import { UserAvatar } from '../components/UserAvatar';
import { getPublicHandle } from '../lib/userProfile';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { formatApiError } from '../lib/api';
import { PageHeader } from '../components/layout/PageHeader';
import { useTranslation } from 'react-i18next';
import { useLocaleFormat } from '../hooks/useLocaleFormat';
import { getBadgeName } from '../i18n/badgeLabels';
import { BadgeArtwork } from '../components/badges/BadgeArtwork';
import {
  badgeNotificationDeepLink,
  isBadgeUnlockNotification,
} from '../lib/badgeNotificationLink';

function isBadgeNotif(type) {
  return isBadgeUnlockNotification(type);
}

function NotificationIcon({ type }) {
  if (isBadgeNotif(type)) {
    return <Trophy size={16} className="text-[var(--theme-primary)]" />;
  }
  if (type === 'follow_back') {
    return <Heart size={16} className="text-[var(--theme-primary)]" />;
  }
  return <UserPlus size={16} className="text-[var(--theme-primary)]" />;
}

function badgeDeepLink(notif) {
  return badgeNotificationDeepLink(notif);
}

export function NotificationsPage() {
  const { t } = useTranslation(['notifications', 'badges', 'common']);
  const { formatDateTime } = useLocaleFormat();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterDuo = searchParams.get('filter') === 'duo';
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(null);
  const [requestLoading, setRequestLoading] = useState(null);

  const resolveBadgeName = useCallback(
    (notif) => {
      return getBadgeName(
        notif.badge_id || notif.translation_params?.badge_id,
        t,
        notif.badge_name || t('notifications:types.aBadge')
      );
    },
    [t]
  );

  const badgeCopy = useCallback(
    (notif) => {
      const badge = resolveBadgeName(notif);
      const isDuo = notif.type === 'duo_badge_unlocked';
      const prefix = isDuo ? 'notifications:duoBadgeUnlocked' : 'notifications:badgeUnlocked';
      return {
        title: t(`${prefix}.title`),
        body: t(`${prefix}.body`, { badge }),
        cta: t(`${prefix}.viewMyBadge`),
      };
    },
    [t, resolveBadgeName]
  );

  const notificationLabel = useCallback(
    (notif) => {
      const typeKey = `notifications:types.${notif.type}`;
      const hasTypeKey = notif.type && t(typeKey, { defaultValue: '__missing__' }) !== '__missing__';

      switch (notif.type) {
        case 'badge_unlocked':
          return t('notifications:types.badge_unlocked', { badge: resolveBadgeName(notif) });
        case 'duo_badge_unlocked':
          return t('notifications:types.duo_badge_unlocked', { badge: resolveBadgeName(notif) });
        default:
          if (hasTypeKey) {
            return t(typeKey, {
              badge: resolveBadgeName(notif),
              actor: notif.actor_display_name || notif.actor_username || '',
            });
          }
          return notif.body || t('notifications:types.default');
      }
    },
    [t, resolveBadgeName]
  );

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
      toast.success(t('notifications:toasts.following'));
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
      toast.success(t('notifications:toasts.accepted'));
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
      toast.success(t('notifications:toasts.rejected'));
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
      toast.success(t('notifications:toasts.duoAccepted'));
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
      toast.success(t('notifications:toasts.duoRejected'));
      await loadNotifications();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRequestLoading(null);
    }
  };

  return (
    <div className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto" data-testid="notifications-page">
      <PageHeader
        title={t('notifications:title')}
        subtitle={filterDuo ? t('notifications:subtitleDuo') : t('notifications:subtitle')}
        leading={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:text-white"
            aria-label={t('common:aria.back')}
          >
            <ChevronLeft size={20} />
          </button>
        }
      />

      <div className="mb-4 flex gap-2">
        <Link
          to="/notifications"
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            !filterDuo
              ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)]/40 text-white'
              : 'border-white/10 text-zinc-500'
          }`}
        >
          {t('notifications:filters.all')}
        </Link>
        <Link
          to="/notifications?filter=duo"
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            filterDuo
              ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)]/40 text-white'
              : 'border-white/10 text-zinc-500'
          }`}
        >
          {t('notifications:filters.duo')}
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
        </div>
      ) : displayedNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell size={32} className="text-zinc-600 mb-3" />
          <p className="text-zinc-400 text-sm">
            {filterDuo ? t('notifications:emptyDuo') : t('notifications:empty')}
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
            const dateLabel = notif.created_at ? formatDateTime(parseISO(notif.created_at)) : '';
            const badgeNotif = isBadgeNotif(notif.type);
            const copy = badgeNotif ? badgeCopy(notif) : null;
            const deepLink = badgeNotif ? badgeDeepLink(notif) : null;

            return (
              <div
                key={notif.id}
                className={`card p-4 flex items-start gap-3 ${
                  !notif.read ? 'border-[var(--theme-primary)]/20 bg-[var(--theme-surface-active)]/30' : ''
                }`}
                data-testid={badgeNotif ? 'notification-badge-unlock' : undefined}
              >
                {badgeNotif ? (
                  <div className="shrink-0 w-11 h-11 rounded-full bg-[var(--theme-primary)]/15 border border-[var(--theme-primary)]/25 flex items-center justify-center overflow-hidden">
                    {notif.badge_id ? (
                      <BadgeArtwork
                        rarity={notif.badge_rarity || 'common'}
                        iconKey={notif.badge_icon || 'trophy'}
                        locked={false}
                        size={40}
                      />
                    ) : (
                      <Trophy size={20} className="text-[var(--theme-primary)]" />
                    )}
                  </div>
                ) : (
                  <Link to={`/profile/${handle}`} className="shrink-0">
                    <UserAvatar user={actor} className="w-11 h-11 text-base" />
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  {badgeNotif ? (
                    <div className="flex items-start gap-2">
                      <NotificationIcon type={notif.type} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white leading-snug">{copy.title}</p>
                        <p className="text-sm text-zinc-300 leading-relaxed mt-0.5">{copy.body}</p>
                      </div>
                    </div>
                  ) : (
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
                  )}
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
                        {t('notifications:actions.accept')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={requestLoading === notif.id}
                        onClick={() => handleRejectDuoFollowRequest(notif)}
                        className="h-8 rounded-lg border-white/15 text-zinc-300 text-xs"
                      >
                        {t('notifications:actions.reject')}
                      </Button>
                      {notif.duo_tag ? (
                        <Button asChild size="sm" variant="ghost" className="h-8 text-xs text-zinc-400">
                          <Link to={duoProfilePath(notif.duo_tag)}>{t('notifications:actions.seeDuo')}</Link>
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
                        {t('notifications:actions.accept')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={requestLoading === notif.id}
                        onClick={() => handleRejectFollowRequest(notif)}
                        className="h-8 rounded-lg border-white/15 text-zinc-300 text-xs"
                      >
                        {t('notifications:actions.reject')}
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
                        t('notifications:actions.followBack')
                      )}
                    </Button>
                  ) : null}
                  {badgeNotif ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="mt-3 h-8 rounded-lg border-white/15 text-zinc-300 text-xs"
                    >
                      <Link to={deepLink}>{copy.cta}</Link>
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
