import { Loader2, Flame, Trophy, Target, Clock, Calendar } from 'lucide-react';
import { BadgesGrid } from '../BadgesGrid';
import { ProfileEmptyState } from '../profile/ProfileEmptyState';
import { formatDuration } from '../../lib/userProfile';

export function DuoProfileStatsTab({ stats, loading, canViewBadges, canViewStats }) {
  if (!canViewStats && !canViewBadges) {
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

  const duoBadges = (stats?.badges || []).filter((b) => b.family === 'duo_social' || b.id?.startsWith('duo_'));

  return (
    <div className="space-y-6" data-testid="duo-profile-stats">
      {canViewStats && stats ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Trophy}
              label="Séances ensemble"
              value={stats.sessions_together ?? 0}
            />
            <StatCard
              icon={Flame}
              label="Streak duo"
              value={stats.duo_streak_current ?? 0}
            />
            <StatCard
              icon={Calendar}
              label="Meilleur streak"
              value={stats.duo_streak_best ?? 0}
            />
            <StatCard
              icon={Target}
              label="Défis réussis"
              value={stats.challenges_completed ?? 0}
            />
            <StatCard
              icon={Clock}
              label="Temps total"
              value={formatDuration(stats.total_training_time || 0)}
              isText
            />
            <StatCard
              icon={Calendar}
              label="Jours ensemble"
              value={stats.training_days_together ?? 0}
            />
          </div>

          {stats.current_challenge ? (
            <div className="card p-4 border-[var(--theme-primary)]/20">
              <p className="text-white font-medium mb-1">Défi de la semaine</p>
              <p className="text-zinc-400 text-sm mb-3">{stats.current_challenge.title}</p>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--theme-primary)] transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (stats.current_challenge.current / stats.current_challenge.target) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-zinc-500 text-xs mt-2">
                {stats.current_challenge.current}/{stats.current_challenge.target}
                {stats.current_challenge.status === 'completed' ? ' · Réussi' : ''}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <ProfileEmptyState
          title="Statistiques masquées"
          description="Les stats communes ne sont pas visibles publiquement."
        />
      )}

      {canViewBadges ? (
        <div>
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
            Badges duo
          </h3>
          {duoBadges.length > 0 ? (
            <BadgesGrid badges={duoBadges} />
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
