import { useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

import { Loader2, Flame, Trophy, Target, Clock, Calendar, Zap, Medal } from 'lucide-react';

import { BadgesPreview, BadgesCatalogView } from '../badges/BadgesCatalog';

import { ProfileEmptyState } from '../profile/ProfileEmptyState';

import { formatDuration } from '../../lib/userProfile';

import { parseISO } from 'date-fns';

import { useState } from 'react';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { resolveChallengeLabels } from '../../i18n/challengeLabels';



export function DuoProfileStatsTab({

  stats,

  loading,

  statsError,

  canViewBadges,

  canViewStats,

  canViewChallenges = true,

  duoProfile,

  onBadgeShared,

}) {

  const { t } = useTranslation(['duo', 'challenges']);
  const { formatDate } = useLocaleFormat();

  const navigate = useNavigate();

  const [showAllBadges, setShowAllBadges] = useState(false);



  if (!canViewStats && !canViewBadges && !canViewChallenges) {

    return (

      <ProfileEmptyState

        title={t('duo:profileStats.hiddenTitle')}

        description={t('duo:profileStats.hiddenDesc')}

      />

    );

  }



  if (loading) {

    return (

      <div className="flex justify-center py-16">

        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />

      </div>

    );

  }



  if (statsError && !stats) {

    return (

      <ProfileEmptyState

        title={t('duo:profileStats.unavailableTitle')}

        description={statsError}

      />

    );

  }



  if (!stats && (canViewStats || canViewBadges)) {

    return (

      <ProfileEmptyState

        title={t('duo:profileStats.emptyTitle')}

        description={t('duo:profileStats.emptyDesc')}

      />

    );

  }



  const duoBadges = (stats?.duo_badges || stats?.badges || []).filter((b) => {

    const family = b.family === 'duo_social' ? 'duo' : b.family;

    return family === 'duo' || b.scope === 'duo' || b.id?.startsWith('duo_');

  });

  const duoBadgesUnlockedCount =

    stats?.duo_badges_unlocked ??

    stats?.badges_unlocked ??

    duoBadges.filter((b) => b.unlocked).length;

  const canPublish = Boolean(duoProfile?.is_member);

  const pairKey = duoProfile?.pair_key || null;



  return (

    <div className="space-y-6" data-testid="duo-profile-stats">

      {canViewStats && stats ? (

        <>

          <div className="grid grid-cols-2 gap-3">

            <StatCard icon={Trophy} label={t('duo:profileStats.sessionsTogether')} value={stats.sessions_together ?? 0} />

            <StatCard icon={Flame} label={t('duo:profileStats.duoStreak')} value={stats.duo_streak_current ?? 0} />

            <StatCard icon={Calendar} label={t('duo:profileStats.bestStreak')} value={stats.duo_streak_best ?? 0} />

            <StatCard icon={Target} label={t('duo:profileStats.challengesCompleted')} value={stats.challenges_completed ?? 0} />

            <StatCard icon={Clock} label={t('duo:profileStats.totalTime')} value={formatDuration(stats.total_training_time || 0)} isText />

            <StatCard icon={Calendar} label={t('duo:profileStats.daysTogether')} value={stats.training_days_together ?? 0} />

            <StatCard icon={Zap} label={t('duo:profileStats.estimatedCalories')} value={stats.estimated_calories ?? 0} />

            <StatCard icon={Medal} label={t('duo:profileStats.duoBadges')} value={duoBadgesUnlockedCount} />

          </div>



          {stats.last_common_session ? (

            <div className="card p-4 border-border">

              <p className="text-subtle text-xs uppercase tracking-wider mb-1">{t('duo:profileStats.lastCommonSession')}</p>

              <p className="text-foreground text-sm font-medium">

                {stats.last_common_session.date

                  ? formatDate(parseISO(stats.last_common_session.date))

                  : '—'}

              </p>

              <p className="text-muted text-xs mt-1">

                {stats.last_common_session.title_a} · {stats.last_common_session.title_b}

              </p>

            </div>

          ) : null}

        </>

      ) : !canViewStats ? (

        <ProfileEmptyState

          title={t('duo:profileStats.hiddenTitle')}

          description={t('duo:profileStats.hiddenPublicDesc')}

        />

      ) : null}



      {canViewChallenges && stats?.current_challenge ? (

        <div className="card p-4 border-[var(--theme-primary)]/20">

          <p className="text-foreground font-medium mb-1">{t('duo:weeklyChallenge')}</p>

          <p className="text-muted text-sm mb-3">{resolveChallengeLabels(stats.current_challenge, t).title}</p>

          <div className="h-2 bg-hover rounded-full overflow-hidden">

            <div

              className="h-full bg-[var(--theme-primary)] transition-all"

              style={{

                width: `${Math.min(

                  100,

                  stats.current_challenge.target

                    ? (stats.current_challenge.current / stats.current_challenge.target) * 100

                    : 0

                )}%`,

              }}

            />

          </div>

          <p className="text-subtle text-xs mt-2">

            {stats.current_challenge.current}/{stats.current_challenge.target}

            {stats.current_challenge.status === 'completed' ? ` · ${t('challenges:ui.succeeded')}` : ''}
            {stats.current_challenge.status === 'expired' ? ` · ${t('challenges:ui.expired')}` : ''}
            {stats.current_challenge.status === 'upcoming' ? ` · ${t('challenges:ui.upcoming')}` : ''}

          </p>

        </div>

      ) : canViewChallenges && (canViewStats || duoProfile?.is_member) ? (

        <ProfileEmptyState title={t('duo:profileStats.noChallengeTitle')} description={t('duo:profileStats.noChallengeDesc')} />

      ) : null}



      {canViewBadges ? (

        showAllBadges ? (

          <div>

            <div className="flex items-center justify-between mb-3">

              <h3 className="text-sm font-medium text-muted uppercase tracking-wider">{t('duo:profileStats.allDuoBadges')}</h3>

              <button

                type="button"

                onClick={() => setShowAllBadges(false)}

                className="text-xs text-[var(--theme-primary)] hover:underline"

                data-testid="duo-badges-toggle-all"

              >

                {t('duo:profileStats.collapse')}

              </button>

            </div>

            <BadgesCatalogView

              badges={duoBadges}

              summary={stats?.badges_summary || stats?.duo_badges_summary}

              scope="duo"

              canPublish={canPublish}

              pairKey={pairKey}

              onShared={onBadgeShared}

            />

          </div>

        ) : (

          <BadgesPreview

            badges={duoBadges}

            summary={

              stats?.duo_badges_summary ||

              stats?.badges_summary || {

                unlocked: duoBadgesUnlockedCount,

                total: stats?.duo_badges_total ?? stats?.badges_total ?? duoBadges.length,

              }

            }

            scope="duo"

            canPublish={canPublish}

            pairKey={pairKey}

            onShared={onBadgeShared}

            onSeeAll={() => {

              if (duoProfile?.is_member) {

                navigate('/badges?scope=duo');

              } else {

                setShowAllBadges(true);

              }

            }}

          />

        )

      ) : null}

    </div>

  );

}



function StatCard({ icon: Icon, label, value, isText = false }) {

  return (

    <div className="card p-4 text-center">

      <Icon className="mx-auto text-[var(--theme-primary)] mb-2" size={18} />

      <p className={`font-bold text-foreground ${isText ? 'text-base' : 'text-2xl'}`}>{value}</p>

      <p className="text-subtle text-[10px] uppercase tracking-wider mt-1">{label}</p>

    </div>

  );

}

