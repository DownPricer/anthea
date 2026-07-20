import { BadgeArtwork } from '../badges/BadgeArtwork';

/** Badge Duo mis en avant, compact et sans carte rectangulaire. */
export function FeaturedBadgeMini({ badge }) {
  if (!badge) return null;

  return (
    <div
      className="flex min-w-0 flex-col items-center text-center"
      title={badge.description || badge.name}
    >
      <BadgeArtwork
        rarity={badge.rarity_key || badge.rarity}
        iconKey={badge.icon_key || badge.icon || 'trophy'}
        locked={false}
        size={40}
        className="size-10 shrink-0"
      />
      <p className="mt-1 w-20 min-w-0 line-clamp-2 break-words text-center text-[10px] leading-tight text-zinc-300">
        {badge.name}
      </p>
    </div>
  );
}
