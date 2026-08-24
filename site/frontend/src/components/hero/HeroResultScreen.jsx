import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { HeroThemePattern } from './HeroThemePattern';

export function HeroResultScreen({ result, snapshot, onPublish, onClose, publishing }) {
  const { t } = useTranslation(['challenges']);
  const success = Boolean(result?.success || result?.benchmark_reached);
  const themeId = snapshot?.visual_theme?.id || 'spiderman';
  const rounds = result?.rounds ?? 0;
  const reps = result?.total_reps;
  const minutes = Math.round((result?.duration_seconds || snapshot?.duration_seconds || 0) / 60);

  return (
    <div className="min-h-screen p-5" data-testid="hero-result-screen" data-hero-theme={themeId}>
      <div className="relative overflow-hidden rounded-3xl border border-border">
        <HeroThemePattern themeId={themeId} />
        <div
          className={`relative p-6 text-white text-center space-y-3 ${success ? 'hero-success-pop' : ''}`}
        >
          <p className="text-sm uppercase tracking-[0.2em] text-white/70">
            {success ? t('challenges:hero.challengeWon') : t('challenges:hero.challengeDone')}
          </p>
          <h1 className="text-2xl font-bold font-['Outfit']">
            {success
              ? t('challenges:hero.successTitle', { name: snapshot?.character_name })
              : snapshot?.title}
          </h1>
          <p className="text-lg" data-testid="hero-result-score">
            {t('challenges:hero.scoreLine', { rounds, reps: reps || '—', minutes })}
          </p>
          {success ? (
            <div className="space-y-1 text-sm text-white/90">
              <p>{t('challenges:hero.newBadge')}</p>
              <p>{t('challenges:hero.newTheme')}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {success ? (
          <Button
            className="w-full h-12 btn-primary text-foreground"
            data-testid="hero-publish-success"
            disabled={publishing}
            onClick={onPublish}
          >
            {t('challenges:hero.publishSuccess')}
          </Button>
        ) : null}
        <Button variant="outline" className="w-full h-12" onClick={onClose}>
          {t('challenges:hero.close')}
        </Button>
      </div>
    </div>
  );
}
