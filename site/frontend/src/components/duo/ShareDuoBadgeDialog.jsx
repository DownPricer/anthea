import { BadgeDetailSheet, useBadgeDetail } from '../badges/BadgeDetailSheet';

/**
 * Compatibilité — délègue à BadgeDetailSheet (handler unique Solo/Duo).
 */
export function ShareDuoBadgeDialog({ badge, open, onOpenChange, onShared }) {
  return (
    <BadgeDetailSheet
      badge={badge}
      open={open}
      onOpenChange={onOpenChange}
      scope="duo"
      canPublish
      onShared={onShared}
    />
  );
}

export function useDuoBadgePublish(onShared) {
  return useBadgeDetail('duo', { canPublish: true, onShared });
}
