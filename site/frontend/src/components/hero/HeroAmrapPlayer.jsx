import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { HeroThemePattern } from './HeroThemePattern';
import { repsPerRound, resolveHeroThemeId } from '../../lib/heroChallenges';
import { resolveExerciseMediaUrl } from '../../lib/exerciseMedia';
import { heroExerciseImageUrl } from '../../lib/heroExerciseMedia';

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function HeroAmrapPlayer({
  workout,
  snapshot,
  onComplete,
  onAbandon,
}) {
  const { t, i18n } = useTranslation(['challenges', 'player']);
  const lang = (i18n.language || 'fr').split('-')[0];
  const duration = Number(snapshot?.duration_seconds || 1200);
  const [remaining, setRemaining] = useState(duration);
  const [rounds, setRounds] = useState(0);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const endedRef = useRef(false);
  const roundsRef = useRef(0);
  const remainingRef = useRef(duration);
  const themeId = resolveHeroThemeId(null, snapshot);

  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  const finish = useCallback(
    (status) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setRunning(false);
      const elapsed = duration - remainingRef.current;
      onComplete?.({
        status,
        rounds: roundsRef.current,
        duration_seconds: Math.max(0, elapsed),
        partial_reps: 0,
        total_reps: roundsRef.current * repsPerRound(snapshot),
      });
    },
    [duration, onComplete, snapshot]
  );

  useEffect(() => {
    if (!started || !running) return undefined;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          finish('completed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [started, running, finish]);

  const addRound = () => {
    setRounds((n) => n + 1);
  };
  const subRound = () => {
    setRounds((n) => Math.max(0, n - 1));
  };

  if (!started) {
    const previewExercise = (snapshot?.exercises || []).find((exercise) => heroExerciseImageUrl(exercise));
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
                src={resolveExerciseMediaUrl(heroExerciseImageUrl(previewExercise))}
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
            <p className="font-mono text-3xl font-bold tabular-nums">{formatClock(duration)}</p>
            <p className="mt-2 text-sm text-white/75">{t('challenges:hero.launchHint')}</p>
          </div>
          <Button
            type="button"
            data-testid="hero-launch-button"
            className="mt-6 h-14 w-full rounded-2xl bg-white text-base font-bold text-black hover:bg-white/90"
            onClick={() => {
              setStarted(true);
              setRunning(true);
            }}
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
    <div className="min-h-screen pb-8" data-testid="hero-amrap-player" data-hero-theme={themeId}>
      <div className="relative overflow-hidden border-b border-border">
        <HeroThemePattern themeId={themeId} />
        <div className="relative px-5 py-6 text-white">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">{snapshot?.character_name}</p>
          <h1 className="text-2xl font-bold font-['Outfit']">{snapshot?.title}</h1>
          <p className="font-mono text-5xl mt-3 tabular-nums" data-testid="hero-amrap-timer">
            {formatClock(remaining)}
          </p>
          <p className="text-sm text-white/80 mt-2">{t('challenges:hero.amrapSafety')}</p>
        </div>
      </div>
      <div className="p-5 space-y-5">
        <ul className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-2">
          {(snapshot?.exercises || []).map((ex) => (
            <li key={ex.exercise_id} className="flex items-center justify-between gap-3 text-foreground">
              <div className="flex min-w-0 items-center gap-3">
                {(heroExerciseImageUrl(ex) || ex.media_snapshot) ? (
                  <img
                    src={resolveExerciseMediaUrl(heroExerciseImageUrl(ex) || ex.media_snapshot)}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl bg-hover object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="truncate">{ex.name_i18n?.[lang] || ex.name_i18n?.fr}</span>
              </div>
              <span className="shrink-0 font-semibold">{ex.reps}</span>
            </li>
          ))}
        </ul>
        <div className="text-center">
          <p className="text-sm uppercase tracking-wide text-muted">{t('challenges:hero.roundsDone')}</p>
          <p className="text-7xl font-black tabular-nums text-foreground" data-testid="hero-round-count">
            {rounds}
          </p>
        </div>
        <Button
          type="button"
          data-testid="hero-plus-round"
          className="w-full h-24 rounded-3xl text-2xl font-bold btn-primary text-foreground"
          onClick={addRound}
        >
          {t('challenges:hero.plusRound')}
        </Button>
        <button
          type="button"
          data-testid="hero-minus-round"
          className="w-full h-11 rounded-xl text-sm text-muted"
          onClick={subRound}
        >
          {t('challenges:hero.minusRound')}
        </button>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12" onClick={() => onAbandon?.()}>
            {t('player:abandon')}
          </Button>
          <Button className="flex-1 h-12" onClick={() => finish('completed')}>
            {t('player:finish')}
          </Button>
        </div>
      </div>
    </div>
  );
}
