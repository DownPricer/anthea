export const BADGE_RARITY_STYLES = {
  Commun: {
    label: 'Commun',
    border: 'border-zinc-500/40',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-300',
    glow: '',
  },
  Rare: {
    label: 'Rare',
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/10',
    text: 'text-blue-300',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  },
  Épique: {
    label: 'Épique',
    border: 'border-purple-500/50',
    bg: 'bg-purple-500/10',
    text: 'text-purple-300',
    glow: 'shadow-[0_0_24px_rgba(168,85,247,0.2)]',
  },
  Légendaire: {
    label: 'Légendaire',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_28px_rgba(245,158,11,0.25)]',
  },
  Diamant: {
    label: 'Légendaire',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_28px_rgba(245,158,11,0.25)]',
  },
  common: {
    label: 'Commun',
    border: 'border-zinc-500/40',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-300',
    glow: '',
  },
  rare: {
    label: 'Rare',
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/10',
    text: 'text-blue-300',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  },
  epic: {
    label: 'Épique',
    border: 'border-purple-500/50',
    bg: 'bg-purple-500/10',
    text: 'text-purple-300',
    glow: 'shadow-[0_0_24px_rgba(168,85,247,0.2)]',
  },
  legendary: {
    label: 'Légendaire',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_28px_rgba(245,158,11,0.25)]',
  },
};

export function getBadgeRarityStyle(rarity) {
  return BADGE_RARITY_STYLES[rarity] || BADGE_RARITY_STYLES.Commun;
}
