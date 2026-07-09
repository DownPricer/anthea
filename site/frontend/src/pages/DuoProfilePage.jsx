import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, LayoutGrid, BarChart3, Activity, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { duoProfilesApi, formatApiError } from '../lib/api';
import { normalizeDuoStats } from '../lib/duoStats';
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

/**
 * Page profil duo consultable — réutilisable pour profil public ou membre.
 */
export function DuoProfilePage({ viewedDuo = null, tag = null, onDuoUpdate = null }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [duoProfile, setDuoProfile] = useState(viewedDuo);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(!viewedDuo);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  const [statsError, setStatsError] = useState(null);

  const resolvedTag = tag || duoProfile?.tag;

  const loadProfile = useCallback(async () => {
    if (!resolvedTag) return;
    setLoading(true);
    try {
      const { data } = await duoProfilesApi.getByTag(resolvedTag);
      setDuoProfile(data);
      onDuoUpdate?.(data);
    } catch {
      setDuoProfile(null);
    } finally {
      setLoading(false);
    }
  }, [resolvedTag, onDuoUpdate]);

  const loadStats = useCallback(async () => {
    if (!resolvedTag || !duoProfile || isDuoLimited(duoProfile)) {
      setStats(null);
      setStatsLoading(false);
      return;
    }
    if (
      !canViewDuoSection(duoProfile, 'stats')
      && !canViewDuoSection(duoProfile, 'badges')
      && !canViewDuoSection(duoProfile, 'challenges')
    ) {
      setStats(null);
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    setStatsError(null);
    try {
      const { data } = await duoProfilesApi.getStats(resolvedTag);
      setStats(normalizeDuoStats(data));
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[duo profile stats]', err);
      setStats(null);
      const msg = formatApiError(err);
      setStatsError(msg);
      if (duoProfile.is_member) toast.error(msg);
    } finally {
      setStatsLoading(false);
    }
  }, [resolvedTag, duoProfile]);

  const loadActivity = useCallback(async () => {
    if (!resolvedTag || !duoProfile || !canViewDuoSection(duoProfile, 'activity')) {
      setActivity([]);
      setActivityLoading(false);
      return;
    }
    setActivityLoading(true);
    try {
      const { data } = await duoProfilesApi.getActivity(resolvedTag);
      setActivity(data || []);
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, [resolvedTag, duoProfile]);

  useEffect(() => {
    if (!viewedDuo && resolvedTag) loadProfile();
    else if (viewedDuo) setDuoProfile(viewedDuo);
  }, [viewedDuo, resolvedTag, loadProfile]);

  useEffect(() => {
    if (duoProfile) {
      loadStats();
      loadActivity();
    }
  }, [duoProfile, loadStats, loadActivity]);

  const canShowPosts = useMemo(
    () => canViewDuoSection(duoProfile, 'posts'),
    [duoProfile]
  );
  const canShowStats = useMemo(
    () => canViewDuoSection(duoProfile, 'stats'),
    [duoProfile]
  );
  const canShowBadges = useMemo(
    () => canViewDuoSection(duoProfile, 'badges'),
    [duoProfile]
  );
  const canShowChallenges = useMemo(
    () => canViewDuoSection(duoProfile, 'challenges'),
    [duoProfile]
  );
  const canShowActivity = useMemo(
    () => canViewDuoSection(duoProfile, 'activity'),
    [duoProfile]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
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
        onEdit={duoProfile.is_member ? () => setEditOpen(true) : undefined}
        onFollowUpdate={(data) => {
          setDuoProfile(data);
          onDuoUpdate?.(data);
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 space-y-6">
        <TabsList className="w-full bg-[#141414] p-1 rounded-2xl border border-white/10">
          <TabsTrigger value="posts" className="flex-1 rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white gap-1.5">
            <LayoutGrid size={14} /> Mur
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex-1 rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white gap-1.5">
            <BarChart3 size={14} /> Stats
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white gap-1.5">
            <Activity size={14} /> Activité
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          {canShowPosts || duoProfile.is_member ? (
            <DuoPostFeed duoProfile={duoProfile} viewer={user} />
          ) : (
            <ProfileEmptyState title="Mur masqué" description="Le mur duo n'est pas visible." />
          )}
        </TabsContent>

        <TabsContent value="stats">
          <DuoProfileStatsTab
            stats={stats}
            loading={statsLoading}
            statsError={statsError}
            canViewStats={canShowStats}
            canViewBadges={canShowBadges}
            canViewChallenges={canShowChallenges}
            duoProfile={duoProfile}
            onBadgeShared={loadStats}
          />
        </TabsContent>

        <TabsContent value="activity">
          <DuoActivityList activity={activity} loading={activityLoading} canView={canShowActivity} members={duoProfile.members} />
        </TabsContent>
      </Tabs>

      {duoProfile.is_member ? (
        <DuoProfileEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          duoProfile={duoProfile}
          onSaved={(data) => {
            setDuoProfile(data);
            onDuoUpdate?.(data);
            loadProfile();
            loadStats();
            loadActivity();
          }}
        />
      ) : null}
    </div>
  );
}

function DuoActivityList({ activity, loading, canView, members }) {
  if (!canView) {
    return (
      <ProfileEmptyState
        title="Activité masquée"
        description="L'activité récente de ce duo n'est pas publique."
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
          return (
            <div key={`common-${item.date}-${idx}`} className="card p-4 border border-amber-500/20">
              <p className="text-amber-300 text-xs uppercase tracking-wide mb-2">Séance commune</p>
              <p className="text-zinc-500 text-xs mb-3">
                {item.date && format(parseISO(item.date), 'd MMMM yyyy', { locale: fr })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <ActivityMini session={item.session_a} member={memberMap[item.session_a?.user_id]} />
                <ActivityMini session={item.session_b} member={memberMap[item.session_b?.user_id]} />
              </div>
            </div>
          );
        }
        const session = item.session;
        const member = memberMap[session?.user_id];
        return (
          <div key={session?.id || idx} className="card p-4 flex items-center gap-3">
            <UserAvatar user={member} className="w-10 h-10 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {getDisplayName(member)} — {session?.workout_title}
              </p>
              <p className="text-zinc-500 text-xs flex items-center gap-2 mt-0.5">
                <Clock size={12} />
                {formatDuration(session?.total_time || 0)}
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
    <div className="rounded-lg bg-white/5 p-2">
      <p className="text-white text-xs font-medium truncate">{getDisplayName(member)}</p>
      <p className="text-zinc-500 text-[10px] truncate">{session.workout_title}</p>
    </div>
  );
}
