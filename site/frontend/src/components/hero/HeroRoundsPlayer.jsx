import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { HeroThemePattern } from './HeroThemePattern';
import { resolveExerciseMediaUrl } from '../../lib/exerciseMedia';

export function HeroRoundsPlayer({ snapshot, onComplete, onAbandon }) {
  const { t, i18n } = useTranslation(['challenges', 'player']);
  const lang = (i18n.language || 'fr').split('-')[0];
  const target = Number(snapshot?.rounds || snapshot?.scoring?.target_rounds || 5);
  const needsCoda = (snapshot?.coda_exercises || []).length > 0;
  const [started, setStarted] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [codaComplete, setCodaComplete] = useState(false);
  const themeId = snapshot?.visual_theme?.id || 'deadpool';
  const codaPhase = rounds >= target && needsCoda && !codaComplete;

  const finish = (status) => {
    onComplete?.({
      status,
      rounds,
      coda_complete: needsCoda ? codaComplete : true,
      duration_seconds: 0,
      blocks_complete: rounds >= target && (!needsCoda || codaComplete),
    });
  };

  if (!started) {
    const previewExercise = (snapshot?.exercises || []).find((exercise) => exercise.image_url || exercise.media_snapshot);
    return (
      <div className="relative min-h-screen overflow-hidden px-5 py-8" data-testid="hero-launch-screen" data-hero-theme={themeId}>
        <HeroThemePattern themeId={themeId} />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
            {t('challenges:hero.launchLabel')}
          </p>
          <h1 className="mt-2 text-4xl font-black leading-tight font-['Outfit']">{snapshot?.title}</h1>
          <p className="mt-2 text-white/80">{snapshot?.character_name}</p>
          {previewExercise ? (
            <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-white/20 bg-black/25">
              <img
                src={resolveExerciseMediaUrl(previewExercise.image_url || previewExercise.media_snapshot)}
                alt={previewExercise.name_i18n?.[lang] || previewExercise.name_i18n?.fr || ''}
                className="h-full w-full object-contain"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.parentElement.style.display = 'none';
                }}
              />
            </div>
          ) : null}
          <div className="mt-6 rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm">
            <p className="text-3xl font-black">{target} {t('challenges:hero.rounds')}</p>
            <p className="mt-2 text-sm text-white/75">{t('challenges:hero.launchHint')}</p>
          </div>
          <Button
            type="button"
            data-testid="hero-launch-button"
            className="mt-6 h-14 w-full rounded-2xl bg-white text-base font-bold text-black hover:bg-white/90"
            onClick={() => setStarted(true)}
          >
            {t('challenges:hero.launch')}
          </Button>
          <Button type="button" variant="ghost" className="mt-2 text-white/75 hover:text-white" onClick={() => onAbandon?.()}>
            {t('player:cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" data-testid="hero-rounds-player" data-hero-theme={themeId}>
      <div className="relative overflow-hidden border-b border-border">
        <HeroThemePattern themeId={themeId} />
        <div className="relative px-5 py-6 text-white">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">{snapshot?.character_name}</p>
          <h1 className="text-2xl font-bold font-['Outfit']">{snapshot?.title}</h1>
          <p className="text-4xl font-black mt-3" data-testid="hero-round-progress">
            {t('challenges:hero.roundOf', { current: Math.min(rounds + 1, target), total: target })}
          </p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <ul className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-2">
          {(codaPhase ? snapshot.coda_exercises : snapshot.exercises || []).map((ex) => (
            <li key={ex.exercise_id} className="flex items-center gap-3 text-foreground">
              {(ex.image_url || ex.media_snapshot) ? (
                <img
                  src={resolveExerciseMediaUrl(ex.image_url || ex.media_snapshot)}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl bg-hover object-contain"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <div className="min-w-0">
                <span className="font-medium">{ex.name_i18n?.[lang] || ex.name_i18n?.fr}</span>
                {ex.reps != null ? <span className="ml-2 text-muted">×{ex.reps}</span> : null}
                {ex.reps_scheme ? <span className="ml-2 text-muted">{ex.reps_scheme.join(' / ')}</span> : null}
                {ex.intensity_hint ? (
                  <p className="text-xs text-muted mt-1">{ex.intensity_hint}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {!codaPhase ? (
          <Button
            type="button"
            data-testid="hero-plus-round"
            className="w-full h-24 rounded-3xl text-2xl font-bold btn-primary text-foreground"
            onClick={() => setRounds((n) => Math.min(target, n + 1))}
            disabled={rounds >= target}
          >
            {t('challenges:hero.plusRound')}
          </Button>
        ) : (
          <Button
            type="button"
            data-testid="hero-coda-complete"
            className="w-full h-20 rounded-3xl text-xl font-bold btn-primary text-foreground"
            onClick={() => setCodaComplete(true)}
          >
            {t('challenges:hero.dropSetsDone')}
          </Button>
        )}
        <button
          type="button"
          className="w-full h-11 text-sm text-muted"
          onClick={() => setRounds((n) => Math.max(0, n - 1))}
        >
          {t('challenges:hero.minusRound')}
        </button>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12" onClick={() => onAbandon?.()}>
            {t('player:abandon')}
          </Button>
          <Button
            className="flex-1 h-12"
            onClick={() => finish('completed')}
            disabled={rounds < target || (needsCoda && !codaComplete)}
          >
            {t('player:finish')}
          </Button>
        </div>
      </div>
    </div>
  );
}
