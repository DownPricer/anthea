import { useTranslation } from 'react-i18next';

import { Award, CheckCircle2, Sparkles, Trophy } from 'lucide-react';

import { Button } from '../ui/button';

import { HeroThemePattern } from './HeroThemePattern';

import { HeroCategoryBadge } from './HeroCategoryBadge';

import {

  heroBenchmarkReached,

  heroDurationMinutes,

  heroHasRoundsScore,

  resolveHeroThemeId,

} from '../../lib/heroChallenges';



export function HeroResultScreen({ result, snapshot, onPublish, onClose }) {

  const { t } = useTranslation(['challenges']);

  const success = heroBenchmarkReached(result);

  const themeId = resolveHeroThemeId(result, snapshot);

  const rounds = result?.rounds ?? 0;

  const reps = result?.total_reps;

  const minutes = heroDurationMinutes(result, snapshot);

  const hasRoundsScore = heroHasRoundsScore(result, snapshot);



  const scoreLabel = hasRoundsScore

    ? t('challenges:hero.scoreLine', { rounds, reps: reps ?? '—', minutes: minutes ?? '—' })

    : minutes

      ? t('challenges:hero.sessionComplete', { minutes })

      : t('challenges:hero.structuredComplete');



  return (

    <div className="min-h-screen bg-background p-4 sm:p-6" data-testid="hero-result-screen" data-hero-theme={themeId}>

      <div className="relative mx-auto max-w-lg overflow-hidden rounded-3xl border border-border shadow-2xl">

        <HeroThemePattern themeId={themeId} />

        <div

          className={`relative space-y-4 px-6 py-10 text-center text-white sm:px-10 ${success ? 'hero-success-pop' : ''}`}

        >

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm">

            {success ? <Trophy size={32} aria-hidden="true" /> : <CheckCircle2 size={32} aria-hidden="true" />}

          </div>

          <HeroCategoryBadge className="mx-auto" />

          <p className="text-sm uppercase tracking-[0.2em] text-white/70">

            {success ? t('challenges:hero.challengeWon') : t('challenges:hero.challengeDone')}

          </p>

          <h1 className="text-3xl font-black leading-tight font-['Outfit']">

            {success

              ? t('challenges:hero.successTitle', { name: snapshot?.title })

              : snapshot?.title}

          </h1>

          <p className="text-lg font-semibold tabular-nums" data-testid="hero-result-score">

            {scoreLabel}

          </p>

          {result?.is_personal_best ? (

            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">

              <Sparkles size={15} aria-hidden="true" />

              {t('challenges:hero.newRecord')}

            </p>

          ) : null}

          {success && (result?.badge_id || result?.profile_theme_id) ? (

            <div className="grid gap-2 text-left text-sm text-white/90 sm:grid-cols-2">

              {result?.badge_id ? (

                <p className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/20 p-3">

                  <Award size={18} className="shrink-0" aria-hidden="true" />

                  {t('challenges:hero.newBadge')}

                </p>

              ) : null}

              {result?.profile_theme_id ? (

                <p className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/20 p-3">

                  <Sparkles size={18} className="shrink-0" aria-hidden="true" />

                  {t('challenges:hero.newTheme')}

                </p>

              ) : null}

            </div>

          ) : (

            <p className="rounded-2xl border border-white/15 bg-black/20 p-3 text-sm text-white/80">

              {t('challenges:hero.goalMissed')}

            </p>

          )}

        </div>

      </div>

      <div className="mx-auto mt-6 max-w-lg space-y-3">

        <Button

          className="w-full h-12 btn-primary text-foreground"

          data-testid={success ? 'hero-publish-success' : 'hero-publish-session'}

          onClick={onPublish}

        >

          {success ? t('challenges:hero.publishSuccess') : t('challenges:hero.publishSession')}

        </Button>

        <Button variant="outline" className="w-full h-12" onClick={onClose}>

          {t('challenges:hero.close')}

        </Button>

      </div>

    </div>

  );

}

