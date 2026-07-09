import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { partnerApi, duoApi, streakApi, usersApi, formatApiError } from '../lib/api';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileEditDialog } from '../components/profile/ProfileEditDialog';
import { ProfileEmptyState } from '../components/profile/ProfileEmptyState';
import { ProfileStatsTab } from '../components/profile/ProfileStatsTab';
import { PostFeed } from '../components/social/PostFeed';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Settings,
  LogOut,
  UserPlus,
  UserMinus,
  Search,
  Check,
  X,
  Loader2,
  ChevronRight,
  LayoutGrid,
  Repeat2,
  BarChart3,
  Bell,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  canViewProfileSection,
  isOwnProfile,
  isProfileLimited,
  getPublicHandle,
} from '../lib/userProfile';

/**
 * Profil social V2 — affiche le profil connecté par défaut.
 * `viewedUser` permet de préparer l'affichage d'autres profils (route /profile/:handle à venir).
 */
export function ProfilePage({ viewedUser = null, onProfileUpdate = null }) {
  const { user, updateProfile, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const profileUser = viewedUser || user;
  const isOwn = isOwnProfile(user, profileUser);
  const isLimited = isProfileLimited(profileUser, user);
  const [followLoading, setFollowLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('posts');
  const [editOpen, setEditOpen] = useState(false);
  const [badges, setBadges] = useState([]);
  const [duoStats, setDuoStats] = useState(null);
  const [detailedStats, setDetailedStats] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // Partner state (conservé, section secondaire)
  const [partner, setPartner] = useState(null);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [selectedRelationType, setSelectedRelationType] = useState('partner');

  const canShowPosts = useMemo(
    () => canViewProfileSection(profileUser, user, 'posts'),
    [profileUser, user]
  );

  useEffect(() => {
    if (searchParams.get('edit') === '1' && isOwn) {
      setEditOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, isOwn]);

  const loadBadges = useCallback(async () => {
    if (!isOwn) return;
    try {
      const { data } = await duoApi.getStats();
      setBadges(data?.badges || []);
      setDuoStats(data);
    } catch {
      setBadges([]);
    }
  }, [isOwn]);

  const loadStats = useCallback(async () => {
    if (!profileUser?.id) {
      setStatsLoading(false);
      return;
    }

    if (isOwn) {
      setStatsLoading(true);
      try {
        const end = new Date();
        const start = new Date();
        start.setFullYear(start.getFullYear() - 1);
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);

        const [statsRes, detailedRes, calendarRes] = await Promise.all([
          duoApi.getStats(),
          duoApi.getDetailedStats('all', profileUser.id),
          streakApi.getCalendar(startStr, endStr),
        ]);

        setDuoStats(statsRes.data);
        setBadges(statsRes.data?.badges || []);
        setDetailedStats(detailedRes.data);
        setCalendarDays(calendarRes.data?.days || []);
      } catch {
        setDetailedStats(null);
        setCalendarDays([]);
      } finally {
        setStatsLoading(false);
      }
      return;
    }

    if (isLimited || !canViewProfileSection(profileUser, user, 'stats')) {
      setDuoStats(null);
      setDetailedStats(null);
      setCalendarDays([]);
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);
    try {
      const handle = getPublicHandle(profileUser);
      const { data } = await usersApi.getProfileStats(handle);
      setDuoStats(data?.duo_stats || null);
      setBadges(data?.duo_stats?.badges || []);
      setDetailedStats(data?.detailed_stats || null);
      setCalendarDays(data?.calendar_days || []);
    } catch {
      setDuoStats(null);
      setDetailedStats(null);
      setCalendarDays([]);
    } finally {
      setStatsLoading(false);
    }
  }, [profileUser, user, isOwn, isLimited]);

  const loadPartnerData = useCallback(async () => {
    if (!isOwn) return;
    try {
      const [partnerRes, requestsRes, sentRes] = await Promise.all([
        partnerApi.getInfo(),
        partnerApi.getRequests(),
        partnerApi.getSentRequests(),
      ]);
      setPartner(partnerRes.data);
      setPartnerRequests(requestsRes.data || []);
      setSentRequests(sentRes.data || []);
    } catch (error) {
      console.error('Failed to load partner data:', error);
    }
  }, [isOwn]);

  useEffect(() => {
    loadBadges();
    loadStats();
    loadPartnerData();
  }, [loadBadges, loadStats, loadPartnerData, user]);

  const handleSaveProfile = async (data) => {
    const result = await updateProfile(data);
    if (result.success) {
      await loadStats();
    }
    return result;
  };

  const handleFollow = async () => {
    const handle = getPublicHandle(profileUser);
    if (!handle) return;

    setFollowLoading(true);
    try {
      const { data } = await usersApi.follow(handle);
      onProfileUpdate?.(data);
      toast.success(data.follow_request_pending ? 'Demande de suivi envoyée' : 'Tu suis cet utilisateur');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    const handle = getPublicHandle(profileUser);
    if (!handle) return;

    setFollowLoading(true);
    try {
      const { data } = await usersApi.unfollow(handle);
      onProfileUpdate?.(data);
      toast.success('Abonnement retiré');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data } = await usersApi.search(query);
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetUsername) => {
    try {
      await partnerApi.sendRequest({
        target_username: targetUsername,
        relation_type: selectedRelationType,
      });
      toast.success('Demande envoyée !');
      setPartnerDialogOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      loadPartnerData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await partnerApi.accept(requestId);
      toast.success('Partenaire accepté !');
      loadPartnerData();
      refreshUser();
      loadStats();
    } catch {
      toast.error('Erreur');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await partnerApi.reject(requestId);
      toast.success('Demande refusée');
      loadPartnerData();
    } catch {
      toast.error('Erreur');
    }
  };

  const handleUnlinkPartner = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir vous délier de votre partenaire ?')) return;

    try {
      await partnerApi.unlink();
      toast.success('Partenaire délié');
      setPartner(null);
      refreshUser();
    } catch {
      toast.error('Erreur');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!profileUser) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  return (
    <div data-testid="profile-page" className="p-5 pb-32 md:pb-8 animate-fade-in max-w-3xl mx-auto">
      <header className="mb-5 flex items-center justify-between md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-white font-['Outfit']">
          {isOwn ? 'Mon profil' : 'Profil'}
        </h1>
        {isOwn ? (
          <Link
            to="/settings"
            className="hidden md:flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Settings size={18} />
            Paramètres
          </Link>
        ) : null}
      </header>

      <div className="space-y-5">
        <ProfileHeader
          profileUser={profileUser}
          viewer={user}
          isOwn={isOwn}
          badges={badges}
          followersCount={profileUser.followers_count ?? 0}
          followingCount={profileUser.following_count ?? 0}
          onEdit={() => setEditOpen(true)}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
          isFollowing={!!profileUser.is_following}
          isMutual={!!profileUser.is_mutual}
          followLoading={followLoading}
          followRequestPending={!!profileUser.follow_request_pending}
          isLimited={isLimited}
        />

        {isOwn && badges.length > 0 ? (
          <div className="flex justify-center sm:justify-start">
            <Link
              to="/badges"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--theme-primary)] hover:underline"
            >
              <Trophy size={14} />
              Voir tous les badges
            </Link>
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-12 rounded-2xl bg-[#141414] border border-white/10 p-1">
            <TabsTrigger
              value="posts"
              className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 gap-1.5 text-xs sm:text-sm"
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            <TabsTrigger
              value="reposts"
              className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 gap-1.5 text-xs sm:text-sm"
            >
              <Repeat2 size={16} />
              <span className="hidden sm:inline">Republications</span>
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 gap-1.5 text-xs sm:text-sm"
            >
              <BarChart3 size={16} />
              <span className="hidden sm:inline">Statistiques</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4 focus-visible:outline-none">
            {isLimited ? (
              <ProfileEmptyState
                icon={LayoutGrid}
                title="Publications privées"
                description="Les posts de cet utilisateur ne sont pas accessibles."
              />
            ) : canShowPosts ? (
              <PostFeed
                profileUser={profileUser}
                viewer={user}
                mode="posts"
                emptyIcon={LayoutGrid}
                emptyTitle="Aucune publication"
                emptyDescription={
                  isOwn
                    ? 'Partage tes séances et badges depuis la fin d\'une séance ou tes paramètres.'
                    : 'Cet utilisateur n\'a pas encore publié.'
                }
              />
            ) : (
              <ProfileEmptyState
                icon={LayoutGrid}
                title="Publications masquées"
                description="Cet utilisateur a choisi de ne pas afficher ses publications."
              />
            )}
          </TabsContent>

          <TabsContent value="reposts" className="mt-4 focus-visible:outline-none">
            {isLimited ? (
              <ProfileEmptyState
                icon={Repeat2}
                title="Republications privées"
                description="Le contenu partagé n'est pas visible sur ce profil."
              />
            ) : canShowPosts ? (
              <PostFeed
                profileUser={profileUser}
                viewer={user}
                mode="reposts"
                emptyIcon={Repeat2}
                emptyTitle="Aucune republication"
                emptyDescription={
                  isOwn
                    ? 'Republie des séances duo ou des posts depuis ton fil.'
                    : 'Rien de partagé pour l\'instant.'
                }
              />
            ) : (
              <ProfileEmptyState
                icon={Repeat2}
                title="Republications masquées"
                description="Cet utilisateur a choisi de ne pas afficher ses publications."
              />
            )}
          </TabsContent>

          <TabsContent value="stats" className="mt-4 focus-visible:outline-none">
            <ProfileStatsTab
              profileUser={profileUser}
              viewer={user}
              isOwn={isOwn}
              isLimited={isLimited}
              loading={statsLoading}
              duoStats={duoStats}
              detailedStats={detailedStats}
              calendarDays={calendarDays}
            />
          </TabsContent>
        </Tabs>

        {isOwn ? (
          <>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white font-['Outfit']">Partenaire</h3>
                {!partner && (
                  <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-[var(--theme-primary)] text-white">
                        <UserPlus size={16} className="mr-1" /> Ajouter
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#141414] border-white/10">
                      <DialogHeader>
                        <DialogTitle className="text-white">Trouver un partenaire</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                          <Input
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Rechercher par pseudo..."
                            className="pl-10 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                          />
                        </div>

                        <div>
                          <Label className="text-zinc-400 text-sm">Type de relation</Label>
                          <Select value={selectedRelationType} onValueChange={setSelectedRelationType}>
                            <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#141414] border-white/10">
                              <SelectItem value="partner" className="text-white">Partenaire</SelectItem>
                              <SelectItem value="coach" className="text-white">Coach</SelectItem>
                              <SelectItem value="coach_partner" className="text-white">Coach + Partenaire</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {searching && (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-[var(--theme-primary)]" />
                          </div>
                        )}

                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {searchResults.map((result) => (
                            <button
                              key={result.id}
                              type="button"
                              onClick={() => handleSendRequest(result.username)}
                              className="w-full p-3 flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                            >
                              <div className="w-10 h-10 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center">
                                <span className="text-white font-medium">
                                  {result.display_name?.[0] || result.username?.[0] || '?'}
                                </span>
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-white font-medium">{result.display_name || result.username}</p>
                                <p className="text-zinc-500 text-sm">{result.handle ? `@${result.handle}` : `@${result.username}`}</p>
                              </div>
                              <UserPlus size={18} className="text-[var(--theme-primary)]" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {partner ? (
                <div className="space-y-3">
                  <Link
                    to={`/profile/${getPublicHandle(partner) || partner.username}`}
                    className="flex items-center gap-4 rounded-xl hover:bg-white/5 p-2 -m-2 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center">
                      <span className="text-white font-bold">
                        {partner.display_name?.[0] || partner.username?.[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{partner.display_name || partner.username}</p>
                      <p className="text-zinc-500 text-sm">
                        {partner.relation_type === 'coach'
                          ? 'Coach'
                          : partner.relation_type === 'coach_partner'
                            ? 'Coach + Partenaire'
                            : 'Partenaire'}
                      </p>
                    </div>
                    <ChevronRight className="text-zinc-500" size={18} />
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUnlinkPartner}
                    className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                  >
                    <UserMinus size={16} className="mr-1.5" />
                    Délier le partenaire
                  </Button>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">Pas de partenaire lié</p>
              )}

              {partnerRequests.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-zinc-400 text-sm mb-3">Demandes reçues</p>
                  {partnerRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--theme-primary)] flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {request.from_username?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{request.from_username}</p>
                        <p className="text-zinc-500 text-xs capitalize">{request.relation_type}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(request.id)}
                        className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(request.id)}
                        className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {sentRequests.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-zinc-400 text-sm mb-3">Demandes envoyées</p>
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {request.to_username?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{request.to_username}</p>
                        <p className="text-zinc-500 text-xs">En attente...</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/notifications"
              className="card p-4 flex items-center gap-3 hover:bg-white/[0.07] transition-colors"
            >
              <Bell size={20} className="text-[var(--theme-primary)]" />
              <div className="flex-1">
                <p className="text-white font-medium">Notifications</p>
                <p className="text-zinc-500 text-xs">Abonnés, suivis en retour…</p>
              </div>
              <ChevronRight size={18} className="text-zinc-500" />
            </Link>

            <Link
              to="/settings"
              className="card p-4 flex items-center gap-3 hover:bg-white/[0.07] transition-colors"
            >
              <Settings size={20} className="text-[var(--theme-primary)]" />
              <div className="flex-1">
                <p className="text-white font-medium">Paramètres</p>
                <p className="text-zinc-500 text-xs">Confidentialité, thème, notifications…</p>
              </div>
              <ChevronRight size={18} className="text-zinc-500" />
            </Link>

            <Button
              onClick={handleLogout}
              variant="outline"
              data-testid="logout-btn"
              className="w-full h-12 rounded-xl bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              <LogOut size={18} className="mr-2" /> Se déconnecter
            </Button>
          </>
        ) : null}
      </div>

      {isOwn ? (
        <ProfileEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          user={user}
          badges={badges}
          onSave={handleSaveProfile}
        />
      ) : null}
    </div>
  );
}
