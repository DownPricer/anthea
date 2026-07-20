import { useMemo } from 'react';
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
        <span className="text-zinc-400 text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white font-['Outfit']">{value}</p>
      {sub ? <p className="text-zinc-500 text-xs mt-1">{sub}</p> : null}
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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-14 text-center">
        <Lock size={28} className="text-zinc-500 mb-3" />
        <p className="text-white font-medium">Statistiques privées</p>
        <p className="text-zinc-500 text-sm mt-2 max-w-sm">
          Cet utilisateur a choisi de garder ses stats confidentielles.
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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
        <BarChart3 size={28} className="text-zinc-600 mb-3" />
        <p className="text-zinc-400 text-sm">Les statistiques ne sont pas visibles sur ce profil.</p>
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
      label: 'Séances totales',
      value: summary?.total_completed != null ? String(summary.total_completed) : null,
      sub: summary?.total_sessions != null ? `${summary.total_sessions} tentatives` : null,
    },
    {
      key: 'time',
      icon: Clock,
      label: 'Temps total',
      value: summary?.total_time != null ? formatDuration(summary.total_time) : null,
      sub: summary?.avg_time != null ? `~${formatDuration(summary.avg_time)} / séance` : null,
    },
    {
      key: 'badges',
      icon: Trophy,
      label: 'Badges',
      value:
        badgesUnlocked != null && badgesTotal != null
          ? `${badgesUnlocked}/${badgesTotal}`
          : null,
      sub: canShowBadges ? 'Débloqués' : null,
    },
    {
      key: 'streak',
      icon: Flame,
      label: 'Streak actuel',
      value: streak != null ? `${streak} j` : null,
    },
    {
      key: 'best_streak',
      icon: Flame,
      label: 'Meilleur streak',
      value: bestStreak != null ? `${bestStreak} j` : null,
    },
    {
      key: 'completion',
      icon: Target,
      label: 'Taux complétion',
      value: summary?.completion_rate != null ? `${summary.completion_rate}%` : null,
      sub:
        summary?.total_completed != null && summary?.total_sessions != null
          ? `${summary.total_completed}/${summary.total_sessions} séances`
          : null,
    },
    {
      key: 'calories',
      icon: Activity,
      label: 'Calories estimées',
      value:
        summary?.total_calories != null ? formatCalories(summary.total_calories) : null,
      sub: 'Estimation motivante',
    },
    {
      key: 'exercises',
      icon: Dumbbell,
      label: 'Exercices réalisés',
      value: exercisesDone != null ? String(exercisesDone) : null,
      sub: 'Sur les séances récentes',
    },
  ].filter((item) => {
    if (item.key === 'badges' && !canShowBadges) return false;
    return item.value != null;
  });

  if (!statItems.length && !recentSessions.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
        <BarChart3 size={28} className="text-zinc-600 mb-3" />
        <p className="text-zinc-400 text-sm">Pas encore de statistiques à afficher.</p>
        {isOwn ? (
          <p className="text-zinc-600 text-xs mt-2">Commence une séance pour remplir ton profil !</p>
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
          <h3 className="text-sm font-semibold text-white font-['Outfit'] uppercase tracking-wide text-zinc-400">
            Séances récentes
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
