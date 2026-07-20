import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Flame,
  Zap,
  Trophy,
  UserPlus,
  Loader2,
  History,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { duoApi, sessionsApi, streakApi } from '../../lib/api';
import { ProfileStatsTab } from '../profile/ProfileStatsTab';
import { BadgesGrid } from '../BadgesGrid';
import { SessionHistoryCard } from '../history/SessionHistoryCard';
import { AnnualHeatmap } from '../agenda/AnnualHeatmap';
import { getAccentForUser } from '../../lib/userAccent';
import { computeBestStreak } from '../../lib/streakUtils';
import { formatCalories } from '../../lib/calories';
import { formatDuration } from '../../lib/userProfile';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { toast } from 'sonner';
import { PageHeader } from '../layout/PageHeader';

function filterSoloBadges(badges = []) {
  return badges.filter((b) => !b.id?.startsWith('duo_') && b.family !== 'duo');
}

export function SoloDashboard({ duoStats, duoNav, initialSessions = [], statsLoading: parentStatsLoading }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [detailedStats, setDetailedStats] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [historySessions, setHistorySessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);

  const soloBadges = useMemo(() => filterSoloBadges(duoStats?.badges), [duoStats?.badges]);
  const accentColor = getAccentForUser(user, theme);
  const bestStreak = useMemo(() => computeBestStreak(calendarDays), [calendarDays]);
  const heatmapYear = new Date().getFullYear();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'history', 'stats'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    loadStats();
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadStats = async () => {
    if (!user?.id) return;
    setStatsLoading(true);
    try {
      const [detailedRes, calendarRes] = await Promise.all([
        duoApi.getDetailedStats('all', user.id),
        streakApi.getCalendar(`${heatmapYear}-01-01`, `${heatmapYear}-12-31`),
      ]);
      setDetailedStats(detailedRes.data);
      setCalendarDays(calendarRes.data?.days || []);
    } catch {
      setDetailedStats(null);
      setCalendarDays([]);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await sessionsApi.getHistory({ limit: 100, target_user: user.id });
      setHistorySessions(data || []);
    } catch {
      toast.error('Impossible de charger l\'historique');
    } finally {
      setHistoryLoading(false);
    }
  };

  const summary = detailedStats?.summary;
  const activeDays = useMemo(() => {
    const days = new Set();
    (calendarDays || []).forEach((d) => {
      if (d.completed || d.my_completed) {
        days.add(d.date);
      }
    });
    return days.size;
  }, [calendarDays]);

  const recentSessions = useMemo(
    () => (initialSessions.length ? initialSessions : detailedStats?.recent_sessions || [])
      .filter((s) => s.user_id === user?.id || !s.user_id)
      .slice(0, 10),
    [initialSessions, detailedStats, user?.id]
  );

  return (
    <div data-testid="duo-page-solo" className="p-5 animate-fade-in">
      <PageHeader
        title={duoNav?.label || 'Duo'}
        subtitle="Votre progression à deux"
        titleTestId="solo-page-title"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full bg-[#141414] p-1 rounded-2xl border border-white/10">
          <TabsTrigger
            value="overview"
            data-testid="tab-solo-overview"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger
            value="history"
            data-testid="tab-solo-history"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Historique
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            data-testid="tab-solo-stats"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Séances terminées</p>
              <p className="text-2xl font-bold text-white">{summary?.total_completed ?? 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Temps total</p>
              <p className="text-2xl font-bold text-white">
                {summary?.total_time != null ? formatDuration(summary.total_time) : '0 min'}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Calories estimées</p>
              <p className="text-2xl font-bold text-white">
                {formatCalories(summary?.total_calories ?? 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Jours actifs</p>
              <p className="text-2xl font-bold text-white">{activeDays}</p>
            </div>
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Streak actuel</p>
              <p className="text-2xl font-bold text-white flex items-center gap-1">
                <Flame size={18} className="text-orange-500" fill="currentColor" />
                {duoStats?.streak ?? 0}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Meilleur streak</p>
              <p className="text-2xl font-bold text-white">{bestStreak ?? 0} j</p>
            </div>
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Taux complétion</p>
              <p className="text-2xl font-bold text-white">
                {summary?.completion_rate != null ? `${summary.completion_rate}%` : '—'}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Défis réussis</p>
              <p className="text-2xl font-bold text-white">{duoStats?.challenges_completed ?? 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Badges débloqués</p>
              <p className="text-2xl font-bold text-white">
                {soloBadges.filter((b) => b.unlocked).length}/{soloBadges.length}
              </p>
            </div>
          </div>

          {duoStats?.current_challenge && (
            <div className="card p-4 border-[var(--theme-primary)]/30" data-testid="solo-challenge">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="text-[var(--theme-primary)]" size={18} />
                <span className="text-white font-medium">Défi de la semaine</span>
              </div>
              <p className="text-zinc-400 text-sm mb-1">{duoStats.current_challenge.title}</p>
              <p className="text-zinc-500 text-xs mb-3">{duoStats.current_challenge.description}</p>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--theme-primary)] transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (duoStats.current_challenge.current / duoStats.current_challenge.target) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-zinc-500 text-xs mt-2">
                {duoStats.current_challenge.current}/{duoStats.current_challenge.target}
              </p>
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
              Activité récente
            </h2>
            {recentSessions.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-zinc-500">Pas encore de séance terminée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <SessionHistoryCard
                    key={session.id}
                    session={{
                      ...session,
                      username: user?.display_name || user?.username,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <Collapsible open={badgesOpen} onOpenChange={setBadgesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full card p-4">
              <div className="flex items-center gap-2">
                <Trophy className="text-[var(--theme-primary)]" size={18} />
                <span className="text-white font-medium">Badges Solo</span>
                <span className="text-zinc-500 text-sm">
                  ({soloBadges.filter((b) => b.unlocked).length}/{soloBadges.length})
                </span>
              </div>
              <ChevronDown
                className={`text-zinc-500 transition-transform ${badgesOpen ? 'rotate-180' : ''}`}
                size={18}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              {soloBadges.length > 0 ? (
                <BadgesGrid badges={soloBadges} />
              ) : (
                <p className="text-zinc-500 text-sm text-center py-4">
                  Entraîne-toi pour débloquer tes premiers badges !
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="card p-4">
            <AnnualHeatmap
              year={heatmapYear}
              userId={user?.id}
              title="Agenda annuel"
              accentColor={accentColor}
              initialDays={calendarDays.length ? calendarDays : null}
            />
          </div>
        </TabsContent>

        <TabsContent value="history">
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
            </div>
          ) : historySessions.length === 0 ? (
            <div className="card p-8 text-center">
              <History className="mx-auto text-zinc-500 mb-3" size={28} />
              <p className="text-zinc-500">Aucune séance dans l&apos;historique</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {historySessions.map((session) => (
                <SessionHistoryCard
                  key={session.id}
                  session={{
                    ...session,
                    username: user?.display_name || user?.username,
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats">
          <ProfileStatsTab
            profileUser={user}
            viewer={user}
            isOwn
            isLimited={false}
            loading={statsLoading}
            duoStats={{ ...duoStats, badges: soloBadges }}
            detailedStats={detailedStats}
            calendarDays={calendarDays}
          />
          <div className="mt-6 card p-4">
            <AnnualHeatmap
              year={heatmapYear}
              userId={user?.id}
              title="Agenda annuel"
              accentColor={accentColor}
              initialDays={calendarDays.length ? calendarDays : null}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 card p-5 border border-white/5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--theme-surface-active)] flex items-center justify-center shrink-0">
            <UserPlus className="text-[var(--theme-primary)]" size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium">Envie de progresser à deux ?</p>
            <p className="text-zinc-500 text-sm mt-1">
              Inviter ou rechercher un partenaire pour débloquer les défis et stats duo.
            </p>
            <Button asChild variant="outline" className="mt-3 rounded-xl border-white/15 text-white">
              <Link to="/profile">Inviter ou rechercher un partenaire</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
