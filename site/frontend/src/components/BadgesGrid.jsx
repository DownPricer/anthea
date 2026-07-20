import { BadgesGridShared } from './badges/BadgeCard';
import { useBadgeDetail } from './badges/BadgeDetailSheet';

/**
 * Grille legacy — délègue au composant partagé + fiche unique.
 */
export function BadgesGrid({ badges = [], compact = false, showShare = false }) {
  const { handleBadgeClick, dialog } = useBadgeDetail('solo', { canPublish: showShare });
  if (!badges.length) return null;

  return (
    <>
      <BadgesGridShared
        badges={badges}
        scope="solo"
        compact={compact}
        onBadgeClick={handleBadgeClick}
      />
      {dialog}
    </>
  );
}
