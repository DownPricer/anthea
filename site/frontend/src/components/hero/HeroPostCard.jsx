import { useTranslation } from 'react-i18next';
import { Award, CheckCircle2, Timer, Trophy } from 'lucide-react';
import { HeroThemePattern } from './HeroThemePattern';
import { HeroCategoryBadge } from './HeroCategoryBadge';
import {
  heroBenchmarkReached,
  heroDurationMinutes,
  heroHasRoundsScore,
  resolveHeroThemeId,
} from '../../lib/heroChallenges';

export function HeroPostCard({ post }) {
  const { t } = useTranslation(['challenges']);
  const result = post?.hero_result || {};
  const themeId = resolveHeroThemeId(result, null);
  const rounds = result.rounds ?? 0;
  const reps = result.total_reps;
  const minutes = heroDurationMinutes(result, null);
  const name = result.display_name || result.title || result.character_name || post.title;
  const hasRoundsScore = heroHasRoundsScore(result, null);
  const success = heroBenchmarkReached(result);

  const scoreLabel = hasRoundsScore
    ? t('challenges:hero.postScore', { rounds, reps: reps ?? '—', minutes: minutes ?? '—' })
    : minutes
      ? t('challenges:hero.sessionComplete', { minutes })
      : t('challenges:hero.structuredComplete');

  return (
    <div
      className="relative min-h-[180px] overflow-hidden rounded-3xl border border-border shadow-lg"
      data-testid="hero-post-card"
      data-hero-theme={themeId}
    >
      <HeroThemePattern themeId={themeId} />
      <div className="relative flex min-h-[180px] flex-col justify-between p-5 text-white sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <HeroCategoryBadge />
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">
                {success ? t('challenges:hero.challengeWon') : t('challenges:hero.challengeDone')}
              </p>
            </div>
            <h3 className="mt-1 text-xl font-bold leading-tight font-['Outfit'] sm:text-2xl">
              {name}
            </h3>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            {success ? <Trophy size={22} aria-hidden="true" /> : <CheckCircle2 size={22} aria-hidden="true" />}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 font-semibold tabular-nums">
            <Timer size={14} aria-hidden="true" />
            {scoreLabel}
          </span>
          {result.badge_id ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
              <Award size={14} aria-hidden="true" />
              {t('challenges:hero.badgeUnlocked')}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
