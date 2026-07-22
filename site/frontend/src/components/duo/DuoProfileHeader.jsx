import { Link } from 'react-router-dom';
import { Globe, Lock, Settings, LogOut } from 'lucide-react';
import { UserAvatar } from '../UserAvatar';
import { NotificationBell } from '../NotificationBell';
import { Button } from '../ui/button';
import { DuoMembersAvatar } from './DuoMembersAvatar';
import { DuoFollowButton } from './DuoFollowButton';
import {
  formatDuoTag,
  getDuoGradientStyle,
  getDuoRelationLabel,
  getDuoRoleLabel,
  isDuoLimited,
} from '../../lib/duoProfile';
import { formatHandle, getDisplayName, getPublicHandle } from '../../lib/userProfile';
import { resolveMediaUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { FeaturedBadgeMini } from './FeaturedBadgeMini';

export function DuoProfileHeader({
  duoProfile,
  viewer,
  onEdit,
  onFollowUpdate,
  theme = 'default',
  featuredBadges = [],
}) {
  const { user } = useAuth();
  if (!duoProfile) {
    return (
      <div className="card p-5 border border-border">
        <p className="text-muted text-sm text-center">Profil duo en cours de configuration…</p>
      </div>
    );
  }

  const members = Array.isArray(duoProfile.members) ? duoProfile.members : [];
  const memberA = members[0] || null;
  const memberB = members[1] || null;
  const gradient = memberA && memberB ? getDuoGradientStyle(memberA, memberB, theme) : {};
  const limited = isDuoLimited(duoProfile);
  const displayName = duoProfile.name || 'Duo';
  const relationLabel = getDuoRelationLabel(duoProfile.relation_type || 'partners');
  const bannerUrl = resolveMediaUrl(duoProfile.banner_url);
  const featured = Array.isArray(featuredBadges) ? featuredBadges.slice(0, 3) : [];

  return (
    <div className="card overflow-hidden border border-border" data-testid="duo-profile-header">
      <div
        className="h-28 sm:h-36 relative"
        style={
          bannerUrl
            ? {
                backgroundImage: `url(${bannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {
                background: `linear-gradient(135deg, ${gradient.borderColor || 'var(--theme-primary)'}44, var(--background) 70%)`,
              }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="p-5 -mt-10 relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <DuoMembersAvatar
            members={members}
            viewerId={user?.id || viewer?.id}
            size="lg"
          />
          <div className="flex flex-col gap-2 items-end shrink-0">
            {duoProfile.is_member && onEdit ? (
              <div className="flex items-center gap-2">
                <NotificationBell filter="duo" includeAll data-testid="duo-profile-notification-bell" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  asChild
                  className="rounded-xl border-border text-foreground h-9 w-9 p-0"
                  aria-label="Gérer ou quitter le duo"
                >
                  <Link to="/settings#partner-settings">
                    <LogOut size={14} />
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onEdit}
                  className="rounded-xl border-border text-foreground"
                  aria-label="Modifier le duo"
                >
                  <Settings size={14} className="mr-1.5" />
                  Réglages
                </Button>
              </div>
            ) : (
              <DuoFollowButton duoProfile={duoProfile} onUpdate={onFollowUpdate} />
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground font-['Outfit']">{displayName}</h1>
        <p className="text-muted font-mono text-sm mt-1">{formatDuoTag(duoProfile) || '—'}</p>
        <p className="text-subtle text-sm mt-1">{relationLabel}</p>

        {featured.length > 0 ? (
          <div
            className="mt-4 grid w-full grid-cols-3 items-start justify-items-center gap-2 sm:flex sm:justify-center sm:gap-4"
            data-testid="duo-featured-badges"
          >
            {featured.map((badge) => (
              <FeaturedBadgeMini key={badge.id} badge={badge} />
            ))}
          </div>
        ) : duoProfile.is_member ? (
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 text-left text-xs text-subtle transition-colors hover:text-muted"
          >
            Choisir des badges mis en avant
          </button>
        ) : null}

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {duoProfile.account_visibility === 'public' ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-400/80">
              <Globe size={10} /> Public
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-subtle">
              <Lock size={10} /> Privé
            </span>
          )}
          {duoProfile.followers_count != null ? (
            <span className="text-subtle text-xs">{duoProfile.followers_count} abonné(s)</span>
          ) : null}
        </div>

        {!limited && members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {members.map((member) => {
              if (!member?.id) return null;
              const profileHandle = getPublicHandle(member);
              return (
                <div
                  key={member.id}
                  className="rounded-xl bg-hover border border-border p-3 flex items-center gap-3 min-w-0 overflow-hidden"
                >
                  <UserAvatar user={member} className="w-10 h-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground font-medium text-sm truncate">
                      {getDisplayName(member)}
                    </p>
                    <p className="text-subtle text-xs truncate">{formatHandle(member)}</p>
                    {member.duo_role && member.duo_role !== 'member' ? (
                      <p className="text-[10px] text-[var(--theme-primary)]/80 mt-0.5">
                        {getDuoRoleLabel(member.duo_role)}
                      </p>
                    ) : null}
                  </div>
                  {!member.is_limited && profileHandle ? (
                    <Button asChild size="sm" variant="ghost" className="text-muted shrink-0">
                      <Link to={`/profile/${profileHandle}`}>Voir</Link>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : limited ? (
          <p className="text-subtle text-sm mt-4">Ce profil duo est privé.</p>
        ) : null}
      </div>
    </div>
  );
}
