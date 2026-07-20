import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { duoApi, partnerApi } from '../lib/api';
import { applyAccentToDocument, normalizeAccentColor, resolveUserAccent, getAccentForUser } from '../lib/userAccent';
import { BadgesGrid } from '../components/BadgesGrid';
import { AnnualHeatmap } from '../components/agenda/AnnualHeatmap';
import { PartnerSettingsSection } from '../components/settings/PartnerSettingsSection';
import { PushNotificationsCard } from '../components/settings/PushNotificationsCard';
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
  Globe,
  ChevronDown,
  FileText,
  Activity,
  Award,
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

function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
          <Icon size={18} className="text-[var(--theme-primary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white font-['Outfit']">{title}</h2>
          {description ? <p className="text-zinc-500 text-sm mt-0.5">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function SettingsLinkRow({ to, icon: Icon, label, description }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
    >
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

export function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  const [ttsEnabled, setTtsEnabled] = useState(user?.tts_enabled !== false);
  const [musicMode, setMusicMode] = useState(!!user?.music_mode);
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState(user?.spotify_playlist_url || '');
  const [accentColor, setAccentColor] = useState(user?.accent_color || '');
  const [accountVisibility, setAccountVisibility] = useState(user?.account_visibility || 'private');
  const [statsVisibility, setStatsVisibility] = useState(user?.stats_visibility || (user?.show_stats ? 'public' : 'me'));
  const [activityVisibility, setActivityVisibility] = useState(user?.activity_visibility || (user?.show_recent_activity ? 'public' : 'me'));
  const [privacyAdvancedOpen, setPrivacyAdvancedOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [badges, setBadges] = useState([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [partnerAccent, setPartnerAccent] = useState(null);

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
      const el = document.getElementById('partner-settings');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    duoApi
      .getStats()
      .then((res) => setBadges(res.data?.badges || []))
      .catch(() => setBadges([]))
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

  const setAccentPreview = (color) => {
    const normalized = normalizeAccentColor(color) || '';
    setAccentColor(normalized);
    applyAccentToDocument(resolveUserAccent({ accent_color: normalized || null }, theme));
  };

  const handleSaveAppPrefs = async () => {
    setSavingPrefs(true);
    const normalizedAccent = normalizeAccentColor(accentColor);
    const result = await updateProfile({
      tts_enabled: ttsEnabled,
      music_mode: musicMode,
      spotify_playlist_url: spotifyPlaylistUrl.trim() || null,
      theme,
      accent_color: normalizedAccent || null,
    });
    setSavingPrefs(false);

    if (result.success) {
      const saved = result.user || user;
      applyAccentToDocument(resolveUserAccent(saved, theme));
      if (normalizedAccent) setAccentColor(normalizedAccent);
      toast.success('Préférences enregistrées');
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

  return (
    <div data-testid="settings-page" className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-[var(--theme-primary)]" />
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Paramètres</h1>
        </div>
        <p className="text-zinc-500 text-sm mt-1">Prépare ton profil pour la V2 sociale</p>
      </header>

      <div className="space-y-6">
        <SettingsSection
          icon={User}
          title="Paramètres du profil"
          description="Photo, pseudo, arobase et bio"
        >
          <SettingsLinkRow
            to="/profile?edit=1"
            icon={User}
            label="Modifier mon profil"
            description="Nom affiché, arobase, avatar, bio, badges mis en avant"
          />
        </SettingsSection>

        <PartnerSettingsSection />

        <section className="card p-5 space-y-4" data-testid="privacy-settings">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
              <Shield size={18} className="text-[var(--theme-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-white font-['Outfit']">Confidentialité</h2>
                  <p className="text-zinc-500 text-sm mt-0.5">Gérer la visibilité</p>
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
            </div>
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
        </section>

        <SettingsSection icon={BarChart3} title="Historique des séances">
          <SettingsLinkRow
            to="/duo?tab=history"
            icon={History}
            label="Voir l'historique complet"
            description="Toutes tes séances passées"
          />
        </SettingsSection>

        <SettingsSection icon={Trophy} title="Badges">
          {badgesLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--theme-primary)]" />
            </div>
          ) : badges.length > 0 ? (
            <>
              <div className="flex w-full justify-center">
                <BadgesGrid badges={badges} showShare />
              </div>
              <p className="text-zinc-500 text-xs">
                Choisis jusqu&apos;à 3 badges mis en avant depuis ton profil.
              </p>
            </>
          ) : (
            <p className="text-zinc-500 text-sm">Aucun badge pour l&apos;instant — entraîne-toi pour en débloquer !</p>
          )}
          <SettingsLinkRow
            to="/duo"
            icon={Trophy}
            label="Duo & détails des badges"
            description="Progression et défis"
          />
        </SettingsSection>

        <SettingsSection icon={Palette} title="Apparence & player">
          <div className="space-y-3">
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

            <PushNotificationsCard />
          </div>

          <Button
            onClick={handleSaveAppPrefs}
            disabled={savingPrefs}
            className="w-full h-11 rounded-xl btn-primary text-white"
          >
            {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer les préférences'}
          </Button>
        </SettingsSection>

        <SettingsSection
          icon={BarChart3}
          title="Agenda annuel"
          description="Visualise toute l'année et exporte en PNG"
        >
          <AnnualHeatmap
            year={new Date().getFullYear()}
            accentColor={getAccentForUser(user, theme)}
            partnerColor={partnerAccent}
          />
        </SettingsSection>
      </div>
    </div>
  );
}
