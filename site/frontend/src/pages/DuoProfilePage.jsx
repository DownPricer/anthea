import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { parseISO } from 'date-fns';
import { LayoutGrid, BarChart3, Activity, Clock, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { duoProfilesApi, formatApiError } from '../lib/api';
import { normalizeDuoStats, normalizeDuoActivityItem } from '../lib/duoStats';
import { toast } from 'sonner';
import { DuoProfileHeader } from '../components/duo/DuoProfileHeader';
import { DuoProfileStatsTab } from '../components/duo/DuoProfileStatsTab';
import { DuoProfileEditDialog } from '../components/duo/DuoProfileEditDialog';
import { DuoPostFeed } from '../components/duo/DuoPostFeed';
import { ProfileEmptyState } from '../components/profile/ProfileEmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { UserAvatar } from '../components/UserAvatar';
import { canViewDuoSection, isDuoLimited } from '../lib/duoProfile';
import { getDisplayName, formatDuration } from '../lib/userProfile';
import { useLocaleFormat } from '../hooks/useLocaleFormat';
import { useTranslation } from 'react-i18next';
import {
  getDuoCache,
  setDuoCache,
  duoCacheKey,
  DUO_STALE,
  dedupeInflight,
} from '../lib/duoCache';
import {
  DuoHeaderSkeleton,
  DuoStatsCardsSkeleton,
  DuoActivitySkeleton,
} from '../components/duo/DuoSkeletons';

function scheduleSecondary(fn) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn, { timeout: 1200 });
  } else {
    setTimeout(fn, 0);
  }
}

function duoPerfMark(label) {
  if (process.env.NODE_ENV !== 'development') return () => {};
  const t0 = performance.now();
  return (extra = {}) => {
    // eslint-disable-next-line no-console
    console.debug(`[DuoProfile] ${label}`, {
      ms: Math.round(performance.now() - t0),
      ...extra,
    });
  };
}

/**
 * Page profil duo — chargement prioritaire P1 → P2 → P3.
 * P1 : header (bannière, photo, nom, membres, boutons)
 * P2 : stats / défi / compteurs
 * P3 : mur, activité (onglets uniquement)
 */
export function DuoProfilePage({ viewedDuo = null, tag = null, onDuoUpdate = null }) {
  const { t } = useTranslation(['duo', 'workouts']);
  const { user } = useAuth();
  const { theme } = useTheme();
  const [duoProfile, setDuoProfile] = useState(viewedDuo);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [profileLoading, setProfileLoading] = useState(!viewedDuo);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [statsError, setStatsError] = useState(null);
  const [postsMounted, setPostsMounted] = useState(false);
  const [activityRequested, setActivityRequested] = useState(false);

  const abortRef = useRef(null);
  const onDuoUpdateRef = useRef(onDuoUpdate);
  onDuoUpdateRef.current = onDuoUpdate;
  const reqCountRef = useRef({ profile: 0, stats: 0, activity: 0, posts: 0 });

  const resolvedTag = tag || duoProfile?.tag;

  const loadProfile = useCallback(async () => {
    if (!resolvedTag) return;
    const end = duoPerfMark('header');
    const profileKey = duoCacheKey('publicProfile', resolvedTag);
    const cached = getDuoCache(profileKey);
    if (cached) {
      setDuoProfile(cached);
      setProfileLoading(false);
      onDuoUpdateRef.current?.(cached);
      end({ source: 'cache' });
    } else {
      setProfileLoading(true);
    }

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

    try {
      reqCountRef.current.profile += 1;
      const data = await dedupeInflight(profileKey, async () => {
        const { data: remote } = await duoProfilesApi.getByTag(resolvedTag, {
          signal: ctrl.signal,
        });
        return remote;
      });
      if (ctrl.signal.aborted) return;
      setDuoProfile(data);
      if (data) setDuoCache(profileKey, data, DUO_STALE.profile);
      onDuoUpdateRef.current?.(data);
      end({
        source: 'network',
        requests: reqCountRef.current.profile,
      });
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      if (!cached) setDuoProfile(null);
    } finally {
      if (!ctrl.signal.aborted) setProfileLoading(false);
    }
  }, [resolvedTag]);

  const loadStats = useCallback(async () => {
    if (!resolvedTag || !duoProfile || isDuoLimited(duoProfile)) {
      setStats(null);
      setStatsLoading(false);
      return;
    }
    if (
      !duoProfile.is_member
      && !canViewDuoSection(duoProfile, 'stats')
      && !canViewDuoSection(duoProfile, 'badges')
      && !canViewDuoSection(duoProfile, 'challenges')
    ) {
      setStats(null);
      setStatsLoading(false);
      return;
    }

    const end = duoPerfMark('stats');
    const statsKey = duoCacheKey('publicStats', resolvedTag);
    const cached = getDuoCache(statsKey);
    if (cached) {
      setStats(cached);
      setStatsLoading(false);
      end({ source: 'cache' });
    } else {
      setStatsLoading(true);
    }
    setStatsError(null);

    try {
      // Toujours l'endpoint public slim — évite /duo/stats (catalogue solo + N agrégats)
      reqCountRef.current.stats += 1;
      const data = await dedupeInflight(statsKey, async () => {
        const { data: remote } = await duoProfilesApi.getStats(resolvedTag);
        return remote;
      });
      const normalized = normalizeDuoStats(data);
      setStats(normalized);
      setDuoCache(statsKey, normalized, DUO_STALE.stats);
      end({
        source: 'network',
        endpoint: `/duos/${resolvedTag}/stats`,
        requests: reqCountRef.current.stats,
      });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[duo profile stats]', err);
      if (!cached) setStats(null);
      const msg = formatApiError(err);
      setStatsError(msg);
      if (duoProfile.is_member) toast.error(msg);
    } finally {
      setStatsLoading(false);
    }
  }, [resolvedTag, duoProfile]);

  const loadActivity = useCallback(async () => {
    if (!resolvedTag || !duoProfile) {
      setActivity([]);
      setActivityLoading(false);
      return;
    }
    const isMember = !!duoProfile.is_member;
    if (!isMember && !canViewDuoSection(duoProfile, 'activity')) {
      setActivity([]);
      setActivityLoading(false);
      return;
    }

    const end = duoPerfMark('activity');
    const actKey = duoCacheKey('publicActivity', resolvedTag);
    const cached = getDuoCache(actKey);
    if (cached) {
      setActivity(cached);
      setActivityLoading(false);
      end({ source: 'cache' });
    } else {
      setActivityLoading(true);
    }

    try {
      reqCountRef.current.activity += 1;
      const data = await dedupeInflight(actKey, async () => {
        const { data: remote } = await duoProfilesApi.getActivity(resolvedTag, 30);
        return remote;
      });
      const items = (data || []).map(normalizeDuoActivityItem);
      setActivity(items);
      setDuoCache(actKey, items, DUO_STALE.activity);
      end({ source: 'network', requests: reqCountRef.current.activity });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[duo profile activity]', err);
      if (!cached) setActivity([]);
      if (duoProfile.is_member) toast.error(formatApiError(err));
    } finally {
      setActivityLoading(false);
    }
  }, [resolvedTag, duoProfile]);

  useEffect(() => {
    if (!viewedDuo && resolvedTag) loadProfile();
    else if (viewedDuo) {
      setDuoProfile(viewedDuo);
      setProfileLoading(false);
    }
    return () => abortRef.current?.abort();
  }, [viewedDuo, resolvedTag, loadProfile]);

  // P2 — stats après paint P1 (pas pendant le spinner header)
  useEffect(() => {
    if (!duoProfile) return undefined;
    let cancelled = false;
    scheduleSecondary(() => {
      if (!cancelled) loadStats();
    });
    return () => {
      cancelled = true;
    };
  }, [duoProfile, loadStats]);

  // P3 — mur monté uniquement quand l'onglet posts est actif (défaut)
  useEffect(() => {
    if (activeTab === 'posts') setPostsMounted(true);
    if (activeTab === 'activity') setActivityRequested(true);
  }, [activeTab]);

  useEffect(() => {
    if (!activityRequested || !duoProfile) return;
    loadActivity();
  }, [activityRequested, duoProfile, loadActivity]);

  const canShowPosts = useMemo(
    () => canViewDuoSection(duoProfile, 'posts'),
    [duoProfile],
  );
  const canShowStats = useMemo(
    () => canViewDuoSection(duoProfile, 'stats'),
    [duoProfile],
  );
  const canShowBadges = useMemo(
    () => canViewDuoSection(duoProfile, 'badges'),
    [duoProfile],
  );
  const canShowChallenges = useMemo(
    () => canViewDuoSection(duoProfile, 'challenges'),
    [duoProfile],
  );
  const canShowActivity = useMemo(
    () => duoProfile?.is_member || canViewDuoSection(duoProfile, 'activity'),
    [duoProfile],
  );

  const featuredBadges = useMemo(() => {
    if (Array.isArray(duoProfile?.featured_badges) && duoProfile.featured_badges.length) {
      return duoProfile.featured_badges.slice(0, 3);
    }
    const ids = Array.isArray(duoProfile?.featured_badge_ids) ? duoProfile.featured_badge_ids : [];
    if (!ids.length) return [];
    const pool = [
      ...(stats?.duo_badges || []),
      ...(stats?.badges || []),
    ];
    return ids
      .map((id) => pool.find((b) => b?.id === id && b?.unlocked) || null)
      .filter(Boolean)
      .slice(0, 3);
  }, [duoProfile?.featured_badges, duoProfile?.featured_badge_ids, stats]);

  if (!duoProfile && profileLoading) {
    return (
      <div data-testid="duo-profile-page" className="p-5 pb-32 max-w-3xl mx-auto">
        <DuoHeaderSkeleton />
      </div>
    );
  }

  if (!duoProfile) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <ProfileEmptyState title="Duo introuvable" description="Ce profil duo n'existe pas ou a été supprimé." />
      </div>
    );
  }

  return (
    <div data-testid="duo-profile-page" className="p-5 pb-32 max-w-3xl mx-auto animate-fade-in">
      <DuoProfileHeader
        duoProfile={duoProfile}
        viewer={user}
        theme={theme}
        featuredBadges={featuredBadges}
        onEdit={duoProfile.is_member ? () => setEditOpen(true) : undefined}
        onFollowUpdate={(data) => {
          setDuoProfile(data);
          onDuoUpdateRef.current?.(data);
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 space-y-6">
        <TabsList className="w-full bg-surface-elevated p-1 rounded-2xl border border-border">
          <TabsTrigger value="posts" className="flex-1 rounded-full data-[state=active]:bg-active data-[state=active]:text-foreground gap-1.5">
            <LayoutGrid size={14} /> Mur
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex-1 rounded-full data-[state=active]:bg-active data-[state=active]:text-foreground gap-1.5">
            <BarChart3 size={14} /> Stats
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 rounded-full data-[state=active]:bg-active data-[state=active]:text-foreground gap-1.5">
            <Activity size={14} /> Activité
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          {canShowPosts || duoProfile.is_member ? (
            postsMounted ? (
              <DuoPostFeed duoProfile={duoProfile} viewer={user} />
            ) : null
          ) : (
            <ProfileEmptyState title="Mur masqué" description="Le mur duo n'est pas visible." />
          )}
        </TabsContent>

        <TabsContent value="stats">
          {statsLoading && !stats ? (
            <DuoStatsCardsSkeleton />
          ) : (
            <DuoProfileStatsTab
              stats={stats}
              loading={statsLoading && !stats}
              statsError={statsError}
              canViewStats={canShowStats}
              canViewBadges={canShowBadges}
              canViewChallenges={canShowChallenges}
              duoProfile={duoProfile}
              onBadgeShared={loadStats}
            />
          )}
        </TabsContent>

        <TabsContent value="activity">
          {activityLoading && !activity.length ? (
            <DuoActivitySkeleton />
          ) : (
            <DuoActivityList
              activity={activity}
              loading={activityLoading && !activity.length}
              canView={canShowActivity}
              members={duoProfile.members}
            />
          )}
        </TabsContent>
      </Tabs>

      {duoProfile.is_member ? (
        <DuoProfileEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          duoProfile={duoProfile}
          onSaved={(data) => {
            setDuoProfile(data);
            onDuoUpdateRef.current?.(data);
            loadProfile();
            loadStats();
            if (activityRequested) loadActivity();
          }}
        />
      ) : null}
    </div>
  );
}

function DuoActivityList({ activity, loading, canView, members }) {
  const { t } = useTranslation(['duo', 'workouts']);
  const { formatDate } = useLocaleFormat();

  const safeFormatDate = (value) => {
    if (value == null || value === '') return '';
    try {
      let parsed = value;
      if (typeof value === 'string') {
        parsed = parseISO(value);
      } else if (value && typeof value === 'object' && value.$date) {
        parsed = typeof value.$date === 'string' ? parseISO(value.$date) : new Date(value.$date);
      } else if (!(value instanceof Date)) {
        parsed = new Date(value);
      }
      if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
        return '—';
      }
      return formatDate(parsed) || '—';
    } catch {
      return '—';
    }
  };

  if (!canView) {
    return (
      <ProfileEmptyState
        title="Activité masquée"
        description="L'activité récente de ce duo n'est pas publique."
      />
    );
  }

  if (loading) {
    return <DuoActivitySkeleton />;
  }

  if (!activity.length) {
    return (
      <ProfileEmptyState
        title="Aucune activité"
        description="Pas encore d'activité récente à afficher."
      />
    );
  }

  const memberMap = Object.fromEntries((members || []).map((m) => [m.id, m]));

  return (
    <div className="space-y-3" data-testid="duo-activity-list">
      {activity.map((item, idx) => {
        if (item.type === 'common_session') {
          const dateLabel = safeFormatDate(item.date);
          return (
            <div
              key={`common-${item.date}-${idx}`}
              className="card min-w-0 overflow-visible border border-amber-500/20 p-4"
            >
              <p className="shared-workout-badge mb-2">
                <Users size={14} />
                {t('workouts:labels.sharedWorkout')}
              </p>
              {dateLabel ? (
                <p className="text-subtle text-xs mb-3">{dateLabel}</p>
              ) : null}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ActivityMini session={item.session_a} member={memberMap[item.session_a?.user_id]} />
                <ActivityMini session={item.session_b} member={memberMap[item.session_b?.user_id]} />
              </div>
            </div>
          );
        }
        const session = item.session;
        const member = memberMap[session?.user_id];
        const createdLabel = safeFormatDate(session?.created_at);
        return (
          <div
            key={session?.id || idx}
            className="card flex min-w-0 items-center gap-3 overflow-visible p-4"
          >
            <UserAvatar user={member} className="w-10 h-10 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-medium truncate">
                {getDisplayName(member)} — {session?.workout_title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-subtle">
                <Clock size={12} />
                {formatDuration(session?.total_time || 0)}
                {session?.status ? <span>· {session.status}</span> : null}
                {createdLabel ? <span>· {createdLabel}</span> : null}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityMini({ session, member }) {
  if (!session) return null;
  return (
    <div className="min-w-0 overflow-visible rounded-lg bg-hover p-2">
      <p className="text-foreground text-xs font-medium truncate">{getDisplayName(member)}</p>
      <p className="line-clamp-2 break-words text-[10px] text-subtle">
        {session.workout_title || 'Séance'}
      </p>
      <p className="mt-1 text-[10px] text-subtle">
        {formatDuration(session.total_time || 0)}
        {session.status ? ` · ${session.status}` : ''}
      </p>
    </div>
  );
}
