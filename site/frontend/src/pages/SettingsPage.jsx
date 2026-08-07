import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { badgesApi, partnerApi, uploadsApi } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { setAppLocale } from '../i18n';
import i18n from '../i18n';
import { readStoredLocale, readStoredTimeFormat, writeStoredTimeFormat } from '../i18n/storage';
import { applyAccentToDocument, normalizeAccentColor, resolveUserAccent, getAccentForUser } from '../lib/userAccent';
import { blobToDataUrl, revokePreviewUrl } from '../lib/imageCompress';
import { AnnualHeatmap } from '../components/agenda/AnnualHeatmap';
import { PartnerSettingsSection } from '../components/settings/PartnerSettingsSection';
import { PushNotificationsCard } from '../components/settings/PushNotificationsCard';
import { NotificationPrefsSection } from '../components/settings/NotificationPrefsSection';
import { ProfileEditDialog } from '../components/profile/ProfileEditDialog';
import { AvatarCropDialog } from '../components/profile/AvatarCropDialog';
import { BadgeArtwork } from '../components/badges/BadgeArtwork';
import { getBadgeDisplayName } from '../lib/featuredBadges';
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
  Globe,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';

const ACCENT_PRESETS = [
  { value: '', labelKey: 'appearance.defaultTheme' },
  { value: '#06B6D4', labelKey: 'appearance.presets.cyan' },
  { value: '#10B981', labelKey: 'appearance.presets.green' },
  { value: '#D946EF', labelKey: 'appearance.presets.pink' },
  { value: '#F59E0B', labelKey: 'appearance.presets.amber' },
  { value: '#6366F1', labelKey: 'appearance.presets.indigo' },
  { value: '#EF4444', labelKey: 'appearance.presets.red' },
];

const SECTION_IDS = {
  profile: 'profile',
  partner: 'partner',
  notifications: 'notifications',
  appearance: 'appearance',
  player: 'player',
  badges: 'badges',
  agenda: 'agenda',
  locale: 'locale',
  account: 'account',
};

function SettingsLinkRow({ to, icon: Icon, label, description, onClick }) {
  const className =
    'flex items-center gap-3 rounded-xl bg-hover p-3 transition-colors hover:bg-active w-full text-left';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <Icon size={18} className="text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-medium">{label}</p>
          {description ? <p className="text-subtle text-xs truncate">{description}</p> : null}
        </div>
        <ChevronRight size={16} className="text-subtle shrink-0" />
      </button>
    );
  }
  return (
    <Link to={to} className={className}>
      <Icon size={18} className="text-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium">{label}</p>
        {description ? <p className="text-subtle text-xs truncate">{description}</p> : null}
      </div>
      <ChevronRight size={16} className="text-subtle shrink-0" />
    </Link>
  );
}

function PrivacyStatus({ children, locked = false }) {
  return (
    <span className={`text-xs ${locked ? 'text-subtle flex items-center gap-1' : 'text-muted'}`}>
      {locked ? <Lock size={12} /> : null}
      {children}
    </span>
  );
}

function PrivacySelectRow({ icon: Icon, label, value, onChange, options, locked, lockedLabel }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-hover p-3 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={16} className="text-subtle shrink-0" />
        <span className="text-foreground text-sm">{label}</span>
      </div>
      {locked ? (
        <PrivacyStatus locked>{lockedLabel || 'Visible'}</PrivacyStatus>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-40 h-9 rounded-lg bg-background border-border text-foreground text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-elevated border-border">
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-foreground">
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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-hover mr-3">
      <Icon size={16} className="text-[var(--theme-primary)]" />
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation(['settings', 'common', 'badges']);
  const { user, updateProfile, logout, patchUser, refreshUser } = useAuth();
  const { colorMode, setColorMode, theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [openSection, setOpenSection] = useState(SECTION_IDS.profile);
  const [partnerPanel, setPartnerPanel] = useState(null);
  const [highlightRequestId, setHighlightRequestId] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(user?.tts_enabled !== false);
  const [musicMode, setMusicMode] = useState(!!user?.music_mode);
  const [accentColor, setAccentColor] = useState(user?.accent_color || '');
  const [accountVisibility, setAccountVisibility] = useState(user?.account_visibility || 'private');
  const [statsVisibility, setStatsVisibility] = useState(user?.stats_visibility || (user?.show_stats ? 'public' : 'me'));
  const [activityVisibility, setActivityVisibility] = useState(user?.activity_visibility || (user?.show_recent_activity ? 'public' : 'me'));
  const [privacyAdvancedOpen, setPrivacyAdvancedOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [playerDirty, setPlayerDirty] = useState(false);
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
  const [locale, setLocale] = useState(() => user?.locale || readStoredLocale() || 'fr-FR');
  const [timeFormat, setTimeFormat] = useState(() => user?.time_format || readStoredTimeFormat());
  const [savingLocale, setSavingLocale] = useState(false);

  useEffect(() => {
    if (!user || playerDirty) return;
    setTtsEnabled(user.tts_enabled !== false);
    setMusicMode(!!user.music_mode);
    setAccentColor(user.accent_color || '');
    setAccountVisibility(user.account_visibility || 'private');
    setStatsVisibility(user.stats_visibility || (user.show_stats ? 'public' : 'me'));
    setActivityVisibility(user.activity_visibility || (user.show_recent_activity ? 'public' : 'me'));
    setLocale(user.locale || readStoredLocale() || 'fr-FR');
    setTimeFormat(user.time_format || readStoredTimeFormat());
  }, [user, playerDirty]);

  const persistLocalePrefs = async (nextLocale, nextTimeFormat) => {
    setSavingLocale(true);
    try {
      await setAppLocale(nextLocale);
      writeStoredTimeFormat(nextTimeFormat);
      setLocale(nextLocale);
      setTimeFormat(nextTimeFormat);

      const result = await updateProfile({
        locale: nextLocale,
        time_format: nextTimeFormat,
      });
      if (result?.success) {
        toast.success(i18n.t('settings:languageRegion.saveSuccess', { lng: nextLocale }));
      } else {
        toast.error(result?.error || i18n.t('settings:languageRegion.saveError', { lng: nextLocale }));
      }
    } catch (e) {
      toast.error(i18n.t('settings:languageRegion.saveError', { lng: nextLocale }));
    } finally {
      setSavingLocale(false);
    }
  };

  useEffect(() => {
    if (accountVisibility === 'private') {
      if (statsVisibility === 'public') setStatsVisibility('followers');
      if (activityVisibility === 'public') setActivityVisibility('followers');
    }
  }, [accountVisibility, statsVisibility, activityVisibility]);

  useEffect(() => {
    const section = searchParams.get('section');
    const panel = searchParams.get('panel');
    const requestId = searchParams.get('request');
    const hashPartner = window.location.hash === '#partner-settings';
    const openPartner =
      hashPartner ||
      section === 'partner-duo' ||
      section === 'partner' ||
      section === SECTION_IDS.partner;

    if (openPartner) {
      setOpenSection(SECTION_IDS.partner);
      if (panel) setPartnerPanel(panel);
      if (requestId) setHighlightRequestId(requestId);
      const el = document.getElementById('partner-settings');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

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
      appearance: colorMode,
      accent_color: normalizedAccent || null,
    });
    setSavingPrefs(false);
    if (result.success) {
      const saved = result.user || user;
      applyAccentToDocument(resolveUserAccent(saved, theme));
      if (normalizedAccent) setAccentColor(normalizedAccent);
      toast.success(t('appearance.saved'));
    } else {
      toast.error(result.error);
    }
  };

  const handleSavePlayer = async () => {
    setSavingPlayer(true);
    const result = await updateProfile({
      tts_enabled: ttsEnabled,
      music_mode: musicMode,
    });
    setSavingPlayer(false);
    if (result.success) {
      setPlayerDirty(false);
      toast.success(t('player.saved'));
    } else {
      setTtsEnabled(user?.tts_enabled !== false);
      setMusicMode(!!user?.music_mode);
      setPlayerDirty(false);
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
      toast.success(t('privacy.saved'));
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
      toast.success(t('profile:photoImported'));
      setCropOpen(false);
      resetAvatarCropState();
      setOpenSection(SECTION_IDS.profile);
      setEditOpen(true);
    } catch (error) {
      patchUser({ avatar_url: previousAvatarUrl });
      toast.error(error.message || t('profile:photoImportFailed'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
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
        { value: 'public', label: t('privacy.public') },
        { value: 'followers', label: t('privacy.followersOnly') },
        { value: 'me', label: t('privacy.meOnly') },
      ]
    : [
        { value: 'followers', label: t('privacy.followersAccepted') },
        { value: 'me', label: t('privacy.meOnly') },
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
    "px-4 hover:no-underline text-foreground font-['Outfit'] text-base font-semibold [&[data-state=open]]:text-foreground";

  return (
    <div data-testid="settings-page" className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
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
              {t('sections.profile')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-subtle text-sm">{t('sections.profileHint')}</p>
            <SettingsLinkRow
              icon={User}
              label={t('sections.editProfile')}
              description={t('sections.editProfileHint')}
              onClick={() => setEditOpen(true)}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.partner} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-partner">
            <span className="flex items-center">
              <SectionIcon icon={Heart} />
              {t('sections.partner')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <PartnerSettingsSection
              embedded
              panel={partnerPanel}
              highlightRequestId={highlightRequestId}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.appearance} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-appearance">
            <span className="flex items-center">
              <SectionIcon icon={Palette} />
              {t('sections.appearance')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <div className="rounded-xl bg-hover p-3 space-y-3">
              <p className="text-foreground text-sm">{t('appearance.theme')}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setColorMode('dark')}
                  data-testid="theme-dark"
                  className={`relative rounded-xl border-2 p-2 text-left transition-all ${
                    colorMode === 'dark'
                      ? 'border-[var(--theme-primary)]'
                      : 'border-border'
                  }`}
                >
                  <div
                    data-theme="dark"
                    className="rounded-lg overflow-hidden border border-border bg-background p-2 space-y-1.5"
                  >
                    <div className="h-2 w-1/2 rounded bg-surface-elevated" />
                    <div className="h-8 rounded-md bg-surface border border-border" />
                    <div className="flex gap-1">
                      <div className="h-2 flex-1 rounded bg-surface-subtle" />
                      <div className="h-2 flex-1 rounded bg-surface-subtle" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-medium">{t('appearance.dark')}</p>
                      <p className="text-subtle text-xs">{t('appearance.darkHint')}</p>
                    </div>
                    {colorMode === 'dark' ? (
                      <Check size={16} className="text-[var(--theme-primary)] shrink-0" />
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode('light')}
                  data-testid="theme-light"
                  className={`relative rounded-xl border-2 p-2 text-left transition-all ${
                    colorMode === 'light'
                      ? 'border-[var(--theme-primary)]'
                      : 'border-border'
                  }`}
                >
                  <div
                    data-theme="light"
                    className="rounded-lg overflow-hidden border border-border bg-background p-2 space-y-1.5"
                  >
                    <div className="h-2 w-1/2 rounded bg-surface-elevated" />
                    <div className="h-8 rounded-md bg-surface border border-border" />
                    <div className="flex gap-1">
                      <div className="h-2 flex-1 rounded bg-surface-subtle" />
                      <div className="h-2 flex-1 rounded bg-surface-subtle" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-medium">{t('appearance.light')}</p>
                      <p className="text-subtle text-xs">{t('appearance.lightHint')}</p>
                    </div>
                    {colorMode === 'light' ? (
                      <Check size={16} className="text-[var(--theme-primary)] shrink-0" />
                    ) : null}
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-hover p-3 space-y-3">
              <p className="text-foreground text-sm">{t('appearance.accent')}</p>
              <p className="text-subtle text-xs">{t('appearance.accentHint')}</p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.value || 'default'}
                    type="button"
                    onClick={() => setAccentPreview(preset.value)}
                    className={`w-9 h-9 rounded-full border-2 transition-all ${
                      accentColor === preset.value
                        ? 'border-foreground scale-110'
                        : 'border-transparent'
                    }`}
                    style={{
                      background: preset.value
                        ? preset.value
                        : 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
                    }}
                    title={t(preset.labelKey)}
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

            <div className="rounded-xl bg-hover p-3 space-y-2" data-testid="accent-contrast-preview">
              <p className="text-foreground text-sm">{t('appearance.preview')}</p>
              <div
                className="h-14 rounded-xl flex items-center justify-center font-medium text-sm"
                style={{ background: previewAccent, color: contrast.text }}
              >
                {t('common:app.brand')} · {contrast.label}
              </div>
            </div>

            <Button
              onClick={handleSaveAppearance}
              disabled={savingPrefs}
              className="w-full h-11 rounded-xl btn-primary text-foreground"
            >
              {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : t('appearance.save')}
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.badges} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-badges">
            <span className="flex items-center">
              <SectionIcon icon={Trophy} />
              {t('sections.badges')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            {badgesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--theme-primary)]" />
              </div>
            ) : (
              <>
                <p className="text-foreground text-sm">
                  {t('badges.unlockedOf', { count: unlockedCount, total: totalBadges })}
                </p>
                {recentBadges.length > 0 ? (
                  <div className="flex gap-3 justify-center sm:justify-start">
                    {recentBadges.map((badge) => {
                      const badgeName = getBadgeDisplayName(badge, (key, opts) => t(key, { ...opts, ns: 'badges' }));
                      return (
                      <div
                        key={badge.id}
                        className="min-w-0 w-16 overflow-hidden text-center"
                        title={badgeName}
                      >
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
                ) : (
                  <p className="text-subtle text-sm">
                    {t('badges.empty')}
                  </p>
                )}
                <SettingsLinkRow
                  to="/badges?scope=solo"
                  icon={Trophy}
                  label={t('badges.seeAll')}
                  description={t('badges.soloCatalog')}
                />
                {user?.partner_id ? (
                  <SettingsLinkRow
                    to="/badges?scope=duo"
                    icon={Heart}
                    label={t('badges.duoBadges')}
                    description={t('badges.duoHint')}
                  />
                ) : null}
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.notifications} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-notifications">
            <span className="flex items-center">
              <SectionIcon icon={Bell} />
              {t('sections.notifications')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-5">
            <PushNotificationsCard />
            <NotificationPrefsSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.player} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-player">
            <span className="flex items-center">
              <SectionIcon icon={Play} />
              {t('sections.player')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-hover p-3">
              <div className="flex items-center gap-3">
                <Volume2 className="text-muted" size={20} />
                <span className="text-foreground">{t('player.tts')}</span>
              </div>
              <Switch
                checked={ttsEnabled}
                onCheckedChange={(checked) => {
                  setTtsEnabled(checked);
                  setPlayerDirty(true);
                }}
                data-testid="tts-toggle"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-hover p-3">
              <div className="flex items-center gap-3">
                <Music className="text-muted" size={20} />
                <div>
                  <span className="text-foreground block">{t('player.musicMode')}</span>
                  <span className="text-subtle text-xs">{t('player.musicModeHint')}</span>
                </div>
              </div>
              <Switch
                checked={musicMode}
                onCheckedChange={(checked) => {
                  setMusicMode(checked);
                  setPlayerDirty(true);
                }}
                data-testid="music-mode-toggle"
              />
            </div>

            <Button
              onClick={handleSavePlayer}
              disabled={savingPlayer || !playerDirty}
              className="w-full h-11 rounded-xl btn-primary text-foreground"
            >
              {savingPlayer ? <Loader2 className="w-4 h-4 animate-spin" /> : t('player.save')}
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.locale} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-locale">
            <span className="flex items-center">
              <SectionIcon icon={Globe} />
              {t('languageRegion.title')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-hover p-3 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Globe size={16} className="text-subtle shrink-0" />
                <span className="text-foreground text-sm">{t('languageRegion.language.label')}</span>
              </div>
              <Select
                value={locale}
                onValueChange={(v) => {
                  const next = v || 'fr-FR';
                  persistLocalePrefs(next, timeFormat);
                }}
                disabled={savingLocale}
              >
                <SelectTrigger className="w-40 h-9 rounded-lg bg-background border-border text-foreground text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  <SelectItem value="fr-FR" className="text-foreground">{t('languageRegion.language.fr-FR')}</SelectItem>
                  <SelectItem value="en-US" className="text-foreground">{t('languageRegion.language.en-US')}</SelectItem>
                  <SelectItem value="es-ES" className="text-foreground">{t('languageRegion.language.es-ES')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-hover p-3 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-foreground text-sm">{t('languageRegion.timeFormat.label')}</span>
              </div>
              <Select
                value={timeFormat}
                onValueChange={(v) => {
                  const next = v || 'auto';
                  writeStoredTimeFormat(next);
                  setTimeFormat(next);
                  persistLocalePrefs(locale, next);
                }}
                disabled={savingLocale}
              >
                <SelectTrigger className="w-40 h-9 rounded-lg bg-background border-border text-foreground text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  <SelectItem value="auto" className="text-foreground">{t('languageRegion.timeFormat.auto')}</SelectItem>
                  <SelectItem value="24h" className="text-foreground">{t('languageRegion.timeFormat.24h')}</SelectItem>
                  <SelectItem value="12h" className="text-foreground">{t('languageRegion.timeFormat.12h')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.agenda} className="card border-0 rounded-2xl overflow-hidden px-0">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-agenda">
            <span className="flex items-center">
              <SectionIcon icon={BarChart3} />
              {t('sections.agenda')}
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
              <p className="text-subtle text-sm">{t('agenda.loadHint')}</p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value={SECTION_IDS.account} className="card border-0 rounded-2xl overflow-hidden px-0" data-testid="privacy-settings">
          <AccordionTrigger className={triggerClass} data-testid="settings-section-account">
            <span className="flex items-center">
              <SectionIcon icon={Shield} />
              {t('sections.account')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-foreground text-sm font-medium">{t('privacy.title')}</p>
                <p className="text-subtle text-xs mt-0.5">{t('privacy.hint')}</p>
              </div>
              <Select value={accountVisibility} onValueChange={setAccountVisibility}>
                <SelectTrigger
                  data-testid="account-visibility-select"
                  className="w-40 h-9 rounded-lg bg-background border-border text-foreground text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  <SelectItem value="public" className="text-foreground">{t('privacy.publicAccount')}</SelectItem>
                  <SelectItem value="private" className="text-foreground">{t('privacy.privateAccount')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={() => setPrivacyAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl bg-hover p-3 text-left"
              data-testid="privacy-advanced-toggle"
            >
              <span className="text-foreground text-sm">{t('privacy.details')}</span>
              <ChevronDown
                size={16}
                className={`text-subtle transition-transform ${privacyAdvancedOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {privacyAdvancedOpen ? (
              <div className="space-y-2">
                <PrivacySelectRow
                  icon={FileText}
                  label={t('privacy.posts')}
                  locked
                  lockedLabel={isPublicAccount ? t('privacy.visible') : t('privacy.followersAccepted')}
                />
                <PrivacySelectRow
                  icon={History}
                  label={t('privacy.sessions')}
                  locked
                  lockedLabel={isPublicAccount ? t('privacy.visible') : t('privacy.followersAccepted')}
                />
                <PrivacySelectRow
                  icon={Award}
                  label={t('privacy.badges')}
                  locked
                  lockedLabel={isPublicAccount ? t('privacy.visible') : t('privacy.followersAccepted')}
                />
                <PrivacySelectRow
                  icon={BarChart3}
                  label={t('privacy.stats')}
                  value={statsVisibility}
                  onChange={setStatsVisibility}
                  options={configurableOptions}
                />
                <PrivacySelectRow
                  icon={Activity}
                  label={t('privacy.activity')}
                  value={activityVisibility}
                  onChange={setActivityVisibility}
                  options={configurableOptions}
                />
              </div>
            ) : null}

            <Button
              onClick={handleSavePrivacy}
              disabled={savingPrivacy}
              className="w-full h-11 rounded-xl btn-primary text-foreground"
            >
              {savingPrivacy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('privacy.save')}
            </Button>

            <SettingsLinkRow
              to="/duo?tab=history"
              icon={History}
              label={t('account.fullHistory')}
              description={t('account.fullHistoryHint')}
            />

            <Button
              onClick={handleLogout}
              variant="outline"
              data-testid="settings-logout-btn"
              className="w-full h-12 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/15 hover:text-red-700 hover:border-red-500/55 focus-visible:ring-red-500/40"
            >
              <LogOut size={18} className="mr-2 text-red-600" /> {t('account.logout')}
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
