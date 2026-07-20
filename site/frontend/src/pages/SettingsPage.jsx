import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { badgesApi, partnerApi, uploadsApi } from '../lib/api';
import { applyAccentToDocument, normalizeAccentColor, resolveUserAccent, getAccentForUser } from '../lib/userAccent';
import { blobToDataUrl, revokePreviewUrl } from '../lib/imageCompress';
import { AnnualHeatmap } from '../components/agenda/AnnualHeatmap';
import { PartnerSettingsSection } from '../components/settings/PartnerSettingsSection';
import { PushNotificationsCard } from '../components/settings/PushNotificationsCard';
import { NotificationPrefsSection } from '../components/settings/NotificationPrefsSection';
import { ProfileEditDialog } from '../components/profile/ProfileEditDialog';
import { AvatarCropDialog } from '../components/profile/AvatarCropDialog';
import { BadgeArtwork } from '../components/badges/BadgeArtwork';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import {
  Settings,
  User,
  Shield,
  BarChart3,
  Trophy,
  History,
  Palette,
  Volume2,
  Music,
  Heart,
  Check,
  ChevronRight,
  Loader2,
  Lock,
  ChevronDown,
  FileText,
  Activity,
  Award,
  Bell,
  Play,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';

const ACCENT_PRESETS = [
  { value: '', label: 'Thème par défaut' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#10B981', label: 'Vert' },
  { value: '#D946EF', label: 'Rose' },
  { value: '#F59E0B', label: 'Ambre' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#EF4444', label: 'Rouge' },
];

const SECTION_IDS = {
  profile: 'profile',
  partner: 'partner',
  notifications: 'notifications',
  appearance: 'appearance',
  player: 'player',
  badges: 'badges',
  agenda: 'agenda',
  account: 'account',
};

function SettingsLinkRow({ to, icon: Icon, label, description, onClick }) {
  const className =
    'flex items-center gap-3 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10 w-full text-left';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <Icon size={18} className="text-zinc-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium">{label}</p>
          {description ? <p className="text-zinc-500 text-xs truncate">{description}</p> : null}
        </div>
        <ChevronRight size={16} className="text-zinc-500 shrink-0" />
      </button>
    );
  }
  return (
    <Link to={to} className={className}>
      <Icon size={18} className="text-zinc-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium">{label}</p>
        {description ? <p className="text-zinc-500 text-xs truncate">{description}</p> : null}
      </div>
      <ChevronRight size={16} className="text-zinc-500 shrink-0" />
    </Link>
  );
}

function PrivacyStatus({ children, locked = false }) {
  return (
    <span className={`text-xs ${locked ? 'text-zinc-500 flex items-center gap-1' : 'text-zinc-400'}`}>
      {locked ? <Lock size={12} /> : null}
      {children}
    </span>
  );
}

function PrivacySelectRow({ icon: Icon, label, value, onChange, options, locked, lockedLabel }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={16} className="text-zinc-500 shrink-0" />
        <span className="text-white text-sm">{label}</span>
      </div>
      {locked ? (
        <PrivacyStatus locked>{lockedLabel || 'Visible'}</PrivacyStatus>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-40 h-9 rounded-lg bg-[#0A0A0A] border-white/10 text-white text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#141414] border-white/10">
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-white">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function relativeLuminance(hex) {
  const normalized = normalizeAccentColor(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const toLin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastOnAccent(hex) {
  const L = relativeLuminance(hex);
  if (L == null) return { text: '#ffffff', label: '—' };
  const contrastWhite = (1.05) / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  if (contrastWhite >= contrastBlack) {
    return { text: '#ffffff', label: `${contrastWhite.toFixed(1)}:1` };
  }
  return { text: '#0A0A0A', label: `${contrastBlack.toFixed(1)}:1` };
}

function SectionIcon({ icon: Icon }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 mr-3">
      <Icon size={16} className="text-[var(--theme-primary)]" />
    </div>
  );
}

export function SettingsPage() {
  const { user, updateProfile, logout, patchUser, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [openSection, setOpenSection] = useState(SECTION_IDS.profile);
  const [ttsEnabled, setTtsEnabled] = useState(user?.tts_enabled !== false);
  const [musicMode, setMusicMode] = useState(!!user?.music_mode);
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState(user?.spotify_playlist_url || '');
  const [accentColor, setAccentColor] = useState(user?.accent_color || '');
  const [accountVisibility, setAccountVisibility] = useState(user?.account_visibility || 'private');
  const [statsVisibility, setStatsVisibility] = useState(user?.stats_visibility || (user?.show_stats ? 'public' : 'me'));
  const [activityVisibility, setActivityVisibility] = useState(user?.activity_visibility || (user?.show_recent_activity ? 'public' : 'me'));
  const [privacyAdvancedOpen, setPrivacyAdvancedOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [badges, setBadges] = useState([]);
  const [badgeSummary, setBadgeSummary] = useState(null);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [partnerAccent, setPartnerAccent] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [reopenProfileAfterCrop, setReopenProfileAfterCrop] = useState(false);
  const [agendaEverOpened, setAgendaEverOpened] = useState(false);

  useEffect(() => {
    if (!user) return;
    setTtsEnabled(user.tts_enabled !== false);
    setMusicMode(!!user.music_mode);
    setSpotifyPlaylistUrl(user.spotify_playlist_url || '');
    setAccentColor(user.accent_color || '');
    setAccountVisibility(user.account_visibility || 'private');
    setStatsVisibility(user.stats_visibility || (user.show_stats ? 'public' : 'me'));
    setActivityVisibility(user.activity_visibility || (user.show_recent_activity ? 'public' : 'me'));
  }, [user]);

  useEffect(() => {
    if (accountVisibility === 'private') {
      if (statsVisibility === 'public') setStatsVisibility('followers');
      if (activityVisibility === 'public') setActivityVisibility('followers');
    }
  }, [accountVisibility, statsVisibility, activityVisibility]);

  useEffect(() => {
    if (window.location.hash === '#partner-settings') {
      setOpenSection(SECTION_IDS.partner);
      const el = document.getElementById('partner-settings');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (openSection === SECTION_IDS.agenda) {
      setAgendaEverOpened(true);
    }
  }, [openSection]);

  useEffect(() => {
    badgesApi
      .getMyBadges()
      .then((res) => {
        setBadges(res.data?.badges || []);
        setBadgeSummary(res.data?.summary || null);
      })
      .catch(() => {
        setBadges([]);
        setBadgeSummary(null);
      })
      .finally(() => setBadgesLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.partner_id) {
      setPartnerAccent(null);
      return;
    }
    partnerApi
      .getInfo()
      .then((res) => {
        const partner = res.data;
        setPartnerAccent(
          partner?.accent_color
            ? getAccentForUser({ accent_color: partner.accent_color }, theme)
            : null
        );
      })
      .catch(() => setPartnerAccent(null));
  }, [user?.partner_id, theme]);

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

  const setAccentPreview = (color) => {
    const normalized = normalizeAccentColor(color) || '';
    setAccentColor(normalized);
    applyAccentToDocument(resolveUserAccent({ accent_color: normalized || null }, theme));
  };

  const handleSaveAppearance = async () => {
    setSavingPrefs(true);
    const normalizedAccent = normalizeAccentColor(accentColor);
    const result = await updateProfile({
      theme,
      accent_color: normalizedAccent || null,
    });
    setSavingPrefs(false);
    if (result.success) {
      const saved = result.user || user;
      applyAccentToDocument(resolveUserAccent(saved, theme));
      if (normalizedAccent) setAccentColor(normalizedAccent);
      toast.success('Apparence enregistrée');
    } else {
      toast.error(result.error);
    }
  };

  const handleSavePlayer = async () => {
    setSavingPlayer(true);
    const result = await updateProfile({
      tts_enabled: ttsEnabled,
      music_mode: musicMode,
      spotify_playlist_url: spotifyPlaylistUrl.trim() || null,
    });
    setSavingPlayer(false);
    if (result.success) {
      toast.success('Préférences player enregistrées');
    } else {
      toast.error(result.error);
    }
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    const payload = {
      account_visibility: accountVisibility,
      show_sessions: true,
      show_posts: true,
      show_badges: true,
    };
    if (accountVisibility === 'public') {
      payload.posts_visibility = 'public';
      payload.badges_visibility = 'public';
      payload.stats_visibility = statsVisibility;
      payload.activity_visibility = activityVisibility;
    } else {
      payload.posts_visibility = 'followers';
      payload.badges_visibility = 'followers';
      payload.stats_visibility = statsVisibility;
      payload.activity_visibility = activityVisibility;
    }
    const result = await updateProfile(payload);
    setSavingPrivacy(false);
    if (result.success) {
      toast.success('Confidentialité mise à jour');
    } else {
      toast.error(result.error);
    }
  };

  const handleSaveProfile = async (data) => {
    const result = await updateProfile(data);
    return result;
  };

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
      const { data } = await uploadsApi.uploadImage(dataUrl, uploadName);
      const newAvatarUrl = data.url || data.path;
      if (!newAvatarUrl) throw new Error('Réponse upload invalide');
      const now = new Date().toISOString();
      patchUser({ avatar_url: newAvatarUrl, updated_at: now });
      const saveResult = await updateProfile({ avatar_url: newAvatarUrl });
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Échec de la sauvegarde du profil');
      }
      await refreshUser();
      toast.success('Photo importée');
      setCropOpen(false);
      resetAvatarCropState();
      setOpenSection(SECTION_IDS.profile);
      setEditOpen(true);
    } catch (error) {
      patchUser({ avatar_url: previousAvatarUrl });
      toast.error(error.message || "Échec de l'import photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleEditClose = useCallback((open) => {
    setEditOpen(open);
    if (!open) {
      setOpenSection(SECTION_IDS.profile);
    }
  }, []);

  const isPublicAccount = accountVisibility === 'public';
  const configurableOptions = isPublicAccount
    ? [
        { value: 'public', label: 'Public' },
        { value: 'followers', label: 'Abonnés uniquement' },
        { value: 'me', label: 'Moi uniquement' },
      ]
    : [
        { value: 'followers', label: 'Abonnés acceptés' },
        { value: 'me', label: 'Moi uniquement' },
      ];

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const unlockedCount = badgeSummary?.unlocked ?? unlockedBadges.length;
  const totalBadges = badgeSummary?.total ?? (badges.length || 50);
  const recentBadges = [...unlockedBadges]
    .sort((a, b) => {
      const da = a.unlocked_at || a.unlockedAt || '';
      const db = b.unlocked_at || b.unlockedAt || '';
      return String(db).localeCompare(String(da));
    })
    .slice(0, 3);

  const previewAccent = accentColor || getAccentForUser(user, theme) || '#06B6D4';
  const contrast = contrastOnAccent(previewAccent);

  const triggerClass =
    "px-4 hover:no-underline text-white font-['Outfit'] text-base font-semibold [&[data-state=open]]:text-white";

  return (
    <div data-testid="settings-page" className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <PageHeader
        title="Paramètres"
        subtitle="Personnalisez votre expérience"
        leading={<Settings size={24} className="text-[var(--theme-primary)] shrink-0 mt-0.5" />}
      />

      <Accordion
        type="single"
        collapsible
        value={openSection}
        onValueChange={(v) => setOpenSection(v || '')}
        className="space-y-3"
      >
        <AccordionItem value={SECTION_IDS.profile} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-profile">
            <span className="flex items-center">
              <SectionIcon icon={User} />
              Mon profil
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-zinc-500 text-sm">Photo, pseudo, arobase et bio</p>
            <SettingsLinkRow
              icon={User}
              label="Modifier mon profil"
              description="Nom affiché, arobase, avatar, bio, badges mis en avant"
              onClick={() => setEditOpen(true)}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.partner} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-partner">
            <span className="flex items-center">
              <SectionIcon icon={Heart} />
              Partenaire et Duo
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <PartnerSettingsSection embedded />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.notifications} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-notifications">
            <span className="flex items-center">
              <SectionIcon icon={Bell} />
              Notifications
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-5">
            <PushNotificationsCard />
            <NotificationPrefsSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.appearance} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-appearance">
            <span className="flex items-center">
              <SectionIcon icon={Palette} />
              Apparence
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <Palette className="text-zinc-400" size={20} />
                <span className="text-white">Thème</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('default')}
                  data-testid="theme-default"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    theme === 'default' ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#141414]' : ''
                  }`}
                  style={{ background: 'linear-gradient(135deg, #06B6D4, #10B981)' }}
                >
                  {theme === 'default' && <Check size={14} className="text-white" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('girly')}
                  data-testid="theme-girly"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    theme === 'girly' ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-[#141414]' : ''
                  }`}
                  style={{ background: 'linear-gradient(135deg, #D946EF, #8B5CF6)' }}
                >
                  {theme === 'girly' && <Heart size={14} className="text-white" fill="currentColor" />}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3 space-y-3">
              <p className="text-white text-sm">Couleur perso</p>
              <p className="text-zinc-500 text-xs">Agenda et repères visuels</p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.value || 'default'}
                    type="button"
                    onClick={() => setAccentPreview(preset.value)}
                    className={`w-9 h-9 rounded-full border-2 transition-all ${
                      accentColor === preset.value ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{
                      background: preset.value
                        ? preset.value
                        : 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
                    }}
                    title={preset.label}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={accentColor || '#06B6D4'}
                onChange={(e) => setAccentPreview(e.target.value)}
                className="h-10 w-full rounded-xl cursor-pointer"
              />
            </div>

            <div className="rounded-xl bg-white/5 p-3 space-y-2" data-testid="accent-contrast-preview">
              <p className="text-white text-sm">Aperçu & contraste</p>
              <div
                className="h-14 rounded-xl flex items-center justify-center font-medium text-sm"
                style={{ background: previewAccent, color: contrast.text }}
              >
                FitMatch · {contrast.label}
              </div>
            </div>

            <Button
              onClick={handleSaveAppearance}
              disabled={savingPrefs}
              className="w-full h-11 rounded-xl btn-primary text-white"
            >
              {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer l'apparence"}
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.player} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-player">
            <span className="flex items-center">
              <SectionIcon icon={Play} />
              Player
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <Volume2 className="text-zinc-400" size={20} />
                <span className="text-white">Annonces vocales</span>
              </div>
              <Switch checked={ttsEnabled} onCheckedChange={setTtsEnabled} data-testid="tts-toggle" />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <Music className="text-zinc-400" size={20} />
                <div>
                  <span className="text-white block">Mode musique</span>
                  <span className="text-zinc-500 text-xs">Bips courts, compatible Spotify</span>
                </div>
              </div>
              <Switch checked={musicMode} onCheckedChange={setMusicMode} data-testid="music-mode-toggle" />
            </div>

            <div className="rounded-xl bg-white/5 p-3 space-y-2">
              <Label className="text-zinc-400 text-sm">Lien playlist Spotify (optionnel)</Label>
              <Input
                value={spotifyPlaylistUrl}
                onChange={(e) => setSpotifyPlaylistUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
                className="h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white text-sm"
              />
            </div>

            <Button
              onClick={handleSavePlayer}
              disabled={savingPlayer}
              className="w-full h-11 rounded-xl btn-primary text-white"
            >
              {savingPlayer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer le player'}
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.badges} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-badges">
            <span className="flex items-center">
              <SectionIcon icon={Trophy} />
              Badges
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            {badgesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--theme-primary)]" />
              </div>
            ) : (
              <>
                <p className="text-white text-sm">
                  {unlockedCount} sur {totalBadges} débloqués
                </p>
                {recentBadges.length > 0 ? (
                  <div className="flex gap-3 justify-center sm:justify-start">
                    {recentBadges.map((badge) => (
                      <div
                        key={badge.id}
                        className="min-w-0 w-16 overflow-hidden text-center"
                        title={badge.name}
                      >
                        <BadgeArtwork
                          rarity={badge.rarity_key || badge.rarity}
                          iconKey={badge.icon_key || badge.icon || 'trophy'}
                          locked={false}
                          size={40}
                          className="mx-auto shrink-0 size-10"
                        />
                        <p className="mt-1 min-w-0 line-clamp-2 break-words text-[10px] text-zinc-400">
                          {badge.name}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm">
                    Aucun badge pour l&apos;instant — entraîne-toi pour en débloquer !
                  </p>
                )}
                <SettingsLinkRow
                  to="/badges?scope=solo"
                  icon={Trophy}
                  label="Voir tous les badges"
                  description="Catalogue Solo complet"
                />
                {user?.partner_id ? (
                  <SettingsLinkRow
                    to="/badges?scope=duo"
                    icon={Heart}
                    label="Badges Duo"
                    description="Succès à deux"
                  />
                ) : null}
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.agenda} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-agenda">
            <span className="flex items-center">
              <SectionIcon icon={BarChart3} />
              Agenda annuel
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {agendaEverOpened || openSection === SECTION_IDS.agenda ? (
              <AnnualHeatmap
                year={new Date().getFullYear()}
                accentColor={getAccentForUser(user, theme)}
                partnerColor={partnerAccent}
                title=""
              />
            ) : (
              <p className="text-zinc-500 text-sm">Ouvrez cette section pour charger l&apos;agenda.</p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.account} className="card border-0 rounded-2xl overflow-hidden px-0" data-testid="privacy-settings">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-account">
            <span className="flex items-center">
              <SectionIcon icon={Shield} />
              Compte
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-white text-sm font-medium">Confidentialité</p>
                <p className="text-zinc-500 text-xs mt-0.5">Gérer la visibilité</p>
              </div>
              <Select value={accountVisibility} onValueChange={setAccountVisibility}>
                <SelectTrigger
                  data-testid="account-visibility-select"
                  className="w-40 h-9 rounded-lg bg-[#0A0A0A] border-white/10 text-white text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  <SelectItem value="public" className="text-white">Compte public</SelectItem>
                  <SelectItem value="private" className="text-white">Compte privé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={() => setPrivacyAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl bg-white/5 p-3 text-left"
              data-testid="privacy-advanced-toggle"
            >
              <span className="text-white text-sm">Détails de visibilité</span>
              <ChevronDown
                size={16}
                className={`text-zinc-500 transition-transform ${privacyAdvancedOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {privacyAdvancedOpen ? (
              <div className="space-y-2">
                <PrivacySelectRow
                  icon={FileText}
                  label="Publications"
                  locked
                  lockedLabel={isPublicAccount ? 'Visible' : 'Abonnés acceptés'}
                />
                <PrivacySelectRow
                  icon={History}
                  label="Historique des séances"
                  locked
                  lockedLabel={isPublicAccount ? 'Visible' : 'Abonnés acceptés'}
                />
                <PrivacySelectRow
                  icon={Award}
                  label="Badges"
                  locked
                  lockedLabel={isPublicAccount ? 'Visible' : 'Abonnés acceptés'}
                />
                <PrivacySelectRow
                  icon={BarChart3}
                  label="Statistiques"
                  value={statsVisibility}
                  onChange={setStatsVisibility}
                  options={configurableOptions}
                />
                <PrivacySelectRow
                  icon={Activity}
                  label="Activité"
                  value={activityVisibility}
                  onChange={setActivityVisibility}
                  options={configurableOptions}
                />
              </div>
            ) : null}

            <Button
              onClick={handleSavePrivacy}
              disabled={savingPrivacy}
              className="w-full h-11 rounded-xl btn-primary text-white"
            >
              {savingPrivacy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer la confidentialité'}
            </Button>

            <SettingsLinkRow
              to="/duo?tab=history"
              icon={History}
              label="Voir l'historique complet"
              description="Toutes tes séances passées"
            />

            <Button
              onClick={handleLogout}
              variant="outline"
              data-testid="settings-logout-btn"
              className="w-full h-12 rounded-xl bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              <LogOut size={18} className="mr-2" /> Se déconnecter
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <ProfileEditDialog
        open={editOpen}
        onOpenChange={handleEditClose}
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
            setOpenSection(SECTION_IDS.profile);
            setEditOpen(true);
          }
        }}
        onConfirm={handleCropConfirm}
        confirming={avatarUploading}
      />
    </div>
  );
}
