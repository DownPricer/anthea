import { useTranslation } from 'react-i18next';
import { HeroThemePattern } from './HeroThemePattern';

export function HeroPostCard({ post }) {
  const { t } = useTranslation(['challenges']);
  const result = post?.hero_result || {};
  const themeId = result.visual_theme?.id || result.profile_theme_id || 'spiderman';
  const rounds = result.rounds ?? 0;
  const reps = result.total_reps;
  const minutes = Math.round((result.duration_seconds || 0) / 60) || 20;
  const name = result.character_name || result.title || post.title;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border min-h-[140px]"
      data-testid="hero-post-card"
      data-hero-theme={themeId}
    >
      <HeroThemePattern themeId={themeId} />
      <div className="relative p-4 text-white">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">
          {t('challenges:hero.challengeWon')}
        </p>
        <h3 className="text-lg font-semibold font-['Outfit']">
          {t('challenges:hero.successTitle', { name })}
        </h3>
        <p className="text-sm mt-1 text-white/90">
          {t('challenges:hero.postScore', { rounds, reps: reps || '—', minutes })}
        </p>
      </div>
    </div>
  );
}
