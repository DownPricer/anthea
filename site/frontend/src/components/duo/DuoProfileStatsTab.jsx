import { useState } from 'react';
import { Loader2, Flame, Trophy, Target, Clock, Calendar, Zap, Medal } from 'lucide-react';
import { BadgesGrid } from '../BadgesGrid';
import { ProfileEmptyState } from '../profile/ProfileEmptyState';
import { ShareDuoBadgeButton } from './ShareDuoBadgeDialog';
import { formatDuration } from '../../lib/userProfile';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const [showAllBadges, setShowAllBadges] = useState(false);

  if (!canViewStats && !canViewBadges && !canViewChallenges) {
    return (
      <ProfileEmptyState
        title="Statistiques masquées"
        description="Ce duo a choisi de garder ses statistiques privées."
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
        title="Stats indisponibles"
        description={statsError}
      />
    );
  }

  if (!stats && (canViewStats || canViewBadges)) {
    return (
      <ProfileEmptyState
        title="Aucune statistique"
        description="Les stats communes apparaîtront après vos premières séances ensemble."
      />
    );
  }

  const duoBadges = (stats?.badges || []).filter((b) => b.family === 'duo_social' || b.id?.startsWith('duo_'));
  const unlockedBadges = duoBadges.filter((b) => b.unlocked);
  const displayedBadges = showAllBadges ? duoBadges : unlockedBadges.slice(0, 8);

  return (
    <div className="space-y-6" data-testid="duo-profile-stats">
      {canViewStats && stats ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Trophy} label="Séances ensemble" value={stats.sessions_together ?? 0} />
            <StatCard icon={Flame} label="Streak duo" value={stats.duo_streak_current ?? 0} />
            <StatCard icon={Calendar} label="Meilleur streak" value={stats.duo_streak_best ?? 0} />
            <StatCard icon={Target} label="Défis réussis" value={stats.challenges_completed ?? 0} />
            <StatCard icon={Clock} label="Temps total" value={formatDuration(stats.total_training_time || 0)} isText />
            <StatCard icon={Calendar} label="Jours ensemble" value={stats.training_days_together ?? 0} />
            <StatCard icon={Zap} label="Calories estimées" value={stats.estimated_calories ?? 0} />
            <StatCard icon={Medal} label="Badges duo" value={stats.badges_unlocked ?? unlockedBadges.length} />
          </div>

          {stats.last_common_session ? (
            <div className="card p-4 border-white/10">
              <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Dernière séance commune</p>
              <p className="text-white text-sm font-medium">
                {stats.last_common_session.date
                  ? format(parseISO(stats.last_common_session.date), 'd MMMM yyyy', { locale: fr })
                  : '—'}
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                {stats.last_common_session.title_a} · {stats.last_common_session.title_b}
              </p>
            </div>
          ) : null}
        </>
      ) : !canViewStats ? (
        <ProfileEmptyState
          title="Statistiques masquées"
          description="Les stats communes ne sont pas visibles publiquement."
        />
      ) : null}

      {canViewChallenges && stats?.current_challenge ? (
        <div className="card p-4 border-[var(--theme-primary)]/20">
          <p className="text-white font-medium mb-1">Défi de la semaine</p>
          <p className="text-zinc-400 text-sm mb-3">{stats.current_challenge.title}</p>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
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
          <p className="text-zinc-500 text-xs mt-2">
            {stats.current_challenge.current}/{stats.current_challenge.target}
            {stats.current_challenge.status === 'completed' ? ' · Réussi' : ''}
          </p>
        </div>
      ) : canViewChallenges && (canViewStats || duoProfile?.is_member) ? (
        <ProfileEmptyState title="Aucun défi en cours" description="Le défi de la semaine apparaîtra ici." />
      ) : null}

      {canViewBadges ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Badges duo</h3>
            {duoBadges.length > 8 ? (
              <button
                type="button"
                onClick={() => setShowAllBadges((v) => !v)}
                className="text-xs text-[var(--theme-primary)] hover:underline"
              >
                {showAllBadges ? 'Réduire' : 'Voir tous les badges duo'}
              </button>
            ) : null}
          </div>
          {displayedBadges.length > 0 ? (
            <div className="space-y-3">
              <div className="flex w-full justify-center">
                <BadgesGrid badges={displayedBadges} />
              </div>
              {duoProfile?.is_member && unlockedBadges.length > 0 ? (
                <p className="text-center text-zinc-500 text-xs">
                  Publier un badge :{' '}
                  {unlockedBadges.slice(0, 3).map((badge, i) => (
                    <span key={badge.id}>
                      {i > 0 ? ' · ' : ''}
                      <ShareDuoBadgeButton badge={badge} onShared={onBadgeShared} />
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          ) : (
            <ProfileEmptyState
              title="Aucun badge duo"
              description="Entraînez-vous ensemble pour débloquer des badges."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, isText = false }) {
  return (
    <div className="card p-4 text-center">
      <Icon className="mx-auto text-[var(--theme-primary)] mb-2" size={18} />
      <p className={`font-bold text-white ${isText ? 'text-base' : 'text-2xl'}`}>{value}</p>
      <p className="text-zinc-500 text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
