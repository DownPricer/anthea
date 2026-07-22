import { UserPlus, UserMinus, Pencil, Lock, Heart, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '../UserAvatar';
import { ProfileFeaturedBadges } from './ProfileFeaturedBadges';
import { Button } from '../ui/button';
import {
  formatCount,
  formatHandle,
  getDisplayName,
  isProfilePrivate,
} from '../../lib/userProfile';

function StatItem({ value, label }) {
  return (
    <div className="text-center min-w-[3.75rem]">
      <p className="text-base sm:text-lg font-bold text-foreground font-['Outfit'] leading-tight">{value}</p>
      <p className="text-[10px] sm:text-[11px] text-subtle uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

export function ProfileHeader({
  profileUser,
  viewer,
  isOwn,
  badges = [],
  followersCount = 0,
  followingCount = 0,
  onEdit,
  onFollow,
  onUnfollow,
  isFollowing = false,
  isMutual = false,
  followLoading = false,
  followRequestPending = false,
  isLimited = false,
}) {
  const { t } = useTranslation(['profile', 'common']);
  const displayName = getDisplayName(profileUser);
  const handle = formatHandle(profileUser);
  const bio = profileUser?.bio?.trim();
  const featuredIds = Array.isArray(profileUser?.featured_badge_ids)
    ? profileUser.featured_badge_ids
    : Array.isArray(profileUser?.featured_badges) && profileUser.featured_badges.length
      ? profileUser.featured_badges.map((b) => (typeof b === 'string' ? b : b?.id)).filter(Boolean)
      : [];
  const showBadges = isOwn || !isLimited;

  return (
    <section className="card overflow-hidden" data-testid="profile-header">
      <div className="relative p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <UserAvatar
            user={profileUser}
            className="w-[72px] h-[72px] sm:w-20 sm:h-20 md:w-24 md:h-24 text-2xl sm:text-3xl ring-2 ring-border shrink-0 mx-auto sm:mx-0"
          />

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground font-['Outfit'] truncate leading-tight">
              {displayName}
            </h1>
            {handle ? (
              <p className="text-subtle text-xs sm:text-sm mt-0.5">{handle}</p>
            ) : (
              <p className="text-subtle text-xs sm:text-sm mt-0.5 italic">{t('profile:handleUndefined')}</p>
            )}

            <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-5 mt-2.5 sm:mt-3">
              <StatItem value={formatCount(followersCount)} label={t('profile:followers')} />
              <StatItem value={formatCount(followingCount)} label={t('profile:following')} />
            </div>

            {bio ? (
              <p className="text-muted text-xs sm:text-sm mt-2.5 sm:mt-3 leading-relaxed whitespace-pre-wrap break-words line-clamp-4">
                {bio}
              </p>
            ) : isOwn ? (
              <p className="text-subtle text-xs sm:text-sm mt-2.5 sm:mt-3 italic">{t('profile:bioPlaceholderOwn')}</p>
            ) : null}

            {showBadges ? (
              <div className="mt-2.5 sm:mt-3 flex w-full justify-center sm:justify-start">
                <ProfileFeaturedBadges badges={badges} featuredIds={featuredIds} showEmpty={isOwn} />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 mt-3 sm:mt-4 justify-center sm:justify-start">
              {isOwn ? (
                <Button
                  type="button"
                  onClick={onEdit}
                  data-testid="profile-edit-btn"
                  className="h-9 rounded-xl bg-active hover:bg-active text-foreground border border-border px-4 text-sm"
                >
                  <Pencil size={14} className="mr-1.5" />
                  {t('profile:editProfile')}
                </Button>
              ) : isLimited ? (
                followRequestPending ? (
                  <Button
                    type="button"
                    disabled
                    className="h-9 rounded-xl px-4 bg-hover text-muted border border-border text-sm"
                  >
                    {t('profile:requestSent')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={onFollow}
                    disabled={followLoading}
                    className="h-9 rounded-xl px-4 btn-primary text-foreground text-sm"
                  >
                    {followLoading ? (
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                    ) : (
                      <UserPlus size={14} className="mr-1.5" />
                    )}
                    {t('profile:requestFollow')}
                  </Button>
                )
              ) : isFollowing ? (
                <>
                  {isMutual ? (
                    <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--theme-primary)]/15 text-[var(--theme-primary)] text-xs sm:text-sm font-medium border border-[var(--theme-primary)]/25">
                      <Heart size={14} fill="currentColor" />
                      {t('profile:mutualFriend')}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    onClick={onUnfollow}
                    disabled={followLoading}
                    className="h-9 rounded-xl bg-active text-foreground border border-border px-4 hover:bg-active text-sm"
                  >
                    {followLoading ? (
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                    ) : (
                      <UserMinus size={14} className="mr-1.5" />
                    )}
                    {t('profile:unfollow')}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={onFollow}
                  disabled={followLoading}
                  className="h-9 rounded-xl px-4 btn-primary text-foreground text-sm"
                >
                  {followLoading ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <UserPlus size={14} className="mr-1.5" />
                  )}
                  {t('profile:follow')}
                </Button>
              )}
            </div>

            {isLimited && !isOwn ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-hover px-3 py-2 text-muted text-xs sm:text-sm">
                <Lock size={14} className="shrink-0" />
                <span>
                  {isMutual
                    ? t('profile:limitedMutual')
                    : isProfilePrivate(profileUser)
                      ? t('profile:limitedPrivate')
                      : t('profile:limitedHidden')}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
