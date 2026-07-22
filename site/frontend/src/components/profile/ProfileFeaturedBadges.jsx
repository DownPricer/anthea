import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveBadgeLabels } from '../../i18n/badgeLabels';
import { BadgeArtwork, normalizeBadgeRarityKey } from '../badges/BadgeArtwork';

export function ProfileFeaturedBadges({ badges = [], featuredIds = [], showEmpty = true }) {
  const { t } = useTranslation(['profile', 'badges']);
  const featured = featuredIds
    .map((id) => badges.find((b) => String(b.id) === String(id) && b.unlocked))
    .filter(Boolean)
    .slice(0, 3);

  if (!featured.length) {
    if (!showEmpty) return null;
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-hover px-2.5 py-1.5 border border-border sm:justify-start">
        <Trophy size={12} className="text-subtle shrink-0" />
        <span className="text-subtle text-[11px]">{t('featuredEmpty')}</span>
      </div>
    );
  }

  return (
    <div
      className="flex w-full flex-wrap items-start justify-center gap-2 sm:gap-2.5 text-center sm:justify-start"
      data-testid="profile-featured-badges"
    >
      {featured.map((badge) => {
        const { name, description } = resolveBadgeLabels(badge, t);
        const rarityKey = normalizeBadgeRarityKey(badge.rarity_key || badge.rarity);
        return (
          <div
            key={badge.id}
            title={description || name}
            className="inline-flex w-[4.5rem] flex-col items-center gap-1"
          >
            <BadgeArtwork
              rarity={rarityKey}
              iconKey={badge.icon_key || badge.icon || 'trophy'}
              locked={false}
              size={36}
            />
            <span className="text-[10px] leading-tight text-muted line-clamp-2 w-full">
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
