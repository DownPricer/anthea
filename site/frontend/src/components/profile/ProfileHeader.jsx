import { UserPlus, UserMinus, Pencil, Lock, Heart, Loader2 } from 'lucide-react';
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
    <div className="text-center min-w-[4.5rem]">
      <p className="text-lg font-bold text-white font-['Outfit'] leading-tight">{value}</p>
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide mt-0.5">{label}</p>
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
    <section className="card overflow-hidden">
      <div className="relative px-5 pt-5 pb-4 md:px-8 md:pt-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <UserAvatar
            user={profileUser}
            className="w-24 h-24 sm:w-28 sm:h-28 text-3xl ring-2 ring-white/10 shrink-0 mx-auto sm:mx-0"
          />

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-white font-['Outfit'] truncate">{displayName}</h1>
            {handle ? (
              <p className="text-zinc-500 text-sm mt-0.5">{handle}</p>
            ) : (
              <p className="text-zinc-600 text-sm mt-0.5 italic">Arobase non défini</p>
            )}

            <div className="flex items-center justify-center sm:justify-start gap-5 mt-4">
              <StatItem value={formatCount(followersCount)} label="Abonnés" />
              <StatItem value={formatCount(followingCount)} label="Suivis" />
            </div>

            {bio ? (
              <p className="text-zinc-300 text-sm mt-4 leading-relaxed whitespace-pre-wrap break-words">
                {bio}
              </p>
            ) : isOwn ? (
              <p className="text-zinc-600 text-sm mt-4 italic">Ajoute une bio pour te présenter</p>
            ) : null}

            {showBadges ? (
              <div className="mt-4 flex w-full justify-center sm:justify-start">
                <ProfileFeaturedBadges badges={badges} featuredIds={featuredIds} showEmpty={isOwn} />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 mt-5 justify-center sm:justify-start">
              {isOwn ? (
                <Button
                  type="button"
                  onClick={onEdit}
                  data-testid="profile-edit-btn"
                  className="h-10 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 px-5"
                >
                  <Pencil size={16} className="mr-2" />
                  Modifier le profil
                </Button>
              ) : isLimited ? (
                followRequestPending ? (
                  <Button
                    type="button"
                    disabled
                    className="h-10 rounded-xl px-5 bg-white/5 text-zinc-400 border border-white/10"
                  >
                    Demande envoyée
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={onFollow}
                    disabled={followLoading}
                    className="h-10 rounded-xl px-5 btn-primary text-white"
                  >
                    {followLoading ? (
                      <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : (
                      <UserPlus size={16} className="mr-2" />
                    )}
                    Demander à suivre
                  </Button>
                )
              ) : isFollowing ? (
                <>
                  {isMutual ? (
                    <span className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[var(--theme-primary)]/15 text-[var(--theme-primary)] text-sm font-medium border border-[var(--theme-primary)]/25">
                      <Heart size={16} fill="currentColor" />
                      Ami mutuel
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    onClick={onUnfollow}
                    disabled={followLoading}
                    className="h-10 rounded-xl bg-white/10 text-white border border-white/15 px-5 hover:bg-white/15"
                  >
                    {followLoading ? (
                      <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : (
                      <UserMinus size={16} className="mr-2" />
                    )}
                    Ne plus suivre
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={onFollow}
                  disabled={followLoading}
                  className="h-10 rounded-xl px-5 btn-primary text-white"
                >
                  {followLoading ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <UserPlus size={16} className="mr-2" />
                  )}
                  Suivre
                </Button>
              )}
            </div>

            {isLimited && !isOwn ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-zinc-400 text-sm">
                <Lock size={16} className="shrink-0" />
                <span>
                  {isMutual
                    ? 'Vous êtes amis mutuels.'
                    : isProfilePrivate(profileUser)
                      ? 'Ce compte est privé. Seules les infos de base sont visibles.'
                      : 'Certaines informations sont masquées par cet utilisateur.'}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
