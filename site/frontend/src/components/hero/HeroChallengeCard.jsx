import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { HeroThemePattern } from './HeroThemePattern';
import { resolveHeroThemeId } from '../../lib/heroChallenges';
import { HeroCategoryBadge } from './HeroCategoryBadge';
import {
  heroCardMetaChips,
  heroCardSubtitle,
  heroExercisePreviewLines,
  heroCardReferencePreview,
} from '../../lib/heroExerciseFormat';

export function HeroChallengeCard({ challenge, onSelect }) {
  const { t, i18n } = useTranslation(['challenges', 'workouts']);
  const lang = (i18n.language || 'fr').split('-')[0];
  const themeId = resolveHeroThemeId(null, challenge);
  const playable = Boolean(challenge?.playable);
  const isReference = !playable;
  const badgeLocked = challenge?.reward?.badge_id && !challenge?.progress?.badge_unlocked;
  const metaChips = useMemo(() => heroCardMetaChips(challenge, t), [challenge, t]);
  const subtitle = useMemo(() => heroCardSubtitle(challenge, t), [challenge, t]);
  const exercisePreview = useMemo(
    () => (playable ? heroExercisePreviewLines(challenge, lang, t) : null),
    [challenge, playable, lang, t]
  );
  const referencePreview = useMemo(
    () => (isReference ? heroCardReferencePreview(challenge, t, lang) : null),
    [challenge, isReference, t, lang]
  );

  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-border text-left"
      data-testid={`hero-card-${challenge?.slug || challenge?.id}`}
      data-hero-theme={themeId}
    >
      <HeroThemePattern themeId={themeId} />
      <div className="relative space-y-2 bg-black/35 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <HeroCategoryBadge />
          {badgeLocked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/80">
              <Lock size={11} aria-hidden />
              {t('challenges:hero.badgeLocked')}
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <h3 className="font-['Outfit'] text-lg font-semibold leading-tight text-white">
            {challenge?.title}
          </h3>
          {subtitle ? <p className="text-sm text-white/80">{subtitle}</p> : null}
        </div>

        {metaChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="hero-meta-chips">
            {metaChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white/85"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {playable && exercisePreview?.lines?.length > 0 ? (
          <ul className="space-y-0.5 text-sm text-white/90" data-testid="hero-exercise-preview">
            {exercisePreview.lines.map((item) => (
              <li key={item.text} className={item.isCoda ? 'truncate pl-1 text-white/80' : 'truncate'}>
                {item.isCoda ? `• ${item.text}` : item.text}
              </li>
            ))}
            {exercisePreview.overflowLabel ? (
              <li className="text-xs text-white/65">{exercisePreview.overflowLabel}</li>
            ) : null}
          </ul>
        ) : null}

        {isReference && referencePreview?.lines?.length > 0 ? (
          <div className="space-y-0.5 text-sm text-white/90" data-testid="hero-reference-preview">
            {referencePreview.lines.map((line) => (
              <p key={line} className="truncate">
                {line}
              </p>
            ))}
            {referencePreview.footnote ? (
              <p className="pt-0.5 text-xs text-white/60">{referencePreview.footnote}</p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2 pt-1">
          {challenge?.benchmark?.target ? (
            <p className="text-sm text-white/90">
              {t('challenges:hero.heroGoal', { count: challenge.benchmark.target })}
            </p>
          ) : null}
          <Button
            type="button"
            className="btn-primary h-11 w-full rounded-xl text-foreground"
            onClick={() => onSelect?.(challenge)}
            data-testid={`hero-card-cta-${challenge?.id}`}
          >
            {t('challenges:hero.startWorkout')}
          </Button>
        </div>
      </div>
    </article>
  );
}
