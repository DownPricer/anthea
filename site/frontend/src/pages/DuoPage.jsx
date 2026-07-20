import { useState, useEffect, useCallback, useRef } from 'react';
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
import { DuoBadgesGrid } from '../components/duo/DuoBadgeCard';
import { ShareDuoBadgeDialog } from '../components/duo/ShareDuoBadgeDialog';
import { SessionHistoryCard } from '../components/history/SessionHistoryCard';
import { CommonSessionCard } from '../components/duo/CommonSessionCard';
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
} from '../lib/duoCache';
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
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageHeader } from '../components/layout/PageHeader';

const QUICK_REACTIONS = [
  { type: 'bravo', emoji: '👏', label: 'Bravo' },
  { type: 'proud', emoji: '🥹', label: 'Fier de toi' },
  { type: 'fire', emoji: '🔥', label: 'En feu' },
  { type: 'heart', emoji: '❤️', label: 'Coeur' },
  { type: 'strong', emoji: '💪', label: "T'as géré" },
];

const DUO_TABS = ['activity', 'stats', 'history', 'badges'];

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

export function DuoPage() {
  const { user, refreshUser } = useAuth();
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
  const [detailedStats, setDetailedStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('30');
  const [statsTarget, setStatsTarget] = useState('duo'); // 'duo' | 'me' | 'partner'
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [canModerateStreak, setCanModerateStreak] = useState(false);
  const [coachStreakInput, setCoachStreakInput] = useState('');
  const [exemptDateStr, setExemptDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [exemptWho, setExemptWho] = useState('partner'); // 'me' | 'partner'
  const [historySessions, setHistorySessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Historique doit s'ouvrir sur "Moi" par défaut (indépendant des Stats)
  const [historyTarget, setHistoryTarget] = useState('me'); // 'me' | 'partner'
  const [historyFilter, setHistoryFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [exportPeriod, setExportPeriod] = useState('30d');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [selectedDuoBadge, setSelectedDuoBadge] = useState(null);

  const { liveSession } = usePartnerLiveSession(!!partner);

  const duoMembers = Array.isArray(duoProfile?.members) ? duoProfile.members : [];
  const viewerMember = duoMembers.find((member) => String(member?.id) === String(user?.id));
  const partnerMember = duoMembers.find((member) => String(member?.id) !== String(user?.id));
  const viewerUserId = viewerMember?.id || user?.id;
  const partnerUserId = partnerMember?.id || user?.partner_id || partner?.id;
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
      loadDetailedStats();
    }
    if (activeTab === 'history' && partnerUserId) {
      loadHistory();
    }
    // Intentionally omit loader fns — they close over current filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statsPeriod, statsTarget, partnerUserId, historyFilter, historyTarget]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem('duo-active-tab', tab);
    } catch {
      /* stockage indisponible */
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = {
        limit: 100,
        target_user: historyTarget === 'me' ? viewerUserId : partnerUserId,
      };
      if (historyFilter !== 'all') params.status = historyFilter;
      const { data } = await sessionsApi.getHistory(params);
      const enriched = (data || []).map((s) => {
        const member = String(s.user_id) === String(viewerUserId)
          ? (viewerMember || user)
          : (partnerMember || partner);
        return {
          ...s,
          display_name: getDisplayName(member) || s.username,
          username: getDisplayName(member) || s.username,
        };
      });
      setHistorySessions(enriched);
    } catch {
      toast.error('Impossible de charger l\'historique');
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
          toast.error('Choisis une date de début et de fin');
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
      toast.success('Export téléchargé');
    } catch {
      toast.error('Export non autorisé ou indisponible');
    } finally {
      setExporting(false);
    }
  };

  const handleAdjustSessionTime = async (session) => {
    const mins = window.prompt(
      'Corriger le temps (minutes réelles) — réservé coach/admin',
      String(Math.round((session.total_time || 0) / 60))
    );
    if (mins == null) return;
    const sec = parseInt(mins, 10) * 60;
    if (Number.isNaN(sec) || sec < 0) {
      toast.error('Valeur invalide');
      return;
    }
    if (!window.confirm('Confirmer la correction du temps ?')) return;
    try {
      await sessionsApi.adjustTime(session.id, { total_time: sec, reason: 'coach_manual' });
      toast.success('Temps corrigé');
      loadHistory();
    } catch {
      toast.error('Correction refusée');
    }
  };

  const loadData = async () => {
    const gen = ++loadGenRef.current;
    const endTotal = duoTime('total');
    const endPartner = duoTime('partner');
    const endStats = duoTime('stats');
    const endActivity = duoTime('activity');
    const endCoach = duoTime('coach');

    const partnerCacheKey = duoCacheKey('partner', user?.id || 'anon');
    const cachedPartner = getDuoCache(partnerCacheKey);
    if (cachedPartner !== null && cachedPartner !== undefined) {
      setPartner(cachedPartner || null);
      setPartnerReady(true);
    }

    // 1) Partner en priorité — débloque le shell (header / Solo)
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

    // 2) Profil Duo — source canonique des deux membres et du pair_key.
    const profilePromise = (async () => {
      try {
        const { data } = await duoApi.getProfile();
        if (gen === loadGenRef.current) setDuoProfile(data || null);
        return data;
      } catch (error) {
        console.error('Failed to load duo profile', error);
        if (gen === loadGenRef.current) setDuoProfile(null);
        return null;
      }
    })();

    // 3) Stats (+ badges + challenge inclus) — parallèle
    const statsPromise = (async () => {
      const pkHint = pairKey;
      const statsKey = duoCacheKey('stats', pkHint);
      const cached = getDuoCache(statsKey);
      if (cached) {
        setDuoStats(cached);
        setStatsBootLoading(false);
        endStats();
        return cached;
      }
      try {
        const { data } = await duoApi.getStats();
        if (gen !== loadGenRef.current) return data;
        setDuoStats(data);
        const pk = data?.duo_profile?.pair_key || pkHint;
        setDuoCache(duoCacheKey('stats', pk), data, DUO_STALE.stats);
        if (data?.badges) {
          setDuoCache(duoCacheKey('badges', pk), data.badges, DUO_STALE.badges);
        }
        if (data?.current_challenge) {
          const weekKey = data.current_challenge.week_key || 'current';
          setDuoCache(duoCacheKey('challenges', pk, weekKey), data.current_challenge, DUO_STALE.challenges);
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

    // 4) Activity feed — parallèle, ne bloque pas le header
    const activityPromise = (async () => {
      const actKey = duoCacheKey('activity', pairKey);
      const cached = getDuoCache(actKey);
      if (cached) {
        setSessions(cached);
        setActivityLoading(false);
        endActivity();
        return cached;
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

    // 5) Coach status — parallèle, non bloquant
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

    await Promise.all([
      partnerPromise,
      profilePromise,
      statsPromise,
      activityPromise,
      coachPromise,
    ]);
    endTotal();
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
      toast.success('Streak mise à jour');
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
      toast.success('Valeur manuelle supprimée');
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
      toast.success('Jour exempt enregistré');
      const { data } = await duoApi.getStats();
      setDuoStats(data);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const loadDetailedStats = async () => {
    if (!viewerUserId || !partnerUserId) return;
    const cacheKey = duoCacheKey('detailedStats', pairKey, statsPeriod, statsTarget);
    const cached = getDuoCache(cacheKey);
    if (cached) {
      setDetailedStats(cached);
      setStatsError(null);
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    setStatsError(null);
    setDetailedStats(null);
    try {
      let data;
      if (statsTarget === 'duo') {
        const [viewerResponse, partnerResponse] = await Promise.all([
          duoApi.getDetailedStats(statsPeriod, viewerUserId),
          duoApi.getDetailedStats(statsPeriod, partnerUserId),
        ]);
        const viewerStats = viewerResponse.data;
        const partnerStats = partnerResponse.data;
        data = {
          viewer: viewerStats,
          partner: partnerStats,
          period: statsPeriod,
          summary: {
            total_sessions:
              (viewerStats?.summary?.total_sessions || 0)
              + (partnerStats?.summary?.total_sessions || 0),
            total_completed:
              (viewerStats?.summary?.total_completed || 0)
              + (partnerStats?.summary?.total_completed || 0),
            total_time:
              (viewerStats?.summary?.total_time || 0)
              + (partnerStats?.summary?.total_time || 0),
            total_calories:
              (viewerStats?.summary?.total_calories || 0)
              + (partnerStats?.summary?.total_calories || 0),
          },
        };
      } else {
        const targetUserId = statsTarget === 'partner' ? partnerUserId : viewerUserId;
        const response = await duoApi.getDetailedStats(statsPeriod, targetUserId);
        data = response.data;
      }
      setDetailedStats(data);
      setDuoCache(cacheKey, data, DUO_STALE.detailedStats);
    } catch (error) {
      console.error('Failed to load detailed stats:', error);
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
      toast.success('Réaction ajoutée !');
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
      toast.success('Commentaire ajouté !');
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

  const handleAcceptDuoFollow = async () => {
    if (!pendingDuoFollow?.request_id) return;
    try {
      await duoProfilesApi.acceptFollowRequest(pendingDuoFollow.request_id);
      toast.success('Demande acceptée');
      loadDuoNotifications();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleRejectDuoFollow = async () => {
    if (!pendingDuoFollow?.request_id) return;
    try {
      await duoProfilesApi.rejectFollowRequest(pendingDuoFollow.request_id);
      toast.success('Demande refusée');
      loadDuoNotifications();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div data-testid="duo-page" className="p-5 animate-fade-in">
      <PageHeader
        title="Duo"
        subtitle="Votre progression à deux"
        actions={<NotificationBell filter="duo" includeAll data-testid="duo-notification-bell" />}
      />

      {/* Accès compact au profil Duo */}
      <div className="mb-6 space-y-4">
        {pendingDuoFollow && (
          <div
            data-testid="duo-notification-bar"
            className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 border border-[var(--theme-primary)]/20"
          >
            <p className="text-white text-sm flex-1">
              Vous avez 1 demande pour suivre votre profil duo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-xl btn-primary text-white"
                onClick={handleAcceptDuoFollow}
              >
                Accepter
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-white/15 text-white"
                onClick={handleRejectDuoFollow}
              >
                Refuser
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl text-zinc-400"
                onClick={() => navigate('/notifications?filter=duo')}
              >
                Voir
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
              <p className="text-white font-semibold truncate transition-colors group-hover:text-[var(--theme-primary)]">
                Profil du Duo
              </p>
              <p className="truncate text-xs text-zinc-500">
                {user?.relation_type === 'coach' ? 'Coach & Élève' : 'Partenaires'}
                {' · '}
                <span className="font-mono">{duoStats.duo_profile.tag}</span>
              </p>
              <p className="text-xs text-zinc-400">Voir le profil</p>
            </div>
            <ChevronRight className="text-zinc-500 group-hover:text-[var(--theme-primary)] shrink-0" size={20} />
          </Link>
        ) : null}
      </div>

      {liveSession && (
        <PartnerLiveStatus liveSession={liveSession} className="mb-4" />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-[#141414] p-1 rounded-2xl border border-white/10">
          <TabsTrigger
            value="activity"
            data-testid="tab-activity"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Activité
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            data-testid="tab-stats"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Stats
          </TabsTrigger>
          <TabsTrigger
            value="history"
            data-testid="tab-history"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Historique
          </TabsTrigger>
          <TabsTrigger
            value="badges"
            data-testid="tab-badges"
            className="rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Badges
          </TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              {/* Weekly challenge */}
              {statsBootLoading && !duoStats?.current_challenge ? (
                <DuoChallengeSkeleton />
              ) : duoStats?.current_challenge ? (
                <div className="card p-4 border-[var(--theme-primary)]/30">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="text-[var(--theme-primary)]" size={18} />
                    <span className="text-white font-medium">Défi de la semaine</span>
                  </div>
                  <p className="text-zinc-400 text-sm mb-3">{duoStats.current_challenge.title}</p>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--theme-primary)] transition-all"
                      style={{
                        width: `${Math.min(100, (duoStats.current_challenge.current / duoStats.current_challenge.target) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-zinc-500 text-xs mt-2">
                    {duoStats.current_challenge.current}/{duoStats.current_challenge.target}
                  </p>
                </div>
              ) : null}

              {canModerateStreak && duoStats && partner && (
                <div className="card p-4 border border-dashed border-white/15">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-3">Streak — réglages coach</p>
                  {duoStats.streak_manual_override != null && (
                    <p className="text-zinc-400 text-xs mb-3">
                      Manuel : <span className="text-white">{duoStats.streak_manual_override}</span>
                      {' · '}
                      Calcul auto : <span className="text-white">{duoStats.streak_calculated ?? '—'}</span>
                    </p>
                  )}
                  <div className="flex gap-2 mb-3">
                    <Input
                      type="number"
                      min={0}
                      placeholder="ex. 7"
                      value={coachStreakInput}
                      onChange={(e) => setCoachStreakInput(e.target.value)}
                      className="flex-1 bg-[#0A0A0A] border-white/10 text-white rounded-xl"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/15 text-white shrink-0"
                      onClick={handleCoachSetStreak}
                    >
                      Appliquer
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 hover:text-white mb-4 p-0 h-auto"
                    onClick={handleCoachClearStreak}
                  >
                    Revenir au calcul auto
                  </Button>
                  <p className="text-zinc-500 text-xs mb-2">Exemption jour (comme repos pour la streak)</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      type="date"
                      value={exemptDateStr}
                      onChange={(e) => setExemptDateStr(e.target.value)}
                      className="bg-[#0A0A0A] border-white/10 text-white rounded-xl w-[160px]"
                    />
                    <Select value={exemptWho} onValueChange={setExemptWho}>
                      <SelectTrigger className="w-[140px] bg-[#0A0A0A] border-white/10 text-white rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141414] border-white/10">
                        <SelectItem value="partner" className="text-white">
                          {partner.display_name || partner.username}
                        </SelectItem>
                        <SelectItem value="me" className="text-white">
                          Moi
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/15 text-white"
                      onClick={handleCoachExemptDay}
                    >
                      Exempter
                    </Button>
                  </div>
                </div>
              )}

              {/* Activity feed */}
              <div>
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Activité récente</h2>
                {activityLoading && sessions.length === 0 ? (
                  <DuoActivitySkeleton />
                ) : sessions.length === 0 ? (
                  <div className="card p-6 text-center">
                    <p className="text-zinc-500">Pas encore d'activité</p>
                  </div>
                ) : (
                  <div className="space-y-4">
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
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 lg:col-span-5">
              {/* Duo Stats Card */}
              {statsBootLoading && !duoStats ? (
                <DuoStatsCardsSkeleton />
              ) : duoStats ? (
                <div className="card p-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {theme === 'girly' ? (
                          <Heart className="text-pink-500" size={16} fill="currentColor" />
                        ) : (
                          <Flame className="text-orange-500" size={16} />
                        )}
                        <span className="text-xl font-bold text-white">{duoStats.streak}</span>
                      </div>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Streak</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-white">{duoStats.total_workouts_together}</p>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Ensemble</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-white">{duoStats.this_week_user}</p>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Toi</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-white">{duoStats.this_week_partner}</p>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
                        {partner.display_name?.split(' ')[0] || partner.username}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

            </div>
          </div>
        </TabsContent>

        <TabsContent value="badges" className="space-y-4">
          {statsBootLoading && !(duoStats?.duo_badges || duoStats?.badges) ? (
            <DuoBadgesSkeleton />
          ) : (duoStats?.duo_badges || duoStats?.badges)?.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-medium">Badges Duo</h2>
                  <p className="text-zinc-500 text-xs">
                    {duoStats.duo_badges_unlocked
                      ?? (duoStats.duo_badges || []).filter((badge) => badge.unlocked).length}
                    {' / '}
                    {duoStats.duo_badges_total ?? (duoStats.duo_badges || []).length}
                    {' débloqués'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/badges?scope=duo')}
                  className="rounded-full border-white/15 text-white"
                  data-testid="duo-see-all-badges"
                >
                  Catalogue
                </Button>
              </div>
              <DuoBadgesGrid
                badges={(duoStats.duo_badges || duoStats.badges).filter(
                  (badge) =>
                    badge.scope === 'duo'
                    || badge.id?.startsWith('duo_')
                    || badge.family === 'duo'
                )}
                onBadgeClick={(badge) => setSelectedDuoBadge(badge)}
              />
            </>
          ) : (
            <div className="card p-6 text-center text-sm text-zinc-500">
              Aucun badge Duo disponible.
            </div>
          )}
          <ShareDuoBadgeDialog
            badge={selectedDuoBadge}
            open={Boolean(selectedDuoBadge)}
            onOpenChange={(open) => { if (!open) setSelectedDuoBadge(null); }}
            onShared={() => setSelectedDuoBadge(null)}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={historyTarget} onValueChange={setHistoryTarget}>
              <SelectTrigger className="w-[130px] h-9 rounded-full bg-[#141414] border-white/10 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                <SelectItem value="me" className="text-white">Moi</SelectItem>
                <SelectItem value="partner" className="text-white">
                  {partner?.display_name || partner?.username || 'Partenaire'}
                </SelectItem>
              </SelectContent>
            </Select>
            {['all', 'completed', 'abandoned'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setHistoryFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  historyFilter === f
                    ? 'bg-[var(--theme-primary)] text-white'
                    : 'bg-white/5 text-zinc-400'
                }`}
              >
                {f === 'all' ? 'Toutes' : f === 'completed' ? 'Terminées' : 'Abandonnées'}
              </button>
            ))}
          </div>
          {(user?.relation_type === 'coach' || canModerateStreak) && (
            <div className="flex flex-wrap gap-2 items-center p-3 rounded-2xl bg-[#141414] border border-white/10">
              <Select value={exportPeriod} onValueChange={setExportPeriod}>
                <SelectTrigger className="h-9 w-[140px] rounded-full bg-[#0A0A0A] border-white/10 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  <SelectItem value="7d" className="text-white">7 jours</SelectItem>
                  <SelectItem value="30d" className="text-white">30 jours</SelectItem>
                  <SelectItem value="month" className="text-white">Mois courant</SelectItem>
                  <SelectItem value="custom" className="text-white">Personnalisée</SelectItem>
                </SelectContent>
              </Select>
              {exportPeriod === 'custom' && (
                <>
                  <Input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="h-9 w-[140px] rounded-full bg-[#0A0A0A] border-white/10 text-white text-sm"
                  />
                  <Input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="h-9 w-[140px] rounded-full bg-[#0A0A0A] border-white/10 text-white text-sm"
                  />
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => handleExport('csv')}
                className="rounded-full border-white/15 text-white"
              >
                {exporting ? <Loader2 className="animate-spin mr-1" size={14} /> : <Download size={14} className="mr-1" />}
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => handleExport('html')}
                className="rounded-full border-white/15 text-white"
              >
                HTML / PDF
              </Button>
            </div>
          )}
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
              {historySessions
                .filter((s) => {
                  if (historyTarget === 'me') return s.user_id === user?.id;
                  return s.user_id === partner?.id;
                })
                .map((session) => (
                  <SessionHistoryCard
                    key={session.id}
                    session={session}
                    canAdjustTime={
                      canModerateStreak
                      || user?.relation_type === 'coach'
                      || user?.relation_type === 'coach_partner'
                    }
                    onAdjustTime={handleAdjustSessionTime}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3" data-testid="stats-view-selector">
            <div className="min-w-[13rem] space-y-1.5">
              <label className="text-xs text-zinc-500">Afficher les statistiques de :</label>
              <Select value={statsTarget} onValueChange={setStatsTarget}>
                <SelectTrigger className="h-10 w-full rounded-full border-white/10 bg-[#141414] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  <SelectItem value="duo" className="text-white">Duo</SelectItem>
                  <SelectItem value="me" className="text-white">{viewerLabel}</SelectItem>
                  <SelectItem value="partner" className="text-white">{partnerLabel}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-36 space-y-1.5">
              <label className="text-xs text-zinc-500">Période</label>
              <Select value={statsPeriod} onValueChange={setStatsPeriod}>
                <SelectTrigger className="h-10 w-full rounded-full border-white/10 bg-[#141414] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  <SelectItem value="7" className="text-white">7 jours</SelectItem>
                  <SelectItem value="30" className="text-white">30 jours</SelectItem>
                  <SelectItem value="90" className="text-white">90 jours</SelectItem>
                  <SelectItem value="year" className="text-white">Cette année</SelectItem>
                  <SelectItem value="all" className="text-white">Tout</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {statsLoading ? (
            <DuoStatsCardsSkeleton />
          ) : statsError ? (
            <div className="card p-8 text-center">
              <BarChart3 className="mx-auto mb-4 text-red-400" size={32} />
              <p className="text-red-300">Impossible de charger les statistiques.</p>
              <p className="mt-1 text-xs text-zinc-500">{statsError}</p>
            </div>
          ) : statsTarget === 'duo' ? (
            detailedStats?.summary?.total_sessions > 0 && duoStats ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="card p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="text-[var(--theme-primary)] shrink-0" size={16} />
                    <span className="text-zinc-400 text-xs uppercase truncate">Activités combinées</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {detailedStats.summary.total_sessions}
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">
                    {detailedStats.summary.total_completed} terminées
                  </p>
                </div>
                <div className="card p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="text-[var(--theme-primary)] shrink-0" size={16} />
                    <span className="text-zinc-400 text-xs uppercase truncate">Durée combinée</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatDuration(detailedStats.summary.total_time)}
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">deux membres</p>
                </div>
                <div className="card p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <FlameIcon className="text-orange-400 shrink-0" size={16} />
                    <span className="text-zinc-400 text-xs uppercase truncate">Calories combinées</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-300">
                    {formatCalories(detailedStats.summary.total_calories)}
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">estimation</p>
                </div>
                <div className="card p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="text-[var(--theme-primary)] shrink-0" size={16} />
                    <span className="text-zinc-400 text-xs uppercase truncate">Séances communes</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {duoStats.total_workouts_together ?? duoStats.sessions_together ?? 0}
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">non doublées</p>
                </div>
                <div className="card p-4 min-w-0 overflow-hidden col-span-2 md:col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <Flame className="text-orange-400" size={14} />
                        <p className="text-xs uppercase text-zinc-500">Streak Duo</p>
                      </div>
                      <p className="text-xl font-bold text-white">
                        {duoStats.duo_streak_current ?? duoStats.streak ?? 0}
                      </p>
                      <p className="text-xs text-zinc-500">
                        record {duoStats.duo_streak_best ?? '—'}
                      </p>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <Trophy className="text-[var(--theme-primary)]" size={14} />
                        <p className="text-xs uppercase text-zinc-500">Badges Duo</p>
                      </div>
                      <p className="text-xl font-bold text-white">
                        {duoStats.duo_badges_unlocked ?? 0}
                      </p>
                      <p className="text-xs text-zinc-500">
                        / {duoStats.duo_badges_total ?? 50}
                      </p>
                    </div>
                  </div>
                </div>
                {duoStats.current_challenge ? (
                  <div className="card p-4 min-w-0 overflow-hidden col-span-2 md:col-span-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="text-[var(--theme-primary)] shrink-0" size={16} />
                      <span className="text-white font-medium text-sm">Défi Duo</span>
                    </div>
                    <p className="text-zinc-400 text-sm mb-2">{duoStats.current_challenge.title}</p>
                    <p className="text-zinc-500 text-xs">
                      {duoStats.current_challenge.current}/{duoStats.current_challenge.target}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <BarChart3 className="mx-auto text-zinc-500 mb-4" size={32} />
                <p className="text-zinc-400">Aucune donnée Duo disponible</p>
              </div>
            )
          ) : detailedStats?.summary?.total_sessions > 0 ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="text-[var(--theme-primary)]" size={16} />
                    <span className="text-zinc-400 text-xs uppercase">Taux complétion</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{detailedStats.summary.completion_rate}%</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    {detailedStats.summary.total_completed}/{detailedStats.summary.total_sessions} séances
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="text-[var(--theme-primary)]" size={16} />
                    <span className="text-zinc-400 text-xs uppercase">Temps total</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatDuration(detailedStats.summary.total_time)}</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    ~{formatDuration(detailedStats.summary.avg_time)} / séance
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-[var(--theme-primary)]" size={16} />
                    <span className="text-zinc-400 text-xs uppercase">Cette semaine</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{detailedStats.summary.this_week}</p>
                  <p className="text-zinc-500 text-xs mt-1">séances</p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="text-[var(--theme-primary)]" size={16} />
                    <span className="text-zinc-400 text-xs uppercase">Ce mois</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{detailedStats.summary.this_month}</p>
                  <p className="text-zinc-500 text-xs mt-1">séances</p>
                </div>
              </div>

              {detailedStats.summary.total_calories != null && (
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FlameIcon className="text-orange-400" size={16} />
                    <span className="text-white font-medium text-sm">Calories estimées</span>
                    <span className="text-zinc-600 text-[10px]">(approximatif)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-xl bg-white/5">
                      <p className="text-lg font-bold text-orange-300">
                        {formatCalories(detailedStats.summary.week_calories)}
                      </p>
                      <p className="text-zinc-500 text-[10px]">Semaine</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/5">
                      <p className="text-lg font-bold text-orange-300">
                        {formatCalories(detailedStats.summary.month_calories)}
                      </p>
                      <p className="text-zinc-500 text-[10px]">Mois</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/5">
                      <p className="text-lg font-bold text-orange-300">
                        {formatCalories(detailedStats.summary.total_calories)}
                      </p>
                      <p className="text-zinc-500 text-[10px]">Total</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Averages */}
              {(detailedStats.averages.fatigue_before != null || detailedStats.averages.difficulty != null) && (
                <div className="card p-4">
                  <h3 className="text-white font-medium mb-4">Moyennes</h3>
                  <div className="space-y-4">
                    {detailedStats.averages.fatigue_before != null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-400">Fatigue avant</span>
                          <span className="text-white">{detailedStats.averages.fatigue_before}/10</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 transition-all"
                            style={{ width: `${detailedStats.averages.fatigue_before * 10}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {detailedStats.averages.fatigue_after != null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-400">Fatigue après</span>
                          <span className="text-white">{detailedStats.averages.fatigue_after}/10</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${detailedStats.averages.fatigue_after * 10}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {detailedStats.averages.difficulty != null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-400">Difficulté ressentie</span>
                          <span className="text-white">{detailedStats.averages.difficulty}/10</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--theme-primary)] transition-all"
                            style={{ width: `${detailedStats.averages.difficulty * 10}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Weekly Chart */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="text-[var(--theme-primary)]" size={18} />
                  <h3 className="text-white font-medium">7 derniers jours</h3>
                </div>
                <div className="flex items-end gap-2 h-24">
                  {detailedStats.daily_stats.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${Math.max(8, (day.count / Math.max(1, ...detailedStats.daily_stats.map(d => d.count))) * 80)}px`,
                          background: day.completed > 0 
                            ? 'linear-gradient(180deg, var(--theme-primary), var(--theme-secondary))' 
                            : 'rgba(255,255,255,0.1)',
                        }}
                      />
                      <span className="text-[10px] text-zinc-500">{day.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Sessions */}
              {detailedStats.recent_sessions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    Dernières séances
                  </h3>
                  <div className="space-y-2">
                    {detailedStats.recent_sessions.map((session) => (
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
                          <p className="text-white font-medium text-sm truncate">{session.workout_title}</p>
                          <p className="text-zinc-500 text-xs">
                            {session.created_at && format(parseISO(session.created_at), 'd MMM', { locale: fr })}
                            {' • '}
                            {formatDuration(session.total_time)}
                            {session.difficulty_felt && ` • Diff: ${session.difficulty_felt}/10`}
                            {session.estimated_calories != null && ` • ${formatCalories(session.estimated_calories)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm">
                            {session.exercises_completed}/{session.exercises_total}
                          </p>
                          <p className="text-zinc-500 text-xs">exercices</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-8 text-center">
              <BarChart3 className="mx-auto text-zinc-500 mb-4" size={32} />
              <p className="text-zinc-400">Aucune donnée disponible</p>
            </div>
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
}) {
  const member = resolveSessionMember(session, user, partner);
  const isOwn = member && user?.id && String(member.id) === String(user.id);
  const displayName = getDisplayName(member) || session.display_name || session.username || 'Membre';
  const roleLabel = getDuoRoleLabel(member?.duo_role);
  const statusLabel =
    session.status === 'completed'
      ? 'Terminée'
      : session.status === 'abandoned'
        ? 'Abandonnée'
        : session.status === 'in_progress'
          ? 'En cours'
          : session.status || '';
  const formatDuration = (seconds) => {
    const mins = Math.floor((seconds || 0) / 60);
    return `${mins} min`;
  };
  const dateLabel = session.created_at
    ? format(parseISO(session.created_at), "d MMM · HH:mm", { locale: fr })
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
            <span className="text-white font-medium truncate">{displayName}</span>
            {roleLabel && roleLabel !== 'Membre' ? (
              <span className="text-[10px] text-zinc-500 shrink-0">— {roleLabel}</span>
            ) : null}
            {session.status === 'completed' && (
              <Trophy size={14} className="text-green-500 shrink-0" />
            )}
          </div>
          <p className="text-white text-sm font-medium truncate mt-0.5">
            {session.workout_title || session.title || 'Séance'}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5 line-clamp-2 break-words">
            {[dateLabel, statusLabel, isCommon ? 'Séance commune' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1 text-zinc-400">
          <Clock size={14} />
          <span>{formatDuration(session.total_time)}</span>
        </div>
        {(exercisesDone != null || exercisesTotal != null) && (
          <div className="flex items-center gap-1 text-zinc-400">
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
        <p className="text-zinc-400 text-sm italic line-clamp-2">"{session.notes}"</p>
      )}

      {session.reactions?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {session.reactions.slice(-5).map((r, i) => (
            <span key={i} className="text-lg">
              {QUICK_REACTIONS.find((qr) => qr.type === r.reaction_type)?.emoji || '👍'}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <button
          onClick={() => onLike(session.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            isLikedByMe
              ? 'bg-red-500/20 text-red-500'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10'
          }`}
        >
          <Heart size={16} fill={isLikedByMe ? 'currentColor' : 'none'} />
          <span className="text-sm">{session.likes?.length || 0}</span>
        </button>

        {QUICK_REACTIONS.slice(0, 3).map((reaction) => (
          <button
            key={reaction.type}
            onClick={() => onReaction(session.id, reaction.type)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
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
              : 'bg-white/5 text-zinc-400 hover:bg-white/10'
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
                  <p className="text-zinc-400 text-sm break-words">
                    <span className="text-white font-medium">{commentName}</span>{' '}
                    {comment.text}
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
                className="flex-1 h-10 rounded-xl bg-[#0A0A0A] border-white/10 text-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onComment(session.id);
                }}
              />
              <Button
                size="sm"
                onClick={() => onComment(session.id)}
                disabled={!commentText.trim()}
                className="bg-[var(--theme-primary)] text-white rounded-xl"
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
