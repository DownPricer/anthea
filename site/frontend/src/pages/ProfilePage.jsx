import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { duoApi, streakApi, usersApi, formatApiError } from '../lib/api';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileEditDialog } from '../components/profile/ProfileEditDialog';
import { AvatarCropDialog } from '../components/profile/AvatarCropDialog';
import { uploadsApi } from '../lib/api';
import { blobToDataUrl, revokePreviewUrl } from '../lib/imageCompress';
import { ProfileEmptyState } from '../components/profile/ProfileEmptyState';
import { ProfileStatsTab } from '../components/profile/ProfileStatsTab';
import { PostFeed } from '../components/social/PostFeed';
import { NotificationBell } from '../components/NotificationBell';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Settings,
  LogOut,
  Loader2,
  LayoutGrid,
  Repeat2,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/layout/PageHeader';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['profile', 'common']);
  const { user, updateProfile, logout, patchUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const profileUser = viewedUser || user;
  const isOwn = isOwnProfile(user, profileUser);
  const isLimited = isProfileLimited(profileUser, user);
  const [followLoading, setFollowLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('posts');
  const [editOpen, setEditOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [reopenProfileAfterCrop, setReopenProfileAfterCrop] = useState(false);
  const [badges, setBadges] = useState([]);
  const [duoStats, setDuoStats] = useState(null);
  const [detailedStats, setDetailedStats] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);

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

  useEffect(() => {
    if (!editOpen && reopenProfileAfterCrop && pendingAvatarFile && cropSrc && !cropOpen && !avatarUploading) {
      const frame = requestAnimationFrame(() => {
        setCropOpen(true);
        setReopenProfileAfterCrop(false);
      });
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [editOpen, reopenProfileAfterCrop, pendingAvatarFile, cropSrc, cropOpen, avatarUploading]);

  const handleAvatarFileSelected = (file) => {
    setPendingAvatarFile(file);
    setCropSrc(URL.createObjectURL(file));
    setReopenProfileAfterCrop(true);
    setEditOpen(false);
  };

  const resetAvatarCropState = () => {
    if (cropSrc) revokePreviewUrl(cropSrc);
    setCropSrc(null);
    setPendingAvatarFile(null);
    setReopenProfileAfterCrop(false);
  };

  const handleCropConfirm = async ({ file, blob }) => {
    setAvatarUploading(true);
    const previousAvatarUrl = user?.avatar_url || null;
    try {
      const dataUrl = await blobToDataUrl(file || blob);
      const uploadName = file?.name || `avatar-${Date.now()}.webp`;

      if (process.env.NODE_ENV === 'development') {
        console.debug('[AvatarUpload Request]', {
          filename: uploadName,
          type: file?.type,
          size: file?.size,
        });
      }

      const { data } = await uploadsApi.uploadImage(dataUrl, uploadName);
      const newAvatarUrl = data.url || data.path;

      if (process.env.NODE_ENV === 'development') {
        console.debug('[AvatarUpload Response]', data);
      }

      if (!newAvatarUrl) {
        throw new Error('Réponse upload invalide');
      }

      const now = new Date().toISOString();
      patchUser({ avatar_url: newAvatarUrl, updated_at: now });

      const saveResult = await updateProfile({ avatar_url: newAvatarUrl });
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Échec de la sauvegarde du profil');
      }

      await refreshUser();
      toast.success(t('profile:photoImported'));
      setCropOpen(false);
      resetAvatarCropState();
      setEditOpen(true);
    } catch (error) {
      console.error('[AvatarUpload Error]', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      patchUser({ avatar_url: previousAvatarUrl });
      toast.error(error.message || t('profile:photoImportFailed'));
    } finally {
      setAvatarUploading(false);
    }
  };

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

  useEffect(() => {
    loadBadges();
    loadStats();
  }, [loadBadges, loadStats, user]);

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
      toast.success(data.follow_request_pending ? t('profile:followRequestSent') : t('profile:nowFollowing'));
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
      toast.success(t('profile:unfollowed'));
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setFollowLoading(false);
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
      <PageHeader
        title={isOwn ? t('profile:myTitle') : t('profile:title')}
        subtitle={isOwn ? t('profile:subtitle') : null}
        actions={
          isOwn ? (
            <div className="flex items-center gap-2">
              <NotificationBell data-testid="profile-notification-bell" />
              <Link
                to="/settings"
                className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={t('common:aria.settings')}
              >
                <Settings size={20} />
              </Link>
            </div>
          ) : null
        }
      />

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-12 rounded-2xl bg-[#141414] border border-white/10 p-1">
            <TabsTrigger
              value="posts"
              className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 gap-1.5 text-xs sm:text-sm"
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">{t('profile:tabs.posts')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="reposts"
              className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 gap-1.5 text-xs sm:text-sm"
            >
              <Repeat2 size={16} />
              <span className="hidden sm:inline">{t('profile:tabs.reposts')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 gap-1.5 text-xs sm:text-sm"
            >
              <BarChart3 size={16} />
              <span className="hidden sm:inline">{t('profile:tabs.stats')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4 focus-visible:outline-none">
            {isLimited ? (
              <ProfileEmptyState
                icon={LayoutGrid}
                title={t('profile:postsPrivate')}
                description={t('profile:postsPrivateHint')}
              />
            ) : canShowPosts ? (
              <PostFeed
                profileUser={profileUser}
                viewer={user}
                mode="posts"
                emptyIcon={LayoutGrid}
                emptyTitle={t('profile:postsEmptyOwn')}
                emptyDescription={
                  isOwn
                    ? t('profile:postsEmptyOwnHint')
                    : t('profile:postsEmptyOther')
                }
              />
            ) : (
              <ProfileEmptyState
                icon={LayoutGrid}
                title={t('profile:postsHidden')}
                description={t('profile:postsHiddenHint')}
              />
            )}
          </TabsContent>

          <TabsContent value="reposts" className="mt-4 focus-visible:outline-none">
            {isLimited ? (
              <ProfileEmptyState
                icon={Repeat2}
                title={t('profile:repostsPrivate')}
                description={t('profile:repostsPrivateHint')}
              />
            ) : canShowPosts ? (
              <PostFeed
                profileUser={profileUser}
                viewer={user}
                mode="reposts"
                emptyIcon={Repeat2}
                emptyTitle={t('profile:repostsEmptyOwn')}
                emptyDescription={
                  isOwn
                    ? t('profile:repostsEmptyOwnHint')
                    : t('profile:repostsEmptyOther')
                }
              />
            ) : (
              <ProfileEmptyState
                icon={Repeat2}
                title={t('profile:repostsHidden')}
                description={t('profile:repostsHiddenHint')}
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
          <Button
            onClick={handleLogout}
            variant="outline"
            data-testid="logout-btn"
            className="w-full h-12 rounded-xl bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
          >
            <LogOut size={18} className="mr-2" /> {t('common:actions.logout')}
          </Button>
        ) : null}
      </div>

      {isOwn ? (
        <>
          <ProfileEditDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            user={user}
            badges={badges}
            onSave={handleSaveProfile}
            onAvatarFileSelected={handleAvatarFileSelected}
            avatarUploading={avatarUploading}
            suppressCloseAutoFocus={reopenProfileAfterCrop}
          />
          <AvatarCropDialog
            open={cropOpen}
            imageSrc={cropSrc}
            originalFile={pendingAvatarFile}
            onOpenChange={(open) => {
              if (avatarUploading) return;
              setCropOpen(open);
              if (!open) {
                resetAvatarCropState();
                setEditOpen(true);
              }
            }}
            onConfirm={handleCropConfirm}
            confirming={avatarUploading}
          />
        </>
      ) : null}
    </div>
  );
}
