import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { HeroThemePattern } from './HeroThemePattern';
import { repsPerRound } from '../../lib/heroChallenges';

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
  const [running, setRunning] = useState(true);
  const endedRef = useRef(false);
  const roundsRef = useRef(0);
  const remainingRef = useRef(duration);
  const themeId = snapshot?.visual_theme?.id || 'spiderman';

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
    if (!running) return undefined;
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
  }, [running, finish]);

  const addRound = () => {
    setRounds((n) => n + 1);
  };
  const subRound = () => {
    setRounds((n) => Math.max(0, n - 1));
  };

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
            <li key={ex.exercise_id} className="flex justify-between text-foreground">
              <span>{ex.name_i18n?.[lang] || ex.name_i18n?.fr}</span>
              <span className="font-semibold">{ex.reps}</span>
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
