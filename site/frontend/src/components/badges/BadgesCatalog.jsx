import { useMemo, useState } from 'react';
import { BadgesGridShared } from './BadgeCard';
import { useBadgeDetail } from './BadgeDetailSheet';

const RARITY_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'common', label: 'Commun' },
  { id: 'rare', label: 'Rare' },
  { id: 'epic', label: 'Épique' },
  { id: 'legendary', label: 'Légendaire' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'unlocked', label: 'Débloqués' },
  { id: 'locked', label: 'À obtenir' },
];

function rarityKeyOf(badge) {
  const r = badge.rarity_key || badge.rarity || 'common';
  const map = {
    Commun: 'common',
    Rare: 'rare',
    Épique: 'epic',
    Légendaire: 'legendary',
    Diamant: 'legendary',
  };
  return map[r] || String(r).toLowerCase();
}

function sortBadges(list) {
  return [...list].sort((a, b) => {
    const aNew = a.unlocked && a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0;
    const bNew = b.unlocked && b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0;
    if (aNew !== bNew) return bNew - aNew;
    const aProg = a.unlocked ? 100 : Number(a.progress || 0);
    const bProg = b.unlocked ? 100 : Number(b.progress || 0);
    if (aProg !== bProg) return bProg - aProg;
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    const ar = rarityOrder[rarityKeyOf(a)] ?? 4;
    const br = rarityOrder[rarityKeyOf(b)] ?? 4;
    if (ar !== br) return ar - br;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

/**
 * Catalogue complet avec filtres rareté / statut.
 */
export function BadgesCatalogView({
  badges = [],
  summary = null,
  scope = 'solo',
  canPublish = true,
  pairKey = null,
  onShared,
  previewLimit = null,
}) {
  const [rarityFilter, setRarityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { handleBadgeClick, dialog } = useBadgeDetail(scope, {
    canPublish,
    pairKey,
    onShared,
  });

  const filtered = useMemo(() => {
    let list = badges.filter((b) => b.enabled !== false);
    if (rarityFilter !== 'all') {
      list = list.filter((b) => rarityKeyOf(b) === rarityFilter);
    }
    if (statusFilter === 'unlocked') {
      list = list.filter((b) => b.unlocked);
    } else if (statusFilter === 'locked') {
      list = list.filter((b) => !b.unlocked);
    }
    list = sortBadges(list);
    if (previewLimit != null) {
      list = list.slice(0, previewLimit);
    }
    return list;
  }, [badges, rarityFilter, statusFilter, previewLimit]);

  const unlocked = summary?.unlocked ?? badges.filter((b) => b.unlocked).length;
  const total = summary?.total ?? badges.length;

  return (
    <div className="space-y-4" data-testid="badges-catalog">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">
          {unlocked}/{total} débloqués
        </p>
      </div>

      {previewLimit == null && (
        <>
          <div className="flex flex-wrap gap-1.5" data-testid="badges-rarity-filters">
            {RARITY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRarityFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  rarityFilter === f.id
                    ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)]/40 text-white'
                    : 'border-white/10 text-zinc-500 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" data-testid="badges-status-filters">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  statusFilter === f.id
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'border-white/10 text-zinc-500 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {filtered.length === 0 ? (
        <p className="text-center text-zinc-500 text-sm py-10">Aucun badge dans ce filtre.</p>
      ) : (
        <BadgesGridShared
          badges={filtered}
          scope={scope}
          onBadgeClick={handleBadgeClick}
        />
      )}

      {dialog}
    </div>
  );
}

/**
 * Aperçu Stats : derniers débloqués + progression + CTA.
 */
export function BadgesPreview({
  badges = [],
  summary = null,
  scope = 'solo',
  onSeeAll,
  canPublish = true,
  pairKey = null,
  onShared,
  limit = 6,
}) {
  const unlocked = useMemo(
    () =>
      sortBadges(badges.filter((b) => b.unlocked)).slice(0, limit),
    [badges, limit]
  );
  const { handleBadgeClick, dialog } = useBadgeDetail(scope, {
    canPublish,
    pairKey,
    onShared,
  });
  const u = summary?.unlocked ?? badges.filter((b) => b.unlocked).length;
  const t = summary?.total ?? badges.length;

  return (
    <div className="space-y-3" data-testid="badges-preview">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {scope === 'duo' ? 'Badges Duo' : 'Mes badges'}
          </h3>
          <p className="text-zinc-500 text-xs mt-0.5">
            {u}/{t} · progression globale
          </p>
        </div>
        {onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs text-[var(--theme-primary)] hover:underline"
            data-testid="badges-see-all"
          >
            Voir tous les badges
          </button>
        ) : null}
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--theme-primary)] rounded-full transition-all"
          style={{ width: `${t ? Math.min(100, Math.round((u / t) * 100)) : 0}%` }}
        />
      </div>
      {unlocked.length > 0 ? (
        <BadgesGridShared
          badges={unlocked}
          scope={scope}
          onBadgeClick={handleBadgeClick}
          compact
        />
      ) : (
        <p className="text-zinc-600 text-xs text-center py-4">
          Aucun badge débloqué pour le moment.
        </p>
      )}
      {dialog}
    </div>
  );
}
