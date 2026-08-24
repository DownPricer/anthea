import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PartnerLiveStatus } from '../components/PartnerLiveStatus';
import { usePartnerLiveSession } from '../hooks/usePartnerLiveSession';
import { useDuoNavLabel } from '../hooks/useDuoNavLabel';
import { formatCalories } from '../lib/calories';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { sessionsApi, duoApi, partnerApi, streakApi, notificationsApi, duoProfilesApi, formatApiError } from '../lib/api';
import { SoloDashboard } from '../components/duo/SoloDashboard';
import { NotificationBell } from '../components/NotificationBell';
import { BadgeArtwork } from '../components/badges/BadgeArtwork';
import { getBadgeDisplayName } from '../lib/featuredBadges';
import { CollapsibleAnnualAgenda } from '../components/agenda/CollapsibleAnnualAgenda';
import { CommonSessionCard } from '../components/duo/CommonSessionCard';
import { DuoCompactStatCard } from '../components/duo/DuoCompactStatCard';
import {
  DuoHeaderSkeleton,
  DuoStatsCardsSkeleton,
  DuoChallengeSkeleton,
  DuoBadgesSkeleton,
  DuoActivitySkeleton,
} from '../components/duo/DuoSkeletons';
import { duoProfilePath, getDuoRoleLabel } from '../lib/duoProfile';
import {
  getDuoCache,
  setDuoCache,
  duoCacheKey,
  DUO_STALE,
  duoTime,
  dedupeInflight,
} from '../lib/duoCache';
import { filterDuoHistoryFeed, getDuoHistoryEmptyKey } from '../lib/duoHistory';
import { DuoMembersAvatar } from '../components/duo/DuoMembersAvatar';
import { UserAvatar } from '../components/UserAvatar';
import { getDisplayName } from '../lib/userProfile';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Heart,
  Flame,
  MessageCircle,
  Trophy,
  Clock,
  Zap,
  Send,
  Loader2,
  UserPlus,
  ChevronRight,
  BarChart3,
  Target,
  TrendingUp,
  Calendar,
  Activity,
  Download,
  History,
  Users,
  Flame as FlameIcon,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { useLocaleFormat } from '../hooks/useLocaleFormat';

const REACTION_TYPES = [
  { type: 'bravo', emoji: '👏', key: 'bravo' },
  { type: 'proud', emoji: '🥹', key: 'proud' },
  { type: 'fire', emoji: '🔥', key: 'fire' },
  { type: 'heart', emoji: '❤️', key: 'heart' },
  { type: 'strong', emoji: '💪', key: 'awesome' },
];

const DUO_TABS = ['activity', 'stats', 'history'];

function initialDuoTab(searchParams) {
  const requested = searchParams.get('tab');
  if (DUO_TABS.includes(requested)) return requested;
  try {
    const saved = sessionStorage.getItem('duo-active-tab');
    return DUO_TABS.includes(saved) ? saved : 'activity';
  } catch {
    return 'activity';
  }
}

function getMemberUserId(member) {
  return member?.user_id || member?.id || null;
}

function toStatsPeriodParam(period) {
  // Backend attend 7 / 30 / 90 / year / all
  if (period === '7d') return '7';
  if (period === '30d') return '30';
  if (period === '90d') return '90';
  if (period === 'year') return 'year';
  if (period === 'all') return 'all';
  return '30';
}

function normalizeStatsView(payload) {
  const base = {
    summary: {
      workouts: 0,
      duration_minutes: 0,
      calories: null,
      active_days: 0,
      streak: 0,
    },
    wellbeing: {
      fatigue_before: null,
      fatigue_after: null,
      mood_before: null,
      mood_after: null,
    },
    recent_sessions: [],
    charts: [],
    _extras: {
      completion_rate: null,
      total_sessions: 0,
      total_completed: 0,
      total_abandoned: 0,
      avg_time_minutes: null,
      this_week: null,
      this_month: null,
      calories_week: null,
      calories_month: null,
      difficulty: null,
      daily: [],
      weekly: [],
    },
  };

  if (!payload || typeof payload !== 'object') return base;

  const summary = payload.summary || payload?.data?.summary || null;
  const averages = payload.averages || payload?.data?.averages || null;
  const recent = payload.recent_sessions || payload?.data?.recent_sessions || [];
  const daily = payload.daily_stats || payload?.data?.daily_stats || [];
  const weekly = payload.weekly_stats || payload?.data?.weekly_stats || [];

  const totalSessions = Number(summary?.total_sessions ?? 0) || 0;
  const totalTimeSec = Number(summary?.total_time ?? 0) || 0;
  const totalCalories = summary?.total_calories;

  const activeDaysFromSummary = Number.isFinite(Number(summary?.active_days))
    ? Number(summary.active_days)
    : null;
  const activeDaysFromDaily = Array.isArray(daily)
    ? daily.filter((d) => (Number(d?.count ?? 0) || 0) > 0).length
    : 0;
  const activeDays = activeDaysFromSummary != null ? activeDaysFromSummary : activeDaysFromDaily;

  const currentStreak = Number.isFinite(Number(payload.current_streak ?? summary?.current_streak))
    ? Number(payload.current_streak ?? summary?.current_streak)
    : null;
  const bestStreak = Number.isFinite(Number(payload.best_streak ?? summary?.best_streak))
    ? Number(payload.best_streak ?? summary?.best_streak)
    : null;
  const lastSession = payload.last_session || payload?.data?.last_session || recent?.[0] || null;

  return {
    ...base,
    summary: {
      ...base.summary,
      workouts: totalSessions,
      duration_minutes: Math.round(totalTimeSec / 60),
      calories: Number.isFinite(Number(totalCalories)) ? Number(totalCalories) : null,
      active_days: activeDays,
      streak: currentStreak ?? 0,
      current_streak: currentStreak,
      best_streak: bestStreak,
    },
    wellbeing: {
      ...base.wellbeing,
      fatigue_before: averages?.fatigue_before ?? null,
      fatigue_after: averages?.fatigue_after ?? null,
      mood_before: averages?.mood_before ?? null,
      mood_after: averages?.mood_after ?? null,
    },
    recent_sessions: Array.isArray(recent) ? recent : [],
    last_session: lastSession,
    current_streak: currentStreak,
    best_streak: bestStreak,
    charts: [
      { kind: 'daily', data: Array.isArray(daily) ? daily : [] },
      { kind: 'weekly', data: Array.isArray(weekly) ? weekly : [] },
    ],
    _extras: {
      completion_rate: summary?.completion_rate ?? null,
      total_sessions: totalSessions,
      total_completed: Number(summary?.total_completed ?? 0) || 0,
      total_abandoned: Number(summary?.total_abandoned ?? 0) || 0,
      avg_time_minutes: Number.isFinite(Number(summary?.avg_time))
        ? Math.round(Number(summary.avg_time) / 60)
        : null,
      this_week: Number.isFinite(Number(summary?.this_week)) ? Number(summary.this_week) : null,
      this_month: Number.isFinite(Number(summary?.this_month)) ? Number(summary.this_month) : null,
      calories_week: Number.isFinite(Number(summary?.week_calories))
        ? Number(summary.week_calories)
        : null,
      calories_month: Number.isFinite(Number(summary?.month_calories))
        ? Number(summary.month_calories)
        : null,
      difficulty: averages?.difficulty ?? null,
      daily: Array.isArray(daily) ? daily : [],
      weekly: Array.isArray(weekly) ? weekly : [],
      current_streak: currentStreak,
      best_streak: bestStreak,
      active_days: activeDays,
      last_session: lastSession,
    },
  };
}

export function DuoPage() {
  const { t } = useTranslation(['duo', 'common', 'notifications', 'workouts', 'badges', 'settings']);
  const { formatDayMonth, formatDayMonthTime } = useLocaleFormat();
  const { user, refreshUser } = useAuth();
  const quickReactions = useMemo(
    () => REACTION_TYPES.map((r) => ({ ...r, label: t(`duo:reactions.${r.key}`) })),
    [t]
  );
  const { theme } = useTheme();
  const navigate = useNavigate();
  const duoNav = useDuoNavLabel();
  const [searchParams] = useSearchParams();
  const [pendingDuoFollow, setPendingDuoFollow] = useState(null);
  
  const [activeTab, setActiveTab] = useState(() => initialDuoTab(searchParams));
  const [sessions, setSessions] = useState([]);
  const [duoStats, setDuoStats] = useState(null);
  const [duoProfile, setDuoProfile] = useState(null);
  const [partner, setPartner] = useState(null);
  /** Boot: partner résolu (null = solo, object = duo). false tant que /partner/info n'a pas répondu. */
  const [partnerReady, setPartnerReady] = useState(false);
  const [statsBootLoading, setStatsBootLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [activeCommentSession, setActiveCommentSession] = useState(null);
  const loadGenRef = useRef(0);
  
  // Stats state
  const [duoViewStats, setDuoViewStats] = useState(null);
  const [memberStats, setMemberStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('30d');
  // 'duo' | `user:<id>`
  const [statsScope, setStatsScope] = useState('duo');
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [canModerateStreak, setCanModerateStreak] = useState(false);
  const [coachStreakInput, setCoachStreakInput] = useState('');
  const [exemptDateStr, setExemptDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [exemptWho, setExemptWho] = useState('partner'); // 'me' | 'partner'
  const [historyFeed, setHistoryFeed] = useState([]);
  const [historyScope, setHistoryScope] = useState('all');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTarget, setHistoryTarget] = useState('me'); // export coach uniquement
  const [exporting, setExporting] = useState(false);
  const [exportPeriod, setExportPeriod] = useState('30d');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const { liveSession } = usePartnerLiveSession(!!partner);

  const duoMembers = Array.isArray(duoProfile?.members) ? duoProfile.members : [];
  const viewerMember = duoMembers.find((member) => String(getMemberUserId(member)) === String(user?.id));
  const partnerMember = duoMembers.find((member) => String(getMemberUserId(member)) !== String(user?.id));
  const viewerUserId = getMemberUserId(viewerMember) || user?.id;
  const partnerUserId = getMemberUserId(partnerMember) || user?.partner_id || partner?.id;
  const pairKey = duoProfile?.pair_key || (
    viewerUserId && partnerUserId
      ? [viewerUserId, partnerUserId].map(String).sort().join('_')
      : 'solo'
  );

  const loadDuoNotifications = useCallback(async () => {
    const cacheParts = ['duo', 'notifications', pairKey];
    const cached = getDuoCache(cacheParts);
    if (cached) {
      setPendingDuoFollow(cached);
      return;
    }
    try {
      const { data } = await notificationsApi.list(30, 'duo');
      const pending = (data || []).find(
        (n) => n.type === 'duo_follow_request' && !n.read && n.request_id
      ) || null;
      setPendingDuoFollow(pending);
      setDuoCache(cacheParts, pending, DUO_STALE.notifications);
    } catch {
      setPendingDuoFollow(null);
    }
  }, [pairKey]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (partner) {
      loadDuoNotifications();
    }
  }, [partner, loadDuoNotifications]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && DUO_TABS.includes(tab)) {
      setActiveTab(tab);
      try {
        sessionStorage.setItem('duo-active-tab', tab);
      } catch {
        /* stockage indisponible */
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'stats' && partnerUserId) {
      loadSelectedStats();
    }
    if (activeTab === 'history') {
      loadHistory();
    }
    // Intentionally omit loader fns — they close over current filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statsPeriod, statsScope, partnerUserId]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem('duo-active-tab', tab);
    } catch {
      /* stockage indisponible */
    }
  };

  const historyItems = useMemo(
    () => filterDuoHistoryFeed(historyFeed, historyScope, user?.id, partnerUserId),
    [historyFeed, historyScope, user?.id, partnerUserId],
  );

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await duoApi.getActivityFeed(100);
      const sorted = (data || []).sort((a, b) => {
        const aTime = a.created_at || a.date || '';
        const bTime = b.created_at || b.date || '';
        return bTime.localeCompare(aTime);
      });
      setHistoryFeed(sorted);
    } catch {
      toast.error(t('duo:errors.historyLoadError'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExport = async (exportFormat = 'csv') => {
    setExporting(true);
    try {
      const targetUser = historyTarget === 'me' ? user.id : partner?.id;
      const params = {
        target_user: targetUser,
        period: exportPeriod,
        export_format: exportFormat,
      };
      if (exportPeriod === 'custom') {
        if (!exportStartDate || !exportEndDate) {
          toast.error(t('duo:export.pickDates'));
          setExporting(false);
          return;
        }
        params.start_date = exportStartDate;
        params.end_date = exportEndDate;
      }
      const { data } = await sessionsApi.export(params);
      const isHtml = exportFormat === 'html';
      const url = window.URL.createObjectURL(
        new Blob([data], { type: isHtml ? 'text/html' : 'text/csv' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `anthea_export_${format(new Date(), 'yyyy-MM-dd')}.${isHtml ? 'html' : 'csv'}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(t('duo:export.downloaded'));
    } catch {
      toast.error(t('duo:export.unauthorized'));
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    const gen = ++loadGenRef.current;
    const endTotal = duoTime('total');
    const endPartner = duoTime('partner');
    const endProfile = duoTime('profile');
    const endStats = duoTime('stats');
    const endActivity = duoTime('activity');
    const endCoach = duoTime('coach');

    const partnerCacheKey = duoCacheKey('partner', user?.id || 'anon');
    const profileCacheKey = duoCacheKey('profile', user?.id || 'anon');
    const statsKeyHint = duoCacheKey('stats', pairKey);

    // Hydratation immédiate depuis le cache (retour page = pas d'écran vide).
    const cachedPartner = getDuoCache(partnerCacheKey);
    if (cachedPartner !== null && cachedPartner !== undefined) {
      setPartner(cachedPartner || null);
      setPartnerReady(true);
    }
    const cachedProfile = getDuoCache(profileCacheKey);
    if (cachedProfile) {
      setDuoProfile(cachedProfile);
    }
    const cachedStats = getDuoCache(statsKeyHint);
    if (cachedStats) {
      setDuoStats(cachedStats);
      setStatsBootLoading(false);
    }

    // Priorité : identité Duo + photo/bannière + défi/semaine (via stats) — en parallèle.
    const partnerPromise = (async () => {
      try {
        const { data } = await partnerApi.getInfo();
        if (gen !== loadGenRef.current) return data;
        setPartner(data || null);
        setDuoCache(partnerCacheKey, data || null, DUO_STALE.partner);
        return data;
      } catch (error) {
        console.error('Failed to load partner', error);
        if (gen === loadGenRef.current) setPartner(null);
        return null;
      } finally {
        endPartner();
        if (gen === loadGenRef.current) setPartnerReady(true);
      }
    })();

    const profilePromise = (async () => {
      try {
        const { data } = await duoApi.getProfile();
        if (gen !== loadGenRef.current) return data;
        setDuoProfile(data || null);
        if (data) setDuoCache(profileCacheKey, data, DUO_STALE.profile);
        return data;
      } catch (error) {
        console.error('Failed to load duo profile', error);
        if (gen === loadGenRef.current && !cachedProfile) setDuoProfile(null);
        return null;
      } finally {
        endProfile();
      }
    })();

    const statsPromise = (async () => {
      try {
        const data = await dedupeInflight(statsKeyHint, async () => {
          const res = await duoApi.getStats();
          return res.data;
        });
        if (gen !== loadGenRef.current) return data;
        setDuoStats(data);
        const pk = data?.duo_profile?.pair_key || pairKey;
        setDuoCache(duoCacheKey('stats', pk), data, DUO_STALE.stats);
        if (data?.duo_profile) {
          setDuoCache(profileCacheKey, data.duo_profile, DUO_STALE.profile);
        }
        if (data?.badges) {
          setDuoCache(duoCacheKey('badges', pk), data.badges, DUO_STALE.badges);
        }
        if (data?.current_challenge) {
          const weekKey = data.current_challenge.week_key || 'current';
          setDuoCache(
            duoCacheKey('challenges', pk, weekKey),
            data.current_challenge,
            DUO_STALE.challenges
          );
        }
        return data;
      } catch (error) {
        console.error('Failed to load duo stats', error);
        return null;
      } finally {
        endStats();
        if (gen === loadGenRef.current) setStatsBootLoading(false);
      }
    })();

    await Promise.allSettled([partnerPromise, profilePromise, statsPromise]);

    // Secondaire : activité + coach — ne bloquent pas le contenu prioritaire.
    const scheduleSecondary = (fn) => {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(fn, { timeout: 1500 });
      } else {
        setTimeout(fn, 0);
      }
    };

    scheduleSecondary(() => {
      const activityPromise = (async () => {
        const actKey = duoCacheKey('activity', pairKey);
        const cached = getDuoCache(actKey);
        if (cached) {
          if (gen === loadGenRef.current) {
            setSessions(cached);
            setActivityLoading(false);
          }
          endActivity();
        }
        try {
          const { data } = await duoApi.getActivityFeed(20);
          if (gen !== loadGenRef.current) return data;
          const list = data || [];
          setSessions(list);
          setDuoCache(actKey, list, DUO_STALE.activity);
          return list;
        } catch (error) {
          console.error('Failed to load activity', error);
          return [];
        } finally {
          endActivity();
          if (gen === loadGenRef.current) setActivityLoading(false);
        }
      })();

      const coachPromise = (async () => {
        try {
          const { data } = await streakApi.getCoachStatus();
          if (gen === loadGenRef.current) setCanModerateStreak(!!data?.can_moderate);
        } catch {
          if (gen === loadGenRef.current) setCanModerateStreak(false);
        } finally {
          endCoach();
        }
      })();

      Promise.allSettled([activityPromise, coachPromise]).then(() => endTotal());
    });
  };

  const handleCoachSetStreak = async () => {
    const n = parseInt(coachStreakInput, 10);
    if (Number.isNaN(n) || n < 0) {
      toast.error('Nombre invalide');
      return;
    }
    if (!window.confirm(`Afficher la streak à ${n} pour ce duo ?`)) return;
    try {
      await streakApi.coachSetManualStreak(n);
      toast.success(t('duo:coachSettings.streakUpdated'));
      const { data } = await duoApi.getStats();
      setDuoStats(data);
      setCoachStreakInput('');
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleCoachClearStreak = async () => {
    if (!window.confirm('Revenir au calcul automatique de la streak ?')) return;
    try {
      await streakApi.coachSetManualStreak(null);
      toast.success(t('duo:coachSettings.manualCleared'));
      const { data } = await duoApi.getStats();
      setDuoStats(data);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleCoachExemptDay = async () => {
    const uid = exemptWho === 'me' ? user?.id : partner?.id;
    if (!uid || !exemptDateStr) return;
    if (!window.confirm(`Traiter ${exemptDateStr} comme jour exempt pour la streak ?`)) return;
    try {
      await streakApi.coachExemptDay(exemptDateStr, uid);
      toast.success(t('duo:coachSettings.exemptSaved'));
      const { data } = await duoApi.getStats();
      setDuoStats(data);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const loadSelectedStats = async () => {
    if (!viewerUserId || !partnerUserId) return;
    const scope = statsScope || 'duo';
    const periodParam = toStatsPeriodParam(statsPeriod);
    const cacheKey = duoCacheKey('detailedStats', pairKey, statsPeriod, scope);

    const cached = getDuoCache(cacheKey);
    if (cached) {
      if (scope === 'duo') setDuoViewStats(cached);
      else setMemberStats(cached);
      setStatsError(null);
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);
    setStatsError(null);
    if (scope === 'duo') setDuoViewStats(null);
    else setMemberStats(null);

    try {
      if (scope === 'duo') {
        const [viewerRes, partnerRes] = await Promise.all([
          duoApi.getDetailedStats(periodParam, viewerUserId),
          duoApi.getDetailedStats(periodParam, partnerUserId),
        ]);
        const viewerPayload = viewerRes.data;
        const partnerPayload = partnerRes.data;
        const normalizedViewer = normalizeStatsView(viewerPayload);
        const normalizedPartner = normalizeStatsView(partnerPayload);
        const combined = {
          kind: 'duo',
          period: statsPeriod,
          viewer: normalizedViewer,
          partner: normalizedPartner,
          summary: {
            workouts: (normalizedViewer.summary.workouts || 0) + (normalizedPartner.summary.workouts || 0),
            duration_minutes:
              (normalizedViewer.summary.duration_minutes || 0)
              + (normalizedPartner.summary.duration_minutes || 0),
            calories:
              (normalizedViewer.summary.calories || 0)
              + (normalizedPartner.summary.calories || 0),
            active_days:
              (normalizedViewer.summary.active_days || 0)
              + (normalizedPartner.summary.active_days || 0),
            streak: 0,
          },
          _extras: {
            total_sessions:
              (normalizedViewer._extras.total_sessions || 0)
              + (normalizedPartner._extras.total_sessions || 0),
            total_completed:
              (normalizedViewer._extras.total_completed || 0)
              + (normalizedPartner._extras.total_completed || 0),
          },
          wellbeing: {
            fatigue_before: null,
            fatigue_after: null,
            mood_before: null,
            mood_after: null,
          },
          recent_sessions: [],
          charts: [],
        };
        setDuoViewStats(combined);
        setDuoCache(cacheKey, combined, DUO_STALE.detailedStats);
      } else {
        const selectedMemberId = scope.startsWith('user:') ? scope.slice(5) : viewerUserId;
        const response = await duoApi.getDetailedStats(periodParam, selectedMemberId);
        setMemberStats(response.data);
        setDuoCache(cacheKey, response.data, DUO_STALE.detailedStats);
      }

      if (process.env.NODE_ENV !== 'production') {
        const selectedMemberId = scope.startsWith('user:') ? scope.slice(5) : null;
        console.debug('[DuoStats View]', {
          selectedScope: scope,
          viewerUserId,
          partnerUserId,
          selectedMemberId,
          statsLoading: false,
          statsData: scope === 'duo' ? duoViewStats : memberStats,
        });
      }
    } catch (error) {
      console.error('Failed to load stats view:', error);
      setStatsError(formatApiError(error));
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLike = async (sessionId) => {
    try {
      const { data } = await sessionsApi.toggleLike(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, likes: data.likes } : s))
      );
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleReaction = async (sessionId, reactionType) => {
    try {
      const { data } = await sessionsApi.addReaction(sessionId, {
        session_id: sessionId,
        reaction_type: reactionType,
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, reactions: data.reactions } : s))
      );
      toast.success(t('duo:toasts.reactionAdded'));
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleComment = async (sessionId) => {
    if (!commentText.trim()) return;

    try {
      const { data } = await sessionsApi.addComment(sessionId, {
        session_id: sessionId,
        text: commentText.trim(),
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, comments: data.comments } : s))
      );
      setCommentText('');
      setActiveCommentSession(null);
      toast.success(t('duo:toasts.commentAdded'));
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const isLikedByMe = (session) => session.likes?.includes(user?.id);

  const formatDuration = (seconds) => {
    if (!seconds) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  };

  if (!partnerReady) {
    return (
      <div data-testid="duo-page" className="p-5 animate-fade-in">
        <DuoHeaderSkeleton />
        <div className="grid gap-6 lg:grid-cols-12 mt-6">
          <div className="lg:col-span-7 space-y-4">
            <DuoChallengeSkeleton />
            <DuoActivitySkeleton />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <DuoStatsCardsSkeleton />
            <DuoBadgesSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <SoloDashboard
        duoStats={duoStats}
        duoNav={duoNav}
        initialSessions={sessions.filter((s) => s.user_id === user?.id)}
        statsLoading={statsBootLoading}
      />
    );
  }

  const viewerLabel = getDisplayName(viewerMember || user);
  const partnerLabel = getDisplayName(partnerMember || partner);
  const viewerScopeValue = `user:${viewerUserId || user?.id || ''}`;
  const partnerScopeValue = partnerUserId ? `user:${partnerUserId}` : null;

  const selectedStats =
    statsScope === 'duo'
      ? duoViewStats
      : (memberStats ? normalizeStatsView(memberStats) : null);

  const recentDuoBadges = (() => {
    const list = Array.isArray(duoStats?.duo_badges) ? duoStats.duo_badges : [];
    return [...list]
      .filter((b) => b?.unlocked && b?.id)
      .sort((a, b) => String(b?.unlocked_at || b?.unlockedAt || '').localeCompare(String(a?.unlocked_at || a?.unlockedAt || '')))
      .slice(0, 3);
  })();

  const hasWellbeingData = [
    selectedStats?.wellbeing?.fatigue_before,
    selectedStats?.wellbeing?.fatigue_after,
    selectedStats?.wellbeing?.mood_before,
    selectedStats?.wellbeing?.mood_after,
    selectedStats?._extras?.difficulty,
  ].some((value) => value !== null && value !== undefined);

  const handleAcceptDuoFollow = async () => {
    if (!pendingDuoFollow?.request_id) return;
    try {
      await duoProfilesApi.acceptFollowRequest(pendingDuoFollow.request_id);
      toast.success(t('duo:toasts.followAccepted'));
      loadDuoNotifications();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleRejectDuoFollow = async () => {
    if (!pendingDuoFollow?.request_id) return;
    try {
      await duoProfilesApi.rejectFollowRequest(pendingDuoFollow.request_id);
      toast.success(t('duo:toasts.followRejected'));
      loadDuoNotifications();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div data-testid="duo-page" className="p-5 animate-fade-in">
      <PageHeader
        title={t('duo:title')}
        subtitle={t('duo:subtitle')}
        actions={<NotificationBell filter="duo" includeAll data-testid="duo-notification-bell" />}
      />

      {/* Accès compact au profil Duo */}
      <div className="mb-6 space-y-4">
        {pendingDuoFollow && (
          <div
            data-testid="duo-notification-bar"
            className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 border border-[var(--theme-primary)]/20"
          >
            <p className="text-foreground text-sm flex-1">
              {t('duo:followRequestBanner')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-xl btn-primary text-foreground"
                onClick={handleAcceptDuoFollow}
              >
                {t('notifications:actions.accept')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-border text-foreground"
                onClick={handleRejectDuoFollow}
              >
                {t('notifications:actions.reject')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl text-muted"
                onClick={() => navigate('/notifications?filter=duo')}
              >
                {t('common:actions.seeAll')}
              </Button>
            </div>
          </div>
        )}

        {duoStats?.duo_profile?.tag ? (
          <Link
            to={duoProfilePath(duoStats.duo_profile.tag)}
            className="flex items-center gap-3 py-2 px-1 group"
            data-testid="duo-profile-link"
          >
            <DuoMembersAvatar
              members={[user, partner].filter(Boolean)}
              viewerId={user?.id}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-semibold truncate transition-colors group-hover:text-[var(--theme-primary)]">
                {t('duo:duoProfileLink')}
              </p>
              <p className="truncate text-xs text-subtle">
                {user?.relation_type === 'coach' ? t('duo:relation.coachStudent') : t('duo:relation.partners')}
                {' · '}
                <span className="font-mono">{duoStats.duo_profile.tag}</span>
              </p>
              <p className="text-xs text-muted">{t('duo:viewProfile')}</p>
            </div>
            <ChevronRight className="text-subtle group-hover:text-[var(--theme-primary)] shrink-0" size={20} />
          </Link>
        ) : null}
      </div>

      {liveSession && (
        <PartnerLiveStatus liveSession={liveSession} className="mb-4" />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-surface-elevated p-1 rounded-2xl border border-border">
          <TabsTrigger
            value="activity"
            data-testid="tab-activity"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-foreground"
          >
            {t('duo:activity')}
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            data-testid="tab-stats"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-foreground"
          >
            {t('duo:stats')}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            data-testid="tab-history"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-foreground"
          >
            {t('duo:history')}
          </TabsTrigger>
        </TabsList>

        {/* Activity Tab — séances & feed uniquement (pas de stats) */}
        <TabsContent value="activity" data-testid="duo-activity-tab">
          <div className="space-y-6 max-w-3xl">
            <div className="space-y-6">
              {/* Weekly challenge */}
              {statsBootLoading && !duoStats?.current_challenge ? (
                <DuoChallengeSkeleton />
              ) : duoStats?.current_challenge ? (
                <div className="card p-4 border-[var(--theme-primary)]/30">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="text-[var(--theme-primary)]" size={18} />
                    <span className="text-foreground font-medium">{t('duo:weeklyChallenge')}</span>
                  </div>
                  <p className="text-muted text-sm mb-3">{duoStats.current_challenge.title}</p>
                  <div className="h-2 bg-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--theme-primary)] transition-all"
                      style={{
                        width: `${Math.min(100, (duoStats.current_challenge.current / duoStats.current_challenge.target) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-subtle text-xs mt-2">
                    {duoStats.current_challenge.current}/{duoStats.current_challenge.target}
                  </p>
                </div>
              ) : null}

              {canModerateStreak && duoStats && partner && (
                <div className="card p-4 border border-dashed border-border">
                  <p className="text-subtle text-xs uppercase tracking-wider mb-3">{t('duo:coachSettings.title')}</p>
                  {duoStats.streak_manual_override != null && (
                    <p className="text-muted text-xs mb-3">
                      {t('duo:coachSettings.manual')} : <span className="text-foreground">{duoStats.streak_manual_override}</span>
                      {' · '}
                      {t('duo:coachSettings.autoCalc')} : <span className="text-foreground">{duoStats.streak_calculated ?? '—'}</span>
                    </p>
                  )}
                  <div className="flex gap-2 mb-3">
                    <Input
                      type="number"
                      min={0}
                      placeholder="ex. 7"
                      value={coachStreakInput}
                      onChange={(e) => setCoachStreakInput(e.target.value)}
                      className="flex-1 bg-background border-border text-foreground rounded-xl"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-border text-foreground shrink-0"
                      onClick={handleCoachSetStreak}
                    >
                      {t('duo:coachSettings.apply')}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:text-foreground mb-4 p-0 h-auto"
                    onClick={handleCoachClearStreak}
                  >
                    {t('duo:coachSettings.revertAuto')}
                  </Button>
                  <p className="text-subtle text-xs mb-2">{t('duo:coachSettings.exemptHint')}</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      type="date"
                      value={exemptDateStr}
                      onChange={(e) => setExemptDateStr(e.target.value)}
                      className="bg-background border-border text-foreground rounded-xl w-[160px]"
                    />
                    <Select value={exemptWho} onValueChange={setExemptWho}>
                      <SelectTrigger className="w-[140px] bg-background border-border text-foreground rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-elevated border-border">
                        <SelectItem value="partner" className="text-foreground">
                          {partner.display_name || partner.username}
                        </SelectItem>
                        <SelectItem value="me" className="text-foreground">
                          {t('duo:me')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-border text-foreground"
                      onClick={handleCoachExemptDay}
                    >
                      {t('duo:coachSettings.exempt')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Activity feed */}
              <div>
                <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">{t('duo:recentActivity')}</h2>
                {activityLoading && sessions.length === 0 ? (
                  <DuoActivitySkeleton />
                ) : sessions.length === 0 ? (
                  <div className="card p-6 text-center">
                    <p className="text-subtle">{t('duo:emptyStates.activity')}</p>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="duo-activity-feed">
                    {sessions.map((item) =>
                      item.type === 'common_session' ? (
                        <CommonSessionCard
                          key={`common-${item.date}`}
                          item={item}
                          user={user}
                          partner={partner}
                          theme={theme}
                          duoProfile={duoStats?.duo_profile}
                        />
                      ) : (
                        <SessionCard
                          key={item.id}
                          session={item}
                          user={user}
                          partner={partner}
                          theme={theme}
                          isLikedByMe={isLikedByMe(item)}
                          onLike={handleLike}
                          onReaction={handleReaction}
                          activeCommentSession={activeCommentSession}
                          setActiveCommentSession={setActiveCommentSession}
                          commentText={commentText}
                          setCommentText={setCommentText}
                          onComment={handleComment}
                          quickReactions={quickReactions}
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* History Tab — historique d'abord, agenda annuel replié */}
        <TabsContent value="history" className="space-y-4" data-testid="duo-history-tab">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
              {t('duo:history')}
            </h2>
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label={t('duo:historyScope.label')}
              data-testid="duo-history-scope"
            >
              {['mine', 'partner', 'all'].map((scope) => (
                <button
                  key={scope}
                  type="button"
                  role="tab"
                  aria-selected={historyScope === scope}
                  data-testid={`duo-history-scope-${scope}`}
                  onClick={() => setHistoryScope(scope)}
                  className={`min-h-10 rounded-full px-4 text-sm font-medium transition-colors ${
                    historyScope === scope
                      ? 'bg-[var(--theme-primary)] text-foreground'
                      : 'bg-hover text-muted hover:bg-active hover:text-foreground'
                  }`}
                >
                  {t(`duo:historyScope.${scope}`)}
                </button>
              ))}
            </div>
          </div>
          {(user?.relation_type === 'coach' || canModerateStreak) && (
            <div className="flex flex-wrap gap-2 items-center p-3 rounded-2xl bg-surface-elevated border border-border min-w-0">
              <Select value={historyTarget} onValueChange={setHistoryTarget}>
                <SelectTrigger className="h-9 w-[130px] rounded-full bg-background border-border text-foreground text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  <SelectItem value="me" className="text-foreground">{t('duo:me')}</SelectItem>
                  <SelectItem value="partner" className="text-foreground">
                    {partner?.display_name || partner?.username || t('duo:partner')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={exportPeriod} onValueChange={setExportPeriod}>
                <SelectTrigger className="h-9 w-[140px] rounded-full bg-background border-border text-foreground text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  <SelectItem value="7d" className="text-foreground">{t('duo:export.period7d')}</SelectItem>
                  <SelectItem value="30d" className="text-foreground">{t('duo:export.period30d')}</SelectItem>
                  <SelectItem value="month" className="text-foreground">{t('duo:export.currentMonth')}</SelectItem>
                  <SelectItem value="custom" className="text-foreground">{t('duo:export.custom')}</SelectItem>
                </SelectContent>
              </Select>
              {exportPeriod === 'custom' && (
                <>
                  <Input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="h-9 w-[140px] rounded-full bg-background border-border text-foreground text-sm"
                  />
                  <Input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="h-9 w-[140px] rounded-full bg-background border-border text-foreground text-sm"
                  />
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => handleExport('csv')}
                className="rounded-full border-border text-foreground"
              >
                {exporting ? <Loader2 className="animate-spin mr-1" size={14} /> : <Download size={14} className="mr-1" />}
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => handleExport('html')}
                className="rounded-full border-border text-foreground"
              >
                HTML / PDF
              </Button>
            </div>
          )}
          {historyLoading ? (
            <div className="flex justify-center py-12" data-testid="duo-history-list">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
            </div>
          ) : historyItems.length === 0 ? (
            <div className="card p-8 text-center" data-testid="duo-history-list">
              <History className="mx-auto text-subtle mb-3" size={28} />
              <p className="text-subtle">{t(`duo:emptyStates.${getDuoHistoryEmptyKey(historyScope)}`)}</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="duo-history-list">
              {historyItems.map((item) =>
                item.type === 'common_session' ? (
                  <CommonSessionCard
                    key={`history-common-${item.date}`}
                    item={item}
                    user={user}
                    partner={partner}
                    theme={theme}
                    duoProfile={duoStats?.duo_profile}
                  />
                ) : (
                  <SessionCard
                    key={`history-session-${item.id}`}
                    session={item}
                    user={user}
                    partner={partner}
                    theme={theme}
                    isLikedByMe={isLikedByMe(item)}
                    onLike={handleLike}
                    onReaction={handleReaction}
                    activeCommentSession={activeCommentSession}
                    setActiveCommentSession={setActiveCommentSession}
                    commentText={commentText}
                    setCommentText={setCommentText}
                    onComment={handleComment}
                    quickReactions={quickReactions}
                  />
                ),
              )}
            </div>
          )}
          <CollapsibleAnnualAgenda
            year={new Date().getFullYear()}
            userId={viewerUserId}
            title={t('duo:annualAgenda', { defaultValue: 'Agenda annuel' })}
            defaultOpen={false}
          />
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3" data-testid="stats-view-selector">
            <div className="min-w-[13rem] space-y-1.5">
              <label className="text-xs text-subtle">{t('duo:statsCards.statsScopeLabel')}</label>
              <Select value={statsScope} onValueChange={setStatsScope}>
                <SelectTrigger className="h-10 w-full rounded-full border-border bg-surface-elevated text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  <SelectItem value="duo" className="text-foreground">{t('duo:statsCards.duoScope')}</SelectItem>
                  <SelectItem value={viewerScopeValue} className="text-foreground">{viewerLabel}</SelectItem>
                  {partnerScopeValue ? (
                    <SelectItem value={partnerScopeValue} className="text-foreground">
                      {partnerLabel}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36 space-y-1.5">
              <label className="text-xs text-subtle">{t('duo:statsCards.period')}</label>
              <Select value={statsPeriod} onValueChange={setStatsPeriod}>
                <SelectTrigger className="h-10 w-full rounded-full border-border bg-surface-elevated text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  <SelectItem value="7d" className="text-foreground">{t('duo:statsCards.period7d')}</SelectItem>
                  <SelectItem value="30d" className="text-foreground">{t('duo:statsCards.period30d')}</SelectItem>
                  <SelectItem value="90d" className="text-foreground">{t('duo:statsCards.period90d')}</SelectItem>
                  <SelectItem value="year" className="text-foreground">{t('duo:statsCards.thisYear')}</SelectItem>
                  <SelectItem value="all" className="text-foreground">{t('duo:statsCards.allTime')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {statsLoading ? (
            <DuoStatsCardsSkeleton />
          ) : statsError ? (
            <div className="card p-8 text-center">
              <BarChart3 className="mx-auto mb-4 text-red-400" size={32} />
              <p className="text-red-300">{t('duo:statsCards.loadError')}</p>
              <p className="mt-1 text-xs text-subtle">{statsError}</p>
            </div>
          ) : !selectedStats ? (
            <div className="card p-8 text-center">
              <BarChart3 className="mx-auto text-subtle mb-4" size={32} />
              <p className="text-muted">{t('duo:emptyStates.statsPeriod')}</p>
            </div>
          ) : statsScope === 'duo' ? (
            duoStats || selectedStats ? (
              <div className="space-y-4" data-testid="duo-stats-scope-duo">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  <DuoCompactStatCard
                    icon={Users}
                    label={t('duo:profileStats.sessionsTogether')}
                    value={duoStats?.total_workouts_together ?? duoStats?.sessions_together ?? 0}
                    loading={statsBootLoading && !duoStats}
                    testId="stat-sessions-together"
                  />
                  <DuoCompactStatCard
                    icon={Clock}
                    label={t('duo:profileStats.totalTime')}
                    value={
                      duoStats
                        ? formatDuration(duoStats.total_training_time_together ?? duoStats.total_training_time ?? 0)
                        : null
                    }
                    loading={statsBootLoading && !duoStats}
                    testId="stat-time-together"
                  />
                  <DuoCompactStatCard
                    icon={Flame}
                    label={t('duo:statsCards.currentDuoStreak')}
                    value={duoStats?.duo_streak_current ?? duoStats?.streak ?? 0}
                    loading={statsBootLoading && !duoStats}
                    testId="stat-duo-streak-current"
                  />
                  <DuoCompactStatCard
                    icon={Flame}
                    label={t('duo:statsCards.bestDuoStreak')}
                    value={duoStats?.duo_streak_best ?? 0}
                    loading={statsBootLoading && !duoStats}
                    testId="stat-duo-streak-best"
                  />
                  <DuoCompactStatCard
                    icon={Calendar}
                    label={t('duo:statsCards.activeDays')}
                    value={duoStats?.training_days_together ?? 0}
                    loading={statsBootLoading && !duoStats}
                    testId="stat-duo-active-days"
                  />
                  <DuoCompactStatCard
                    icon={History}
                    label={t('duo:statsCards.lastSharedWorkout')}
                    value={
                      duoStats?.last_common_session?.date
                        ? formatDayMonth(parseISO(duoStats.last_common_session.date))
                        : '—'
                    }
                    loading={statsBootLoading && !duoStats}
                    testId="stat-last-shared"
                  />
                  <DuoCompactStatCard
                    icon={Target}
                    label={t('duo:profileStats.challengesCompleted')}
                    value={duoStats?.challenges_completed ?? 0}
                    loading={statsBootLoading && !duoStats}
                    testId="stat-challenges"
                  />
                  <DuoCompactStatCard
                    icon={Activity}
                    label={t('duo:statsCards.completionRate')}
                    value={
                      selectedStats?._extras?.completion_rate != null
                        ? `${selectedStats._extras.completion_rate}%`
                        : selectedStats
                          ? '0%'
                          : null
                    }
                    loading={statsLoading && !selectedStats}
                    testId="stat-duo-completion"
                  />
                  {(selectedStats?.summary?.calories != null || duoStats?.estimated_calories != null) ? (
                    <DuoCompactStatCard
                      icon={FlameIcon}
                      label={t('duo:statsCards.combinedCalories')}
                      value={formatCalories(
                        selectedStats?.summary?.calories ?? duoStats?.estimated_calories ?? 0
                      )}
                      valueClassName="text-orange-300"
                      testId="stat-duo-calories"
                    />
                  ) : null}
                  <DuoCompactStatCard
                    icon={Trophy}
                    label={t('duo:statsCards.duoBadges')}
                    value={`${duoStats?.duo_badges_unlocked ?? 0}/${duoStats?.duo_badges_total ?? 50}`}
                    loading={statsBootLoading && !duoStats}
                    testId="stat-duo-badges"
                  />
                </div>

                {duoStats?.current_challenge ? (
                  <div className="card p-4 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="text-[var(--theme-primary)] shrink-0" size={16} />
                      <span className="text-foreground font-medium text-sm">{t('duo:duoChallenge')}</span>
                    </div>
                    <p className="text-muted text-sm mb-2">{duoStats.current_challenge.title}</p>
                    <p className="text-subtle text-xs">
                      {duoStats.current_challenge.current}/{duoStats.current_challenge.target}
                    </p>
                  </div>
                ) : null}

                <div className="card p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{t('duo:duoBadgesTitle')}</p>
                      <p className="text-subtle text-xs">
                        {t('duo:badgesUnlockedCount', {
                          unlocked: duoStats?.duo_badges_unlocked ?? 0,
                          total: duoStats?.duo_badges_total ?? 50,
                        })}
                      </p>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-full border-border text-foreground shrink-0"
                      data-testid="duo-stats-open-badges"
                    >
                      <Link to="/badges?scope=duo">{t('duo:showBadges')}</Link>
                    </Button>
                  </div>
                  {recentDuoBadges.length > 0 ? (
                    <div className="mt-3 flex items-center gap-3">
                      {recentDuoBadges.map((badge) => {
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
              </div>
            ) : (
              <div className="card p-8 text-center">
                <BarChart3 className="mx-auto text-subtle mb-4" size={32} />
                <p className="text-muted">{t('duo:emptyStates.duoStats')}</p>
              </div>
            )
          ) : (
            <>
              {/* Summary Cards — Moi / Partenaire */}
              <div
                className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
                data-testid="duo-stats-scope-member"
              >
                <DuoCompactStatCard
                  icon={Target}
                  label={t('duo:solo.completedWorkouts')}
                  value={selectedStats._extras?.total_completed ?? 0}
                  loading={statsLoading}
                  testId="stat-member-completed"
                />
                <DuoCompactStatCard
                  icon={Clock}
                  label={t('duo:statsCards.totalTime')}
                  value={formatDuration((selectedStats.summary?.duration_minutes || 0) * 60)}
                  loading={statsLoading}
                  testId="stat-member-time"
                />
                <DuoCompactStatCard
                  icon={Flame}
                  label={
                    statsScope === viewerScopeValue
                      ? t('duo:statsCards.personalCurrentStreak')
                      : t('duo:statsCards.partnerCurrentStreak')
                  }
                  value={selectedStats.current_streak ?? selectedStats._extras?.current_streak ?? 0}
                  loading={statsLoading}
                  testId="stat-member-streak-current"
                />
                <DuoCompactStatCard
                  icon={Flame}
                  label={
                    statsScope === viewerScopeValue
                      ? t('duo:statsCards.personalBestStreak')
                      : t('duo:statsCards.partnerBestStreak')
                  }
                  value={selectedStats.best_streak ?? selectedStats._extras?.best_streak ?? 0}
                  loading={statsLoading}
                  testId="stat-member-streak-best"
                />
                <DuoCompactStatCard
                  icon={Calendar}
                  label={t('duo:statsCards.activeDays')}
                  value={selectedStats.summary?.active_days ?? selectedStats._extras?.active_days ?? 0}
                  loading={statsLoading}
                  testId="stat-member-active-days"
                />
                <DuoCompactStatCard
                  icon={History}
                  label={t('duo:statsCards.lastSession')}
                  value={
                    (selectedStats.last_session || selectedStats._extras?.last_session)?.created_at
                      ? formatDayMonth(
                          parseISO(
                            (selectedStats.last_session || selectedStats._extras.last_session).created_at
                          )
                        )
                      : '—'
                  }
                  loading={statsLoading}
                  testId="stat-member-last-session"
                />
                <DuoCompactStatCard
                  icon={Activity}
                  label={t('duo:statsCards.completionRate')}
                  value={
                    selectedStats._extras?.completion_rate != null
                      ? `${selectedStats._extras.completion_rate}%`
                      : '—'
                  }
                  loading={statsLoading}
                  testId="stat-member-completion"
                />
                <DuoCompactStatCard
                  icon={Calendar}
                  label={t('duo:statsCards.thisWeek')}
                  value={selectedStats._extras?.this_week ?? 0}
                  loading={statsLoading}
                  testId="stat-member-week"
                />
              </div>

              {selectedStats.summary?.calories != null && (
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FlameIcon className="text-orange-400" size={16} />
                    <span className="text-foreground font-medium text-sm">{t('duo:statsCards.estimatedCalories')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-xl bg-hover">
                      <p className="text-lg font-bold text-orange-300">
                        {formatCalories(selectedStats._extras.calories_week ?? 0)}
                      </p>
                      <p className="text-subtle text-[10px]">{t('duo:statsCards.week')}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-hover">
                      <p className="text-lg font-bold text-orange-300">
                        {formatCalories(selectedStats._extras.calories_month ?? 0)}
                      </p>
                      <p className="text-subtle text-[10px]">{t('duo:statsCards.month')}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-hover">
                      <p className="text-lg font-bold text-orange-300">
                        {formatCalories(selectedStats.summary.calories ?? 0)}
                      </p>
                      <p className="text-subtle text-[10px]">{t('duo:statsCards.total')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Averages */}
              {hasWellbeingData ? (
                <div className="card p-4">
                  <h3 className="text-foreground font-medium mb-4">{t('duo:statsCards.wellbeing')}</h3>
                  <div className="space-y-4">
                    {selectedStats.wellbeing.fatigue_before != null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted">{t('duo:statsCards.fatigueBefore')}</span>
                          <span className="text-foreground">{selectedStats.wellbeing.fatigue_before}/10</span>
                        </div>
                        <div className="h-2 bg-hover rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 transition-all"
                            style={{ width: `${selectedStats.wellbeing.fatigue_before * 10}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {selectedStats.wellbeing.fatigue_after != null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted">{t('duo:statsCards.fatigueAfter')}</span>
                          <span className="text-foreground">{selectedStats.wellbeing.fatigue_after}/10</span>
                        </div>
                        <div className="h-2 bg-hover rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${selectedStats.wellbeing.fatigue_after * 10}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {selectedStats._extras?.difficulty != null ? (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted">{t('duo:statsCards.feltDifficulty')}</span>
                          <span className="text-foreground">{selectedStats._extras.difficulty}/10</span>
                        </div>
                        <div className="h-2 bg-hover rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--theme-primary)] transition-all"
                            style={{ width: `${selectedStats._extras.difficulty * 10}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {selectedStats.wellbeing.fatigue_before == null
                      && selectedStats.wellbeing.fatigue_after == null
                      && selectedStats._extras?.difficulty == null
                      && selectedStats.wellbeing.mood_before == null
                      && selectedStats.wellbeing.mood_after == null ? (
                        <p className="text-subtle text-sm">{t('duo:statsCards.notProvided')}</p>
                      ) : null}
                  </div>
                </div>
              ) : null}

              {/* Weekly Chart */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="text-[var(--theme-primary)]" size={18} />
                  <h3 className="text-foreground font-medium">7 derniers jours</h3>
                </div>
                <div className="flex items-end gap-2 h-24">
                  {(selectedStats._extras.daily || []).map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${Math.max(
                            8,
                            (day.count / Math.max(1, ...(selectedStats._extras.daily || []).map((d) => d.count))) * 80
                          )}px`,
                          background: day.completed > 0 
                            ? 'linear-gradient(180deg, var(--theme-primary), var(--theme-secondary))' 
                            : 'var(--hover)',
                        }}
                      />
                      <span className="text-[10px] text-subtle">{day.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Sessions */}
              {(selectedStats.recent_sessions || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                    Dernières séances
                  </h3>
                  <div className="space-y-2">
                    {selectedStats.recent_sessions.map((session) => (
                      <div
                        key={session.id}
                        className="card p-3 flex items-center gap-3"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          session.status === 'completed'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {session.status === 'completed' ? (
                            <Trophy size={18} />
                          ) : (
                            <Clock size={18} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-medium text-sm truncate">{session.workout_title}</p>
                          <p className="text-subtle text-xs">
                            {session.created_at && formatDayMonth(parseISO(session.created_at))}
                            {' • '}
                            {formatDuration(session.total_time)}
                            {session.difficulty_felt && ` • Diff: ${session.difficulty_felt}/10`}
                            {session.estimated_calories != null && ` • ${formatCalories(session.estimated_calories)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-foreground text-sm">
                            {session.exercises_completed}/{session.exercises_total}
                          </p>
                          <p className="text-subtle text-xs">{t('duo:statsCards.exercisesLabel')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function resolveSessionMember(session, user, partner) {
  if (!session) return null;
  if (session.user_id && user?.id && String(session.user_id) === String(user.id)) return user;
  if (session.user_id && partner?.id && String(session.user_id) === String(partner.id)) return partner;
  return null;
}

function SessionCard({
  session,
  user,
  partner,
  theme,
  isLikedByMe,
  onLike,
  onReaction,
  activeCommentSession,
  setActiveCommentSession,
  commentText,
  setCommentText,
  onComment,
  quickReactions = [],
}) {
  const { t } = useTranslation(['duo', 'workouts']);
  const { formatDayMonthTime } = useLocaleFormat();
  const member = resolveSessionMember(session, user, partner);
  const isOwn = member && user?.id && String(member.id) === String(user.id);
  const displayName = getDisplayName(member) || session.display_name || session.username || 'Membre';
  const roleLabel = getDuoRoleLabel(member?.duo_role);
  const statusLabel =
    session.status === 'completed'
      ? t('duo:session.status.completed')
      : session.status === 'abandoned'
        ? t('duo:session.status.abandoned')
        : session.status === 'in_progress'
          ? t('duo:session.status.inProgress')
          : session.status || '';
  const formatDuration = (seconds) => {
    const mins = Math.floor((seconds || 0) / 60);
    return `${mins} min`;
  };
  const dateLabel = session.created_at
    ? formatDayMonthTime(parseISO(session.created_at))
    : '';
  const calories = session.estimated_calories;
  const exercisesDone = session.exercises_completed;
  const exercisesTotal = session.exercises_total;
  const isCommon = Boolean(session.is_common_session || session.type === 'common_session');

  return (
    <div
      data-testid={`session-card-${session.id}`}
      className="card min-w-0 space-y-3 overflow-visible p-4"
    >
      <div className="flex items-start gap-3 min-w-0">
        <UserAvatar user={member || { display_name: displayName }} className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-foreground font-medium truncate">{displayName}</span>
            {roleLabel && roleLabel !== 'Membre' ? (
              <span className="text-[10px] text-subtle shrink-0">— {roleLabel}</span>
            ) : null}
            {session.status === 'completed' && (
              <Trophy size={14} className="text-green-500 shrink-0" />
            )}
          </div>
          <p className="text-foreground text-sm font-medium truncate mt-0.5">
            {session.workout_title || session.title || t('duo:session.defaultTitle')}
          </p>
          <p className="text-subtle text-xs mt-0.5 line-clamp-2 break-words">
            {[dateLabel, statusLabel, isCommon ? t('duo:session.common') : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1 text-muted">
          <Clock size={14} />
          <span>{formatDuration(session.total_time)}</span>
        </div>
        {(exercisesDone != null || exercisesTotal != null) && (
          <div className="flex items-center gap-1 text-muted">
            <Zap size={14} />
            <span>
              {exercisesDone ?? 0}
              {exercisesTotal != null ? `/${exercisesTotal}` : ''} exo{(exercisesTotal || exercisesDone) > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {calories != null && calories > 0 ? (
          <div className="flex items-center gap-1 text-orange-400/80">
            <Flame size={14} />
            <span>{formatCalories(calories)}</span>
          </div>
        ) : null}
      </div>

      {session.notes && (
        <p className="text-muted text-sm italic line-clamp-2">"{session.notes}"</p>
      )}

      {session.reactions?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {session.reactions.slice(-5).map((r, i) => (
            <span key={i} className="text-lg">
              {quickReactions.find((qr) => qr.type === r.reaction_type)?.emoji || '👍'}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <button
          onClick={() => onLike(session.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            isLikedByMe
              ? 'bg-red-500/20 text-red-500'
              : 'bg-hover text-muted hover:bg-active'
          }`}
        >
          <Heart size={16} fill={isLikedByMe ? 'currentColor' : 'none'} />
          <span className="text-sm">{session.likes?.length || 0}</span>
        </button>

        {quickReactions.slice(0, 3).map((reaction) => (
          <button
            key={reaction.type}
            onClick={() => onReaction(session.id, reaction.type)}
            className="w-8 h-8 rounded-full bg-hover hover:bg-active flex items-center justify-center transition-colors"
            title={reaction.label}
          >
            <span>{reaction.emoji}</span>
          </button>
        ))}

        <button
          onClick={() =>
            setActiveCommentSession(activeCommentSession === session.id ? null : session.id)
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            activeCommentSession === session.id
              ? 'bg-[var(--theme-surface-active)] text-[var(--theme-primary)]'
              : 'bg-hover text-muted hover:bg-active'
          }`}
        >
          <MessageCircle size={16} />
          <span className="text-sm">{session.comments?.length || 0}</span>
        </button>
      </div>

      {(activeCommentSession === session.id || session.comments?.length > 0) && (
        <div className="space-y-3 pt-2">
          {session.comments?.map((comment) => {
            const commentMember = resolveSessionMember(
              { user_id: comment.user_id },
              user,
              partner
            );
            const commentName = getDisplayName(commentMember) || comment.username || 'Membre';
            return (
              <div key={comment.id} className="flex gap-2 min-w-0">
                <UserAvatar
                  user={commentMember || { display_name: commentName }}
                  className="w-6 h-6 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-muted text-sm break-words">
                    <span className="text-foreground font-medium">{commentName}</span>{' '}
                    <span className="whitespace-pre-wrap break-words">{comment.text}</span>
                  </p>
                </div>
              </div>
            );
          })}

          {activeCommentSession === session.id && (
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="flex-1 h-10 rounded-xl bg-background border-border text-foreground text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onComment(session.id);
                }}
              />
              <Button
                size="sm"
                onClick={() => onComment(session.id)}
                disabled={!commentText.trim()}
                className="bg-[var(--theme-primary)] text-foreground rounded-xl"
              >
                <Send size={16} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
