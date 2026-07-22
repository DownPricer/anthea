import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Clock,
  Flame,
  Target,
  Trophy,
  Dumbbell,
  Loader2,
  Lock,
} from 'lucide-react';
import { formatCalories } from '../../lib/calories';
import { canViewProfileSection, formatDuration } from '../../lib/userProfile';
import { SessionHistoryCard } from '../history/SessionHistoryCard';
import { computeBestStreak } from '../../lib/streakUtils';
import { BadgesPreview } from '../badges/BadgesCatalog';

function StatCard({ icon: Icon, label, value, sub }) {
  if (value == null || value === '') return null;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-[var(--theme-primary)]" />
        <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground font-['Outfit']">{value}</p>
      {sub ? <p className="text-subtle text-xs mt-1">{sub}</p> : null}
    </div>
  );
}

function sumExercisesCompleted(sessions = []) {
  const total = sessions.reduce((acc, s) => acc + (Number(s.exercises_completed) || 0), 0);
  return total > 0 ? total : null;
}

export function ProfileStatsTab({
  profileUser,
  viewer,
  isOwn,
  isLimited,
  loading,
  duoStats,
  detailedStats,
  calendarDays = [],
}) {
  const { t } = useTranslation(['profile']);
  const canShowStats = canViewProfileSection(profileUser, viewer, 'stats');
  const canShowBadges = canViewProfileSection(profileUser, viewer, 'badges');
  const canShowSessions = canViewProfileSection(profileUser, viewer, 'sessions');

  const bestStreak = useMemo(() => computeBestStreak(calendarDays), [calendarDays]);
  const exercisesDone = useMemo(
    () => sumExercisesCompleted(detailedStats?.recent_sessions),
    [detailedStats]
  );
  const navigate = useNavigate();
  const soloBadges = useMemo(
    () =>
      (duoStats?.badges || []).filter(
        (b) => b.scope === 'solo' || (!b.scope && !String(b.id || '').startsWith('duo_'))
      ),
    [duoStats?.badges]
  );

  if (isLimited && !isOwn) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-hover px-6 py-14 text-center">
        <Lock size={28} className="text-subtle mb-3" />
        <p className="text-foreground font-medium">{t('profile:statsTab.privateTitle')}</p>
        <p className="text-subtle text-sm mt-2 max-w-sm">
          {t('profile:statsTab.privateHint')}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  if (!canShowStats) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
        <BarChart3 size={28} className="text-subtle mb-3" />
        <p className="text-muted text-sm">{t('profile:statsTab.notVisible')}</p>
      </div>
    );
  }

  const summary = detailedStats?.summary;
  const recentSessions = canShowSessions ? detailedStats?.recent_sessions || [] : [];
  const streak = duoStats?.streak;
  const badgesUnlocked = canShowBadges ? duoStats?.badges_unlocked : null;
  const badgesTotal = canShowBadges ? duoStats?.badges_total : null;

  const statItems = [
    {
      key: 'sessions',
      icon: Activity,
      label: t('profile:statsTab.totalSessions'),
      value: summary?.total_completed != null ? String(summary.total_completed) : null,
      sub: summary?.total_sessions != null ? t('profile:statsTab.attempts', { count: summary.total_sessions }) : null,
    },
    {
      key: 'time',
      icon: Clock,
      label: t('profile:statsTab.totalTime'),
      value: summary?.total_time != null ? formatDuration(summary.total_time) : null,
      sub: summary?.avg_time != null ? t('profile:statsTab.perSession', { duration: formatDuration(summary.avg_time) }) : null,
    },
    {
      key: 'badges',
      icon: Trophy,
      label: t('profile:statsTab.badges'),
      value:
        badgesUnlocked != null && badgesTotal != null
          ? `${badgesUnlocked}/${badgesTotal}`
          : null,
      sub: canShowBadges ? t('profile:statsTab.unlocked') : null,
    },
    {
      key: 'streak',
      icon: Flame,
      label: t('profile:statsTab.currentStreak'),
      value: streak != null ? t('profile:statsTab.daysShort', { count: streak }) : null,
    },
    {
      key: 'best_streak',
      icon: Flame,
      label: t('profile:statsTab.bestStreak'),
      value: bestStreak != null ? t('profile:statsTab.daysShort', { count: bestStreak }) : null,
    },
    {
      key: 'completion',
      icon: Target,
      label: t('profile:statsTab.completionRate'),
      value: summary?.completion_rate != null ? `${summary.completion_rate}%` : null,
      sub:
        summary?.total_completed != null && summary?.total_sessions != null
          ? t('profile:statsTab.sessionsRatio', {
              completed: summary.total_completed,
              total: summary.total_sessions,
            })
          : null,
    },
    {
      key: 'calories',
      icon: Activity,
      label: t('profile:statsTab.estimatedCalories'),
      value:
        summary?.total_calories != null ? formatCalories(summary.total_calories) : null,
      sub: t('profile:statsTab.motivatingEstimate'),
    },
    {
      key: 'exercises',
      icon: Dumbbell,
      label: t('profile:statsTab.exercisesDone'),
      value: exercisesDone != null ? String(exercisesDone) : null,
      sub: t('profile:statsTab.recentSessionsScope'),
    },
  ].filter((item) => {
    if (item.key === 'badges' && !canShowBadges) return false;
    return item.value != null;
  });

  if (!statItems.length && !recentSessions.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
        <BarChart3 size={28} className="text-subtle mb-3" />
        <p className="text-muted text-sm">{t('profile:statsTab.empty')}</p>
        {isOwn ? (
          <p className="text-subtle text-xs mt-2">{t('profile:statsTab.emptyOwnHint')}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {statItems.map((item) => (
            <StatCard
              key={item.key}
              icon={item.icon}
              label={item.label}
              value={item.value}
              sub={item.sub}
            />
          ))}
        </div>
      ) : null}

      {canShowBadges ? (
        <BadgesPreview
          badges={soloBadges}
          summary={
            duoStats?.badges_summary || {
              unlocked: badgesUnlocked ?? 0,
              total: badgesTotal ?? 50,
            }
          }
          scope="solo"
          canPublish={isOwn}
          onSeeAll={() => navigate('/badges?scope=solo')}
        />
      ) : null}

      {recentSessions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground font-['Outfit'] uppercase tracking-wide text-muted">
            {t('profile:statsTab.recentSessions')}
          </h3>
          <div className="space-y-2">
            {recentSessions.slice(0, 5).map((session) => (
              <SessionHistoryCard
                key={session.id}
                session={{
                  ...session,
                  username: session.username || profileUser?.display_name || profileUser?.username,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
