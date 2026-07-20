import { BadgeArtwork, normalizeBadgeRarityKey } from './BadgeArtwork';
import { getBadgeRarityStyle } from '../../lib/badgeStyles';

/**
 * Carte badge partagée — taille indépendante de la longueur du nom.
 */
export function BadgeCard({ badge, scope = 'solo', onClick, compact = false }) {
  if (!badge) return null;

  const unlocked = Boolean(badge.unlocked);
  const rarityKey = normalizeBadgeRarityKey(badge.rarity_key || badge.rarity);
  const rarityStyle = getBadgeRarityStyle(badge.rarity);
  const isSecret = Boolean(badge.is_secret) && !unlocked;
  const name = isSecret ? 'Succès secret' : badge.name;
  const progress = typeof badge.progress === 'number' ? badge.progress : 0;
  const current = badge.current;
  const target = badge.target;
  const artSize = compact ? 48 : 56;

  const progressLabel = () => {
    if (unlocked) return null;
    if (current != null && typeof current === 'object') return null;
    if (target != null && current != null) return `${current} / ${target}`;
    return null;
  };

  return (
    <button
      type="button"
      onClick={() => onClick?.(badge)}
      title={`${name} — ${badge.description || ''}`}
      data-testid={`badge-card-${badge.id}`}
      data-scope={scope}
      className={`relative min-w-0 overflow-hidden rounded-2xl p-2.5 text-center border transition-all w-[5.25rem] sm:w-[5.5rem] group ${
        unlocked
          ? `${rarityStyle.bg} ${rarityStyle.border} cursor-pointer hover:scale-[1.02]`
          : 'bg-[#0A0A0A]/80 border-white/5 opacity-80 cursor-pointer hover:opacity-100'
      }`}
    >
      <BadgeArtwork
        rarity={rarityKey}
        iconKey={badge.icon_key || badge.icon || 'trophy'}
        locked={!unlocked}
        size={artSize}
        className="mx-auto shrink-0 size-12 sm:size-14"
      />
      <p
        className={`mt-1.5 min-w-0 line-clamp-2 break-words text-center text-[10px] leading-tight font-medium ${
          unlocked ? 'text-white' : 'text-zinc-500'
        }`}
      >
        {name}
      </p>
      {!unlocked && (typeof target === 'number' ? target > 1 : true) && typeof progress === 'number' && (
        <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-zinc-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {progressLabel() ? (
        <p className="text-[9px] text-zinc-600 mt-0.5 truncate">{progressLabel()}</p>
      ) : null}
      {unlocked && (
        <span className={`absolute top-1 right-1 text-[8px] ${rarityStyle.text}`}>✓</span>
      )}
    </button>
  );
}

export function BadgesGridShared({ badges = [], scope = 'solo', onBadgeClick, compact = false }) {
  if (!badges.length) return null;
  return (
    <div className="flex w-full flex-wrap items-start justify-center gap-2" data-testid="badges-grid-shared">
      {badges.map((badge) => (
        <BadgeCard
          key={badge.id}
          badge={badge}
          scope={scope}
          compact={compact}
          onClick={onBadgeClick}
        />
      ))}
    </div>
  );
}
