import { BadgeCard, BadgesGridShared } from '../badges/BadgeCard';

/**
 * Compatibilité Duo — même composant partagé que le catalogue Solo.
 */
export function DuoBadgeCard({ badge, onClick, compact = false }) {
  return <BadgeCard badge={badge} scope="duo" onClick={onClick} compact={compact} />;
}

export function DuoBadgesGrid({ badges = [], onBadgeClick, compact = false }) {
  return (
    <BadgesGridShared
      badges={badges}
      scope="duo"
      onBadgeClick={onBadgeClick}
      compact={compact}
    />
  );
}
