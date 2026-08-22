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

function StatItem({ value, label, onClick, clickable = false }) {
  const Tag = clickable && onClick ? 'button' : 'div';
  return (
    <Tag
      type={clickable && onClick ? 'button' : undefined}
      onClick={clickable ? onClick : undefined}
      className={`text-center min-w-[3.25rem] ${clickable && onClick ? 'cursor-pointer hover:opacity-80 transition-opacity rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]' : ''}`}
      data-testid={clickable ? `stat-${label}` : undefined}
    >
      <p className="text-sm sm:text-base font-bold text-foreground font-['Outfit'] leading-tight">{value}</p>
      <p className="text-[10px] sm:text-[11px] text-subtle uppercase tracking-wide mt-0.5">{label}</p>
    </Tag>
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
  onCancelFollowRequest,
  onFollowersClick,
  onFollowingClick,
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
      <div className="relative p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-3">
          <UserAvatar
            user={profileUser}
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-[88px] md:h-[88px] text-xl sm:text-2xl ring-2 ring-border shrink-0 mx-auto sm:mx-0"
          />

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-lg sm:text-xl font-bold text-foreground font-['Outfit'] truncate leading-tight">
              {displayName}
            </h1>
            {handle ? (
              <p className="text-subtle text-xs sm:text-sm mt-0.5">{handle}</p>
            ) : (
              <p className="text-subtle text-xs sm:text-sm mt-0.5 italic">{t('profile:handleUndefined')}</p>
            )}

            <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-3.5 mt-2 sm:mt-2.5">
              <StatItem
                value={formatCount(followersCount)}
                label={t('profile:followers')}
                clickable={!isLimited || isOwn}
                onClick={onFollowersClick}
              />
              <StatItem
                value={formatCount(followingCount)}
                label={t('profile:following')}
                clickable={!isLimited || isOwn}
                onClick={onFollowingClick}
              />
            </div>

            {bio ? (
              <p className="text-muted text-xs sm:text-sm mt-2 sm:mt-2.5 leading-snug whitespace-pre-wrap break-words line-clamp-4">
                {bio}
              </p>
            ) : isOwn ? (
              <p className="text-subtle text-xs sm:text-sm mt-2 sm:mt-2.5 italic">{t('profile:bioPlaceholderOwn')}</p>
            ) : null}

            {showBadges ? (
              <div className="mt-2 sm:mt-2.5 flex w-full justify-center sm:justify-start">
                <ProfileFeaturedBadges badges={badges} featuredIds={featuredIds} showEmpty={isOwn} />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 mt-2.5 sm:mt-3 justify-center sm:justify-start">
              {isOwn ? (
                <Button
                  type="button"
                  onClick={onEdit}
                  data-testid="profile-edit-btn"
                  className="h-8 sm:h-9 rounded-xl bg-active hover:bg-active text-foreground border border-border px-3 sm:px-4 text-sm"
                >
                  <Pencil size={14} className="mr-1.5" />
                  {t('profile:editProfile')}
                </Button>
              ) : isLimited ? (
                followRequestPending ? (
                  <>
                    <Button
                      type="button"
                      disabled
                      className="h-8 sm:h-9 rounded-xl px-3 sm:px-4 bg-hover text-muted border border-border text-sm"
                    >
                      {t('profile:requestSent')}
                    </Button>
                    {onCancelFollowRequest ? (
                      <Button
                        type="button"
                        onClick={onCancelFollowRequest}
                        disabled={followLoading}
                        variant="outline"
                        className="h-8 sm:h-9 rounded-xl px-3 sm:px-4 border-border text-sm min-h-10"
                        data-testid="cancel-follow-request-btn"
                      >
                        {followLoading ? (
                          <Loader2 size={14} className="mr-1.5 animate-spin" />
                        ) : null}
                        {t('profile:cancelFollowRequest', { defaultValue: 'Annuler la demande' })}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={onFollow}
                    disabled={followLoading}
                    className="h-8 sm:h-9 rounded-xl px-3 sm:px-4 btn-primary text-foreground text-sm"
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
                    <span className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-3 rounded-xl bg-[var(--theme-primary)]/15 text-[var(--theme-primary)] text-xs sm:text-sm font-medium border border-[var(--theme-primary)]/25">
                      <Heart size={14} fill="currentColor" />
                      {t('profile:mutualFriend')}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    onClick={onUnfollow}
                    disabled={followLoading}
                    className="h-8 sm:h-9 rounded-xl bg-active text-foreground border border-border px-3 sm:px-4 hover:bg-active text-sm"
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
                  className="h-8 sm:h-9 rounded-xl px-3 sm:px-4 btn-primary text-foreground text-sm"
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
              <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-hover px-3 py-1.5 text-muted text-xs sm:text-sm">
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
