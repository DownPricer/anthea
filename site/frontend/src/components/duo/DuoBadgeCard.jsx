import { Trophy, Flame, Heart, Target, Medal, Zap, Crown, Star, MessageCircle, Users, Lock, ChevronRight } from 'lucide-react';

const ICON_MAP = {
  trophy: Trophy,
  flame: Flame,
  heart: Heart,
  target: Target,
  medal: Medal,
  zap: Zap,
  crown: Crown,
  star: Star,
  message: MessageCircle,
  users: Users,
};

/**
 * Carte badge Duo partagée (Stats + Voir tous).
 * Clic → onClick(badge) — le parent gère fiche / publication.
 */
export function DuoBadgeCard({ badge, onClick, compact = false }) {
  if (!badge) return null;
  const Icon = ICON_MAP[badge.icon] || Trophy;
  const unlocked = Boolean(badge.unlocked);

  return (
    <button
      type="button"
      onClick={() => onClick?.(badge)}
      title={`${badge.name} — ${badge.description || ''}`}
      data-testid={`duo-badge-card-${badge.id}`}
      className={`relative rounded-2xl p-3 text-center border transition-all w-[4.75rem] sm:w-[5.25rem] group ${
        unlocked
          ? 'bg-[var(--theme-surface-active)] border-[var(--theme-primary)]/40 cursor-pointer hover:scale-[1.04] hover:border-[var(--theme-primary)]/70'
          : 'bg-[#0A0A0A]/80 border-white/5 opacity-70 cursor-pointer hover:opacity-90'
      }`}
    >
      <div
        className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1.5 ${
          unlocked ? 'bg-[var(--theme-primary)]/20' : 'bg-white/5'
        }`}
      >
        {unlocked ? (
          <Icon size={compact ? 18 : 22} className="text-[var(--theme-primary)]" />
        ) : (
          <Lock size={compact ? 16 : 18} className="text-zinc-600" />
        )}
      </div>
      <p className={`text-[10px] leading-tight font-medium ${unlocked ? 'text-white' : 'text-zinc-500'}`}>
        {badge.name}
      </p>
      {!unlocked && (badge.target || 0) > 1 && (
        <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-600 rounded-full"
            style={{ width: `${badge.progress || 0}%` }}
          />
        </div>
      )}
      {unlocked && (
        <>
          <span className="absolute top-1 right-1 text-[8px] text-[var(--theme-primary)]">✓</span>
          <ChevronRight
            size={10}
            className="absolute bottom-1 right-1 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </>
      )}
    </button>
  );
}

export function DuoBadgesGrid({ badges = [], onBadgeClick, compact = false, showFamilyLabel = false }) {
  if (!badges.length) return null;

  const families = [...new Set(badges.map((b) => {
    const f = b.family || 'other';
    return { duo_social: 'duo', social_duo: 'duo', couple: 'duo' }[f] || f;
  }))];

  return (
    <div className="space-y-4 w-full" data-testid="duo-badges-grid">
      {families.map((family) => {
        const familyBadges = badges.filter((b) => {
          const f = b.family || 'other';
          const norm = { duo_social: 'duo', social_duo: 'duo', couple: 'duo' }[f] || f;
          return norm === family;
        });
        return (
          <div key={family} className="w-full flex flex-col items-center">
            {showFamilyLabel && !compact ? (
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2 text-center w-full">
                {family === 'duo' || family === 'duo_social' ? 'Duo' : family}
              </p>
            ) : null}
            <div className="flex w-full flex-wrap items-center justify-center gap-2 text-center">
              {familyBadges.map((badge) => (
                <DuoBadgeCard
                  key={badge.id}
                  badge={badge}
                  compact={compact}
                  onClick={onBadgeClick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
