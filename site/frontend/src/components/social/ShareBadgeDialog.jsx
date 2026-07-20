import { useState } from 'react';
import { BadgeDetailSheet } from '../badges/BadgeDetailSheet';

/**
 * Compatibilité Solo — même fiche que le catalogue.
 */
export function ShareBadgeDialog({ badge, open, onOpenChange, onShared }) {
  return (
    <BadgeDetailSheet
      badge={badge}
      open={open}
      onOpenChange={onOpenChange}
      scope="solo"
      canPublish
      onShared={onShared}
    />
  );
}

export function ShareBadgeButton({ badge, className = '' }) {
  const [open, setOpen] = useState(false);
  if (!badge?.unlocked) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-[var(--theme-primary)] hover:underline text-xs ${className}`}
      >
        Partager
      </button>
      <ShareBadgeDialog badge={badge} open={open} onOpenChange={setOpen} />
    </>
  );
}
