import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Flame,
  Zap,
  Trophy,
  UserPlus,
  Loader2,
  History,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { duoApi, sessionsApi, streakApi } from '../../lib/api';
import { ProfileStatsTab } from '../profile/ProfileStatsTab';
import { SessionHistoryCard } from '../history/SessionHistoryCard';
import { CollapsibleAnnualAgenda } from '../agenda/CollapsibleAnnualAgenda';
import { getAccentForUser } from '../../lib/userAccent';
import { computeBestStreak } from '../../lib/streakUtils';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getBadgeDisplayName } from '../../lib/featuredBadges';
import { resolveChallengeLabels } from '../../i18n/challengeLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { PageHeader } from '../layout/PageHeader';
import { BadgeArtwork } from '../badges/BadgeArtwork';
import { duoCacheKey, fetchDuoCached, DUO_STALE } from '../../lib/duoCache';

function filterSoloBadges(badges = []) {
  return badges.filter((b) => !b.id?.startsWith('duo_') && b.family !== 'duo');
}

export function SoloDashboard({ duoStats, duoNav, initialSessions = [], statsLoading: parentStatsLoading }) {
  const { t } = useTranslation(['duo', 'common', 'badges', 'challenges']);
  const { formatDuration, formatCalories } = useLocaleFormat();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [detailedStats, setDetailedStats] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [historySessions, setHistorySessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const soloBadges = useMemo(() => filterSoloBadges(duoStats?.badges), [duoStats?.badges]);
  const recentSoloBadges = useMemo(
    () => [...(soloBadges || [])]
      .filter((b) => b?.unlocked && b?.id)
      .sort((a, b) => String(b?.unlocked_at || b?.unlockedAt || '').localeCompare(String(a?.unlocked_at || a?.unlockedAt || '')))
      .slice(0, 3),
    [soloBadges]
  );
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
      const detailedKey = duoCacheKey('detailedStats', user.id, 'all');
      const calKey = duoCacheKey('calendar', user.id, String(heatmapYear));
      const [detailedData, calendarData] = await Promise.allSettled([
        fetchDuoCached(
          detailedKey,
          async () => {
            const { data } = await duoApi.getDetailedStats('all', user.id);
            return data;
          },
          DUO_STALE.detailedStats,
        ),
        fetchDuoCached(
          calKey,
          async () => {
            const { data } = await streakApi.getCalendar(
              `${heatmapYear}-01-01`,
              `${heatmapYear}-12-31`,
            );
            return data?.days || [];
          },
          DUO_STALE.detailedStats,
        ),
      ]);
      setDetailedStats(detailedData.status === 'fulfilled' ? detailedData.value : null);
      setCalendarDays(calendarData.status === 'fulfilled' ? calendarData.value || [] : []);
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
      toast.error(t('duo:solo.historyLoadError'));
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
        title={duoNav?.label || t('duo:title')}
        subtitle={t('duo:subtitle')}
        titleTestId="solo-page-title"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full bg-surface-elevated p-1 rounded-2xl border border-border">
          <TabsTrigger
            value="overview"
            data-testid="tab-solo-overview"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-foreground"
          >
            {t('duo:overview')}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            data-testid="tab-solo-history"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-foreground"
          >
            {t('duo:history')}
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            data-testid="tab-solo-stats"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-foreground"
          >
            {t('duo:stats')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.completedWorkouts')}</p>
              <p className="text-2xl font-bold text-foreground">{summary?.total_completed ?? 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.totalTime')}</p>
              <p className="text-2xl font-bold text-foreground">
                {summary?.total_time != null ? formatDuration(summary.total_time) : '0 min'}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.estimatedCalories')}</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCalories(summary?.total_calories ?? 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.activeDays')}</p>
              <p className="text-2xl font-bold text-foreground">{activeDays}</p>
            </div>
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.currentStreak')}</p>
              <p className="text-2xl font-bold text-foreground flex items-center gap-1">
                <Flame size={18} className="text-orange-500" fill="currentColor" />
                {duoStats?.streak ?? 0}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.bestStreak')}</p>
              <p className="text-2xl font-bold text-foreground">{bestStreak ?? 0} j</p>
            </div>
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.completionRate')}</p>
              <p className="text-2xl font-bold text-foreground">
                {summary?.completion_rate != null ? `${summary.completion_rate}%` : '—'}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.challengesCompleted')}</p>
              <p className="text-2xl font-bold text-foreground">{duoStats?.challenges_completed ?? 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-subtle text-xs uppercase tracking-wide mb-1">{t('duo:solo.badgesUnlocked')}</p>
              <p className="text-2xl font-bold text-foreground">
                {soloBadges.filter((b) => b.unlocked).length}/{soloBadges.length}
              </p>
            </div>
          </div>

          {duoStats?.current_challenge && (
            <div className="card p-4 border-[var(--theme-primary)]/30" data-testid="solo-challenge">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="text-[var(--theme-primary)]" size={18} />
                <span className="text-foreground font-medium">{t('duo:weeklyChallenge')}</span>
              </div>
              {(() => {
                const labels = resolveChallengeLabels(duoStats.current_challenge, t);
                return (
                  <>
                    <p className="text-muted text-sm mb-1">{labels.title}</p>
                    <p className="text-subtle text-xs mb-3">{labels.description}</p>
                  </>
                );
              })()}
              <div className="h-2 bg-hover rounded-full overflow-hidden">
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
              <p className="text-subtle text-xs mt-2">
                {t('challenges:ui.progress')}: {duoStats.current_challenge.current}/{duoStats.current_challenge.target}
              </p>
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
              {t('duo:recentActivity')}
            </h2>
            {recentSessions.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-subtle">{t('duo:emptyStates.noSessionYet')}</p>
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

          <CollapsibleAnnualAgenda
            year={heatmapYear}
            userId={user?.id}
            title={t('duo:solo.annualAgenda')}
            accentColor={accentColor}
            initialDays={calendarDays.length ? calendarDays : null}
            defaultOpen={false}
            className="card p-4"
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4" data-testid="solo-history-tab">
          {historyLoading ? (
            <div className="flex justify-center py-12" data-testid="solo-history-list">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
            </div>
          ) : historySessions.length === 0 ? (
            <div className="card p-8 text-center" data-testid="solo-history-list">
              <History className="mx-auto text-subtle mb-3" size={28} />
              <p className="text-subtle">{t('duo:emptyStates.history')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="solo-history-list">
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
          <CollapsibleAnnualAgenda
            year={heatmapYear}
            userId={user?.id}
            title={t('duo:solo.annualAgenda')}
            accentColor={accentColor}
            initialDays={calendarDays.length ? calendarDays : null}
            defaultOpen={false}
          />
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

          <div className="mt-6 card p-4 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground font-medium">{t('duo:solo.myBadges')}</p>
                <p className="text-subtle text-xs">
                  {t('duo:solo.badgesUnlockedCount', {
                    unlocked: soloBadges.filter((b) => b.unlocked).length,
                    total: soloBadges.length || 50,
                  })}
                </p>
              </div>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full border-border text-foreground shrink-0"
                data-testid="solo-stats-open-badges"
              >
                <Link to="/badges?scope=solo">{t('duo:solo.showBadges')}</Link>
              </Button>
            </div>
            {recentSoloBadges.length > 0 ? (
              <div className="mt-3 flex items-center gap-3">
                {recentSoloBadges.map((badge) => {
                  const badgeName = getBadgeDisplayName(badge, (key, opts) => t(key, { ...opts, ns: 'badges' }));
                  return (
                  <div key={badge.id} className="min-w-0 w-16 overflow-hidden text-center" title={badgeName}>
                    <BadgeArtwork
                      rarity={badge.rarity_key || badge.rarity}
                      iconKey={badge.icon_key || badge.icon || 'trophy'}
                      locked={false}
                      size={40}
                      className="mx-auto shrink-0 size-10"
                    />
                    <p className="mt-1 min-w-0 line-clamp-2 break-words text-[10px] text-muted">
                      {badgeName}
                    </p>
                  </div>
                );})}
              </div>
            ) : null}
          </div>

          <CollapsibleAnnualAgenda
            year={heatmapYear}
            userId={user?.id}
            title={t('duo:solo.annualAgenda')}
            accentColor={accentColor}
            initialDays={calendarDays.length ? calendarDays : null}
            defaultOpen={false}
            className="mt-6 card p-4"
          />
        </TabsContent>
      </Tabs>

      <div className="mt-8 card p-5 border border-border">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--theme-surface-active)] flex items-center justify-center shrink-0">
            <UserPlus className="text-[var(--theme-primary)]" size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-medium">{t('duo:solo.inviteTitle')}</p>
            <p className="text-subtle text-sm mt-1">
              {t('duo:solo.inviteHint')}
            </p>
            <Button asChild variant="outline" className="mt-3 rounded-xl border-border text-foreground">
              <Link to="/profile">{t('duo:solo.inviteCta')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
