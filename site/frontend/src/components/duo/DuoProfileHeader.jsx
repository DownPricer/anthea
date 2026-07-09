import { Link } from 'react-router-dom';
import { Globe, Lock, Settings } from 'lucide-react';
import { UserAvatar } from '../UserAvatar';
import { Button } from '../ui/button';
import { DuoAvatar } from './DuoAvatar';
import { DuoFollowButton } from './DuoFollowButton';
import {
  formatDuoTag,
  getDuoGradientStyle,
  getDuoRelationLabel,
  isDuoLimited,
} from '../../lib/duoProfile';
import { formatHandle, getDisplayName, getPublicHandle } from '../../lib/userProfile';
import { resolveMediaUrl } from '../../lib/api';

export function DuoProfileHeader({ duoProfile, viewer, onEdit, onFollowUpdate, theme = 'default' }) {
  if (!duoProfile) {
    return (
      <div className="card p-5 border border-white/10">
        <p className="text-zinc-400 text-sm text-center">Profil duo en cours de configuration…</p>
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

  return (
    <div className="card overflow-hidden border border-white/10" data-testid="duo-profile-header">
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
                background: `linear-gradient(135deg, ${gradient.borderColor || '#1a1a2e'}44, #0A0A0A 70%)`,
              }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
      </div>

      <div className="p-5 -mt-10 relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <DuoAvatar duoProfile={duoProfile} members={members} className="w-16 h-16 text-lg" />
          <div className="flex flex-col gap-2 items-end shrink-0">
            {duoProfile.is_member && onEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onEdit}
                className="rounded-xl border-white/15 text-white"
                aria-label="Modifier le duo"
              >
                <Settings size={14} className="mr-1.5" />
                Réglages
              </Button>
            ) : (
              <DuoFollowButton duoProfile={duoProfile} onUpdate={onFollowUpdate} />
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white font-['Outfit']">{displayName}</h1>
        <p className="text-zinc-400 font-mono text-sm mt-1">{formatDuoTag(duoProfile) || '—'}</p>
        <p className="text-zinc-500 text-sm mt-1">{relationLabel}</p>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {duoProfile.account_visibility === 'public' ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-400/80">
              <Globe size={10} /> Public
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
              <Lock size={10} /> Privé
            </span>
          )}
          {duoProfile.followers_count != null ? (
            <span className="text-zinc-500 text-xs">{duoProfile.followers_count} abonné(s)</span>
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
                  className="rounded-xl bg-black/20 border border-white/5 p-3 flex items-center gap-3"
                >
                  <UserAvatar user={member} className="w-10 h-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">
                      {getDisplayName(member)}
                    </p>
                    <p className="text-zinc-500 text-xs">{formatHandle(member)}</p>
                  </div>
                  {!member.is_limited && profileHandle ? (
                    <Button asChild size="sm" variant="ghost" className="text-zinc-400 shrink-0">
                      <Link to={`/profile/${profileHandle}`}>Voir</Link>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : limited ? (
          <p className="text-zinc-500 text-sm mt-4">Ce profil duo est privé.</p>
        ) : null}
      </div>
    </div>
  );
}
