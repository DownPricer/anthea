export const BADGE_RARITY_STYLES = {
  Commun: {
    label: 'Commun',
    border: 'border-zinc-500/40',
    bg: 'bg-zinc-500/10',
    text: 'text-muted',
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
  'Super-héros': {
    label: 'Super-héros',
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.2)]',
  },
  Superhero: {
    label: 'Superhero',
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.2)]',
  },
  Superhéroe: {
    label: 'Superhéroe',
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.2)]',
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
    text: 'text-muted',
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
  superhero: {
    label: 'Super-héros',
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.2)]',
  },
};

export function getBadgeRarityStyle(rarity) {
  return BADGE_RARITY_STYLES[rarity] || BADGE_RARITY_STYLES.Commun;
}
