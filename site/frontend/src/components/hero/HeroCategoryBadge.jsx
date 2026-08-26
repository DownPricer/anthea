import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function HeroCategoryBadge({ className = '' }) {
  const { t } = useTranslation(['challenges']);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ${className}`}
      data-testid="hero-category-badge"
    >
      <Shield size={11} aria-hidden="true" className="text-emerald-300/90" />
      {t('challenges:hero.superHeroCategory')}
    </span>
  );
}
