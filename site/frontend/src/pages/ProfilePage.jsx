import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { partnerApi, usersApi, duoApi } from '../lib/api';
import { BadgesGrid } from '../components/BadgesGrid';
import { isPushConfigured } from '../lib/env';
import { applyAccentToDocument, THEME_DEFAULTS } from '../lib/userAccent';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  User,
  Settings,
  LogOut,
  UserPlus,
  UserMinus,
  Search,
  Check,
  X,
  Heart,
  Zap,
  Loader2,
  ChevronRight,
  Palette,
  Volume2,
  Bell,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { setupPushNotifications } from '../lib/pushNotifications';

const FITNESS_LEVELS = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
  { value: 'expert', label: 'Expert' },
];

const GOALS = [
  { value: 'lose_weight', label: 'Perdre du poids' },
  { value: 'gain_muscle', label: 'Prendre du muscle' },
  { value: 'stay_fit', label: 'Rester en forme' },
  { value: 'improve_endurance', label: 'Améliorer mon endurance' },
  { value: 'flexibility', label: 'Gagner en souplesse' },
];

export function ProfilePage() {
  const { user, updateProfile, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [fitnessLevel, setFitnessLevel] = useState(user?.fitness_level || 'beginner');
  const [mainGoal, setMainGoal] = useState(user?.main_goal || '');
  const [ttsEnabled, setTtsEnabled] = useState(user?.tts_enabled !== false);
  const [accentColor, setAccentColor] = useState(user?.accent_color || '');
  const [saving, setSaving] = useState(false);
  const [badges, setBadges] = useState([]);
  const [badgesExpanded, setBadgesExpanded] = useState(false);

  const ACCENT_PRESETS = [
    { value: '', label: 'Thème par défaut' },
    { value: '#06B6D4', label: 'Cyan' },
    { value: '#10B981', label: 'Vert' },
    { value: '#D946EF', label: 'Rose' },
    { value: '#F59E0B', label: 'Ambre' },
    { value: '#6366F1', label: 'Indigo' },
    { value: '#EF4444', label: 'Rouge' },
  ];

  // Partner state
  const [partner, setPartner] = useState(null);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [selectedRelationType, setSelectedRelationType] = useState('partner');

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
      setFitnessLevel(user.fitness_level || 'beginner');
      setMainGoal(user.main_goal || '');
      setTtsEnabled(user.tts_enabled !== false);
      setAccentColor(user.accent_color || '');
    }
    loadPartnerData();
    loadBadges();
  }, [user]);

  const loadBadges = async () => {
    try {
      const { data } = await duoApi.getStats();
      setBadges(data?.badges || []);
    } catch {
      setBadges([]);
    }
  };

  const setAccentPreview = (color) => {
    setAccentColor(color);
    applyAccentToDocument(color || THEME_DEFAULTS[theme] || THEME_DEFAULTS.default);
  };

  const loadPartnerData = async () => {
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
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfile({
      display_name: displayName.trim(),
      bio: bio.trim(),
      fitness_level: fitnessLevel,
      main_goal: mainGoal,
      tts_enabled: ttsEnabled,
      theme,
      accent_color: accentColor || null,
    });
    setSaving(false);

    if (result.success) {
      toast.success('Profil mis à jour !');
    } else {
      toast.error(result.error);
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
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await partnerApi.reject(requestId);
      toast.success('Demande refusée');
      loadPartnerData();
    } catch (error) {
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
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div data-testid="profile-page" className="p-5 pb-32 animate-fade-in">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white font-['Outfit']">Profil</h1>
      </header>

      {/* User info card */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--theme-primary)] flex items-center justify-center">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-white text-2xl font-bold">
                {user?.display_name?.[0] || user?.username?.[0] || 'U'}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user?.display_name || user?.username}</h2>
            <p className="text-zinc-500">@{user?.username}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-zinc-400 text-sm">Nom affiché</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
            />
          </div>

          <div>
            <Label className="text-zinc-400 text-sm">Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Quelques mots sur toi..."
              className="mt-2 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-400 text-sm">Niveau</Label>
              <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  {FITNESS_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value} className="text-white">
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400 text-sm">Objectif</Label>
              <Select value={mainGoal} onValueChange={setMainGoal}>
                <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  {GOALS.map((goal) => (
                    <SelectItem key={goal.value} value={goal.value} className="text-white">
                      {goal.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-xl btn-primary text-white font-medium"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Partner section */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white font-['Outfit']">Partenaire</h3>
          {!partner && (
            <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[var(--theme-primary)] text-white"
                >
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
                        onClick={() => handleSendRequest(result.username)}
                        className="w-full p-3 flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center">
                          <span className="text-white font-medium">
                            {result.display_name?.[0] || result.username[0]}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-white font-medium">{result.display_name || result.username}</p>
                          <p className="text-zinc-500 text-sm">@{result.username}</p>
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
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center">
              <span className="text-white font-bold">
                {partner.display_name?.[0] || partner.username?.[0]}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">{partner.display_name || partner.username}</p>
              <p className="text-zinc-500 text-sm">
                {partner.relation_type === 'coach' ? 'Coach' : 
                 partner.relation_type === 'coach_partner' ? 'Coach + Partenaire' : 'Partenaire'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUnlinkPartner}
              className="text-red-400 border-red-400/30 hover:bg-red-400/10"
            >
              <UserMinus size={16} />
            </Button>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">Pas de partenaire lié</p>
        )}

        {/* Pending requests */}
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
                  onClick={() => handleAcceptRequest(request.id)}
                  className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => handleRejectRequest(request.id)}
                  className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sent requests */}
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

      {/* Settings */}
      <div className="card p-5 mb-6 space-y-4">
        <h3 className="text-lg font-semibold text-white font-['Outfit']">Paramètres</h3>

        {/* Theme */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
          <div className="flex items-center gap-3">
            <Palette className="text-zinc-400" size={20} />
            <span className="text-white">Thème</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('default')}
              data-testid="theme-default"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                theme === 'default'
                  ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#141414]'
                  : ''
              }`}
              style={{ background: 'linear-gradient(135deg, #06B6D4, #10B981)' }}
            >
              {theme === 'default' && <Check size={14} className="text-white" />}
            </button>
            <button
              onClick={() => setTheme('girly')}
              data-testid="theme-girly"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                theme === 'girly'
                  ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-[#141414]'
                  : ''
              }`}
              style={{ background: 'linear-gradient(135deg, #D946EF, #8B5CF6)' }}
            >
              {theme === 'girly' && <Heart size={14} className="text-white" fill="currentColor" />}
            </button>
          </div>
        </div>

        {/* Couleur perso */}
        <div className="p-3 bg-white/5 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <Palette className="text-zinc-400" size={20} />
            <span className="text-white">Couleur perso</span>
          </div>
          <p className="text-zinc-500 text-xs">
            Indépendante du thème — utilisée dans l&apos;agenda et les repères visuels.
          </p>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.value || 'default'}
                type="button"
                onClick={() => setAccentPreview(preset.value)}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  accentColor === preset.value
                    ? 'border-white scale-110'
                    : 'border-transparent'
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

        {/* TTS */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
          <div className="flex items-center gap-3">
            <Volume2 className="text-zinc-400" size={20} />
            <span className="text-white">Annonces vocales</span>
          </div>
          <Switch
            checked={ttsEnabled}
            onCheckedChange={setTtsEnabled}
            data-testid="tts-toggle"
          />
        </div>

        {isPushConfigured() ? (
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <Bell className="text-zinc-400" size={20} />
              <div>
                <span className="text-white block">Notifications</span>
                <span className="text-zinc-500 text-xs">Séances, streak, badges</span>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full border-white/15 text-white"
              onClick={async () => {
                const r = await setupPushNotifications();
                if (r.ok) toast.success('Notifications activées');
                else if (r.reason === 'denied') toast.info('Autorise les notifications dans les réglages du navigateur');
                else toast.error('Impossible d\'activer les notifications');
              }}
            >
              Activer
            </Button>
          </div>
        ) : (
          <p className="text-zinc-500 text-xs p-3 rounded-xl bg-white/5 border border-white/5">
            Les notifications push ne sont pas encore activées sur ce serveur.
          </p>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white font-['Outfit'] flex items-center gap-2">
              <Trophy size={18} className="text-[var(--theme-primary)]" />
              Badges
            </h3>
            <span className="text-xs text-zinc-500">
              {badges.filter((b) => b.unlocked).length}/{badges.length}
            </span>
          </div>
          <BadgesGrid
            badges={badgesExpanded ? badges : badges.filter((b) => b.unlocked).slice(0, 6)}
            compact
          />
          <div className="flex gap-2 mt-4">
            {badges.length > 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 rounded-full border-white/15 text-white"
                onClick={() => setBadgesExpanded(!badgesExpanded)}
              >
                {badgesExpanded ? 'Réduire' : 'Voir tous'}
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 rounded-full border-white/15 text-white"
            >
              <Link to="/duo">Duo & détails</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Logout */}
      <Button
        onClick={handleLogout}
        variant="outline"
        data-testid="logout-btn"
        className="w-full h-12 rounded-xl bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
      >
        <LogOut size={18} className="mr-2" /> Se déconnecter
      </Button>
    </div>
  );
}
