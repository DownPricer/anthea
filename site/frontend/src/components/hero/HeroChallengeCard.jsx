import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { HeroThemePattern } from './HeroThemePattern';

export function HeroChallengeCard({ challenge, onSelect, compact = false }) {
  const { t, i18n } = useTranslation(['challenges', 'workouts']);
  const lang = (i18n.language || 'fr').split('-')[0];
  const themeId = challenge?.visual_theme?.id || challenge?.rename_key || 'spiderman';
  const playable = Boolean(challenge?.playable);
  const durationMin = challenge?.duration_seconds
    ? Math.round(challenge.duration_seconds / 60)
    : null;
  const exercises = (challenge?.exercises || []).slice(0, 3);
  const badgeLocked = challenge?.reward?.badge_id && !challenge?.progress?.badge_unlocked;
  const typeLabel = t(`challenges:hero.types.${challenge?.challenge_type}`, {
    defaultValue: challenge?.format_label || challenge?.challenge_type,
  });

  const exerciseLine = useMemo(() => {
    return exercises.map((ex) => {
      const name = ex.name_i18n?.[lang] || ex.name_i18n?.fr || ex.exercise_id;
      const reps = ex.reps != null ? `${ex.reps} ` : '';
      return `${reps}${name}`.trim();
    });
  }, [exercises, lang]);

  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-border text-left"
      data-testid={`hero-card-${challenge?.slug || challenge?.id}`}
      data-hero-theme={themeId}
    >
      <HeroThemePattern themeId={themeId} />
      <div className="relative p-4 space-y-3 bg-black/35">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">
              {playable ? t('challenges:hero.challengeLabel') : t('challenges:hero.referenceLabel')}
            </p>
            <h3 className="text-lg font-semibold text-white font-['Outfit'] leading-tight">
              {challenge?.title}
            </h3>
            <p className="text-sm text-white/80">{challenge?.character_name}</p>
          </div>
          {badgeLocked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white/80">
              <Lock size={12} aria-hidden />
              {t('challenges:hero.badgeLocked')}
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-white/75">
          {durationMin ? `${durationMin} MIN · ${typeLabel}` : typeLabel}
        </p>
        {!compact && exerciseLine.length > 0 && playable ? (
          <ul className="text-sm text-white/90 space-y-0.5">
            {exerciseLine.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {challenge?.benchmark?.target ? (
          <p className="text-sm text-white">
            {t('challenges:hero.legendaryGoal', { count: challenge.benchmark.target })}
          </p>
        ) : null}
        <Button
          type="button"
          className="w-full h-11 rounded-xl btn-primary text-foreground"
          onClick={() => onSelect?.(challenge)}
          data-testid={`hero-card-cta-${challenge?.id}`}
        >
          {playable ? t('challenges:hero.startWorkout') : t('challenges:hero.viewProgram')}
        </Button>
      </div>
    </article>
  );
}
