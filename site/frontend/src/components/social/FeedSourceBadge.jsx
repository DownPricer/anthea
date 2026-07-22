const LABELS = {
  friend: { text: 'Ami', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  following: { text: 'Abonnement', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  duo_followed: { text: 'Duo suivi', className: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  own_duo: { text: 'Mon duo', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  own: { text: 'Moi', className: 'bg-hover text-muted border-border' },
  trending: { text: 'Tendance', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
};

export function FeedSourceBadge({ source }) {
  if (!source || source === 'trending') return null;
  const cfg = LABELS[source] || LABELS.trending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border ${cfg.className}`}
    >
      {cfg.text}
    </span>
  );
}
