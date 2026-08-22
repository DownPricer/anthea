import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, UserPlus, UserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usersApi, formatApiError } from '../../lib/api';
import { UserAvatar } from '../UserAvatar';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { getPublicHandle } from '../../lib/userProfile';

function ConnectionRow({ person, onFollowChange, followLoading }) {
  const { t } = useTranslation(['profile', 'common']);
  const handle = getPublicHandle(person);
  const isOwn = person.is_own;
  const isFollowing = person.is_following;
  const pending = person.follow_request_pending;

  const handleFollow = async () => {
    if (!handle) return;
    await onFollowChange(handle, 'follow');
  };

  const handleUnfollow = async () => {
    if (!handle) return;
    await onFollowChange(handle, 'unfollow');
  };

  return (
    <div className="flex items-center gap-3 py-2.5" data-testid="connection-row">
      <Link to={handle ? `/profile/${handle}` : '#'} className="shrink-0">
        <UserAvatar user={person} className="w-10 h-10" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={handle ? `/profile/${handle}` : '#'}
          className="font-medium text-foreground text-sm hover:underline truncate block"
        >
          {person.display_name || person.username}
        </Link>
        {handle ? <p className="text-subtle text-xs truncate">{handle}</p> : null}
      </div>
      {!isOwn ? (
        <div className="shrink-0">
          {pending ? (
            <span className="text-xs text-muted px-2 py-1 rounded-lg bg-hover border border-border">
              {t('profile:requestSent')}
            </span>
          ) : isFollowing ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl min-h-10"
              disabled={followLoading === handle}
              onClick={handleUnfollow}
            >
              {followLoading === handle ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <UserMinus size={14} className="mr-1" />
                  {t('profile:unfollow')}
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="rounded-xl btn-primary text-foreground min-h-10"
              disabled={followLoading === handle}
              onClick={handleFollow}
            >
              {followLoading === handle ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <UserPlus size={14} className="mr-1" />
                  {t('profile:follow')}
                </>
              )}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function UserConnectionsModal({ open, onOpenChange, handle, mode, profileUserId }) {
  const { t } = useTranslation(['profile']);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [followLoading, setFollowLoading] = useState(null);

  const title =
    mode === 'followers'
      ? t('profile:followersModalTitle', { defaultValue: 'Abonnés' })
      : t('profile:followingModalTitle', { defaultValue: 'Abonnements' });

  const fetchList = useCallback(
    async (cursor = null, append = false) => {
      if (!handle) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const apiFn = mode === 'followers' ? usersApi.getFollowers : usersApi.getFollowing;
        const { data } = await apiFn(handle, { limit: 30, cursor });
        const newItems = data?.items || [];
        setItems((prev) => (append ? [...prev, ...newItems] : newItems));
        setNextCursor(data?.next_cursor || null);
        setHasMore(!!data?.has_more);
      } catch (error) {
        toast.error(formatApiError(error));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [handle, mode]
  );

  useEffect(() => {
    if (!open || !handle) return;
    setItems([]);
    setNextCursor(null);
    fetchList(null, false);
  }, [open, handle, mode, fetchList]);

  const handleFollowChange = async (targetHandle, action) => {
    setFollowLoading(targetHandle);
    try {
      if (action === 'follow') {
        const { data } = await usersApi.follow(targetHandle);
        setItems((prev) =>
          prev.map((p) => {
            const ph = getPublicHandle(p);
            if (ph !== targetHandle) return p;
            return {
              ...p,
              is_following: !!data.is_following,
              follow_request_pending: !!data.follow_request_pending,
              is_mutual: !!data.is_mutual,
            };
          })
        );
      } else {
        await usersApi.unfollow(targetHandle);
        setItems((prev) =>
          prev.map((p) => {
            const ph = getPublicHandle(p);
            if (ph !== targetHandle) return p;
            return { ...p, is_following: false, is_mutual: false, follow_request_pending: false };
          })
        );
      }
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setFollowLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-surface-elevated border-border max-w-md w-[calc(100vw-1.5rem)] max-h-[min(85vh,640px)] flex flex-col p-0"
        data-testid={`connections-modal-${mode}`}
      >
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle className="text-foreground font-['Outfit']">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-7 h-7 animate-spin text-[var(--theme-primary)]" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">
              {mode === 'followers'
                ? t('profile:emptyFollowers', { defaultValue: 'Aucun abonné.' })
                : t('profile:emptyFollowing', { defaultValue: 'Aucun abonnement.' })}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((person) => (
                <ConnectionRow
                  key={person.id}
                  person={{
                    ...person,
                    is_own: person.id === profileUserId,
                  }}
                  onFollowChange={handleFollowChange}
                  followLoading={followLoading}
                />
              ))}
            </div>
          )}
          {hasMore ? (
            <div className="pt-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl min-h-10 w-full"
                disabled={loadingMore}
                onClick={() => fetchList(nextCursor, true)}
              >
                {loadingMore ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  t('profile:loadMoreConnections', { defaultValue: 'Charger plus' })
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
