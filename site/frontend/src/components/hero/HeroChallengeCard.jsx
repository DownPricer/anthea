import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { HeroThemePattern } from './HeroThemePattern';
import { resolveHeroThemeId } from '../../lib/heroChallenges';
import { HeroCategoryBadge } from './HeroCategoryBadge';
import {
  formatHeroExerciseLine,
  heroMetaChips,
  heroProgramPreviewLines,
} from '../../lib/heroExerciseFormat';

export function HeroChallengeCard({ challenge, onSelect, compact = false }) {
  const { t, i18n } = useTranslation(['challenges', 'workouts']);
  const lang = (i18n.language || 'fr').split('-')[0];
  const themeId = resolveHeroThemeId(null, challenge);
  const playable = Boolean(challenge?.playable);
  const isReference = !playable;
  const exercises = (challenge?.exercises || []).slice(0, compact ? 3 : 6);
  const badgeLocked = challenge?.reward?.badge_id && !challenge?.progress?.badge_unlocked;
  const metaChips = useMemo(() => heroMetaChips(challenge, t), [challenge, t]);
  const exerciseLines = useMemo(
    () => exercises.map((ex) => formatHeroExerciseLine(ex, lang)),
    [exercises, lang]
  );
  const referenceLines = useMemo(
    () => (isReference ? heroProgramPreviewLines(challenge, t, lang) : []),
    [challenge, isReference, t, lang]
  );

  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border text-left"
      data-testid={`hero-card-${challenge?.slug || challenge?.id}`}
      data-hero-theme={themeId}
    >
      <HeroThemePattern themeId={themeId} />
      <div className="relative flex h-full flex-col bg-black/35 p-4">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <HeroCategoryBadge />
            {badgeLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/80">
                <Lock size={11} aria-hidden />
                {t('challenges:hero.badgeLocked')}
              </span>
            ) : null}
          </div>
        </div>

        {/* TITLE */}
        <div className="mt-2 min-w-0">
          <h3 className="font-['Outfit'] text-lg font-semibold leading-tight text-white">
            {challenge?.title}
          </h3>
          <p className="text-sm text-white/80">
            {challenge?.subtitle || challenge?.character_name}
          </p>
        </div>

        {/* META CHIPS */}
        {metaChips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="hero-meta-chips">
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

        {/* PROGRAM PREVIEW */}
        <div className="mt-3 min-h-0 flex-1 space-y-1">
          {playable && exerciseLines.length > 0 ? (
            <ul className="space-y-0.5 text-sm text-white/90" data-testid="hero-exercise-preview">
              {exerciseLines.map((line) => (
                <li key={line} className="truncate">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {isReference && referenceLines.length > 0 ? (
            <div className="space-y-1 text-sm text-white/90" data-testid="hero-reference-preview">
              {referenceLines.map((item, idx) => {
                if (item.kind === 'heading') {
                  return (
                    <p key={`${item.text}-${idx}`} className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
                      {item.text}
                    </p>
                  );
                }
                if (item.kind === 'bullet') {
                  return (
                    <p key={`${item.text}-${idx}`} className="pl-1">
                      • {item.text}
                    </p>
                  );
                }
                if (item.kind === 'disclaimer') {
                  return (
                    <p key={`${item.text}-${idx}`} className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-xs text-amber-100/90">
                      {item.text}
                    </p>
                  );
                }
                if (item.kind === 'note') {
                  return (
                    <p key={`${item.text}-${idx}`} className="text-xs text-white/65">
                      {item.text}
                    </p>
                  );
                }
                return (
                  <p key={`${item.text}-${idx}`} className="text-xs text-white/75">
                    {item.text}
                  </p>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* FOOTER */}
        <div className="mt-auto space-y-2 pt-3">
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
