import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveBadgeLabels } from '../../i18n/badgeLabels';

export function ProfileFeaturedBadges({ badges = [], featuredIds = [], showEmpty = true }) {
  const { t } = useTranslation(['profile', 'badges']);
  const featured = featuredIds
    .map((id) => badges.find((b) => String(b.id) === String(id) && b.unlocked))
    .filter(Boolean)
    .slice(0, 3);

  if (!featured.length) {
    if (!showEmpty) return null;
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 border border-white/5 sm:justify-start">
        <Trophy size={14} className="text-zinc-600 shrink-0" />
        <span className="text-zinc-600 text-xs">{t('featuredEmpty')}</span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 text-center sm:justify-start">
      {featured.map((badge) => {
        const { name, description } = resolveBadgeLabels(badge, t);
        return (
          <span
            key={badge.id}
            title={description || name}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--theme-primary)]/30 bg-[var(--theme-surface-active)] px-3 py-1.5 text-xs font-medium text-white"
          >
            <Trophy size={12} className="text-[var(--theme-primary)]" />
            {name}
          </span>
        );
      })}
    </div>
  );
}
