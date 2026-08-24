import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { HeroThemePattern } from './HeroThemePattern';

export function HeroRoundsPlayer({ snapshot, onComplete, onAbandon }) {
  const { t, i18n } = useTranslation(['challenges', 'player']);
  const lang = (i18n.language || 'fr').split('-')[0];
  const target = Number(snapshot?.rounds || snapshot?.scoring?.target_rounds || 5);
  const needsCoda = (snapshot?.coda_exercises || []).length > 0;
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
            <li key={ex.exercise_id} className="text-foreground">
              <span className="font-medium">{ex.name_i18n?.[lang] || ex.name_i18n?.fr}</span>
              {ex.reps != null ? <span className="ml-2 text-muted">×{ex.reps}</span> : null}
              {ex.reps_scheme ? <span className="ml-2 text-muted">{ex.reps_scheme.join(' / ')}</span> : null}
              {ex.intensity_hint ? (
                <p className="text-xs text-muted mt-1">{ex.intensity_hint}</p>
              ) : null}
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
