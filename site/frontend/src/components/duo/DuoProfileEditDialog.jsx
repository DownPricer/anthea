import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { DUO_RELATION_OPTIONS } from '../../lib/duoProfile';
import { duoApi, uploadsApi, formatApiError, resolveMediaUrl } from '../../lib/api';
import { compressImageFile, revokePreviewUrl, blobToDataUrl } from '../../lib/imageCompress';
import { toast } from 'sonner';
import {
  Loader2,
  ImagePlus,
  Shield,
  ChevronDown,
  Lock,
  LayoutGrid,
  Award,
  BarChart3,
  Activity,
  Target,
} from 'lucide-react';

function uploadPathFromResponse(data) {
  if (data?.path) return data.path;
  const url = data?.url;
  if (!url) return null;
  const idx = url.indexOf('/uploads/');
  return idx >= 0 ? url.slice(idx) : url;
}

function resolveDuoVis(duoProfile, field, legacyFlag, defaultVal = 'followers') {
  const raw = duoProfile?.[field];
  if (raw === 'public' || raw === 'followers' || raw === 'members') return raw;
  if (duoProfile?.[legacyFlag] === true) {
    return duoProfile?.account_visibility === 'public' ? 'public' : 'followers';
  }
  if (duoProfile?.[legacyFlag] === false) return 'members';
  return defaultVal;
}

function PrivacyRow({ icon: Icon, label, locked, lockedLabel, value, onChange, options }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={16} className="text-zinc-500 shrink-0" />
        <span className="text-sm text-zinc-300">{label}</span>
      </div>
      {locked ? (
        <span className="text-xs text-zinc-500 flex items-center gap-1 shrink-0">
          <Lock size={12} />
          {lockedLabel}
        </span>
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

export function DuoProfileEditDialog({ open, onOpenChange, duoProfile, onSaved }) {
  const [name, setName] = useState('');
  const [relationType, setRelationType] = useState('partners');
  const [visibility, setVisibility] = useState('private');
  const [wallVisibility, setWallVisibility] = useState('followers');
  const [badgesVisibility, setBadgesVisibility] = useState('public');
  const [statsVisibility, setStatsVisibility] = useState('followers');
  const [activityVisibility, setActivityVisibility] = useState('followers');
  const [challengesVisibility, setChallengesVisibility] = useState('followers');
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerPreview, setBannerPreview] = useState(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const bannerInputRef = useRef(null);

  const isPublicDuo = visibility === 'public';

  const configurableOptions = isPublicDuo
    ? [
        { value: 'public', label: 'Public' },
        { value: 'followers', label: 'Abonnés du duo' },
        { value: 'members', label: 'Membres uniquement' },
      ]
    : [
        { value: 'followers', label: 'Abonnés du duo acceptés' },
        { value: 'members', label: 'Membres uniquement' },
      ];

  const syncFromProfile = (profile) => {
    if (!profile) return;
    setName(profile.name || '');
    setRelationType(profile.relation_type || 'partners');
    setVisibility(profile.account_visibility || 'private');
    setWallVisibility(resolveDuoVis(profile, 'wall_visibility', 'show_posts', 'followers'));
    setBadgesVisibility(resolveDuoVis(profile, 'badges_visibility', 'show_badges', 'public'));
    setStatsVisibility(resolveDuoVis(profile, 'stats_visibility', 'show_stats', 'followers'));
    setActivityVisibility(resolveDuoVis(profile, 'activity_visibility', 'show_recent_activity', 'followers'));
    setChallengesVisibility(resolveDuoVis(profile, 'challenges_visibility', 'show_challenges', 'followers'));
    setBannerUrl(profile.banner_url || '');
    setBannerPreview(null);
  };

  const handleOpen = (isOpen) => {
    if (isOpen && duoProfile) syncFromProfile(duoProfile);
    onOpenChange(isOpen);
  };

  useEffect(() => () => revokePreviewUrl(bannerPreview), [bannerPreview]);

  const handleBannerPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const { blob, previewUrl } = await compressImageFile(file);
      setBannerPreview(previewUrl);
      const dataUrl = await blobToDataUrl(blob);
      const { data } = await uploadsApi.uploadImage(dataUrl, file.name);
      const stored = uploadPathFromResponse(data);
      if (!stored) throw new Error('Réponse upload invalide');
      setBannerUrl(stored);
      toast.success('Bannière importée');
    } catch (error) {
      toast.error(error.message || 'Échec import bannière');
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        relation_type: relationType,
        account_visibility: visibility,
        banner_url: bannerUrl.trim() || null,
        stats_visibility: statsVisibility,
        activity_visibility: activityVisibility,
        challenges_visibility: challengesVisibility,
      };
      if (isPublicDuo) {
        payload.wall_visibility = 'public';
        payload.badges_visibility = 'public';
      } else {
        payload.wall_visibility = 'followers';
        payload.badges_visibility = 'followers';
      }
      const { data } = await duoApi.updateProfile(payload);
      toast.success('Profil duo mis à jour');
      onSaved?.(data);
      onOpenChange(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const bannerDisplay = bannerPreview || resolveMediaUrl(bannerUrl);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="bg-[#141414] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-['Outfit']">Modifier le duo</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Bannière, nom, relation et confidentialité du profil duo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-zinc-400">Bannière</Label>
            <div
              className="mt-2 h-24 rounded-xl border border-white/10 overflow-hidden relative"
              style={
                bannerDisplay
                  ? { backgroundImage: `url(${bannerDisplay})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: 'linear-gradient(135deg, #1a1a2e, #0A0A0A)' }
              }
            >
              {!bannerDisplay ? (
                <p className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">
                  Aucune bannière
                </p>
              ) : null}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleBannerPick}
            />
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploadingBanner}
                onClick={() => bannerInputRef.current?.click()}
                className="rounded-xl border-white/15 text-white"
              >
                {uploadingBanner ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} className="mr-1" />}
                Importer
              </Button>
              {bannerUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setBannerUrl('');
                    setBannerPreview(null);
                  }}
                  className="text-zinc-400"
                >
                  Retirer
                </Button>
              ) : null}
            </div>
          </div>

          <div>
            <Label className="text-zinc-400">Nom du duo</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
              placeholder="Les Guerriers"
            />
            {duoProfile?.tag ? (
              <p className="text-zinc-600 text-xs mt-1 font-mono">Identifiant : {duoProfile.tag}</p>
            ) : null}
          </div>

          <div>
            <Label className="text-zinc-400">Type de relation</Label>
            <Select value={relationType} onValueChange={setRelationType}>
              <SelectTrigger className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                {DUO_RELATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-white">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-white/10 p-4 space-y-3" data-testid="duo-privacy-settings">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[var(--theme-primary)]" />
                <span className="text-white text-sm font-medium">Confidentialité</span>
              </div>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="w-36 h-9 rounded-lg bg-[#0A0A0A] border-white/10 text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  <SelectItem value="public" className="text-white">Profil public</SelectItem>
                  <SelectItem value="private" className="text-white">Profil privé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={() => setPrivacyOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left text-zinc-400 text-xs"
            >
              <span>Détails de visibilité</span>
              <ChevronDown size={14} className={`transition-transform ${privacyOpen ? 'rotate-180' : ''}`} />
            </button>

            {privacyOpen ? (
              <div className="space-y-2">
                <PrivacyRow
                  icon={LayoutGrid}
                  label="Mur duo"
                  locked
                  lockedLabel={isPublicDuo ? 'Public' : 'Abonnés du duo acceptés'}
                />
                <PrivacyRow
                  icon={Award}
                  label="Badges Duo"
                  locked
                  lockedLabel={isPublicDuo ? 'Public' : 'Abonnés du duo acceptés'}
                />
                <PrivacyRow
                  icon={BarChart3}
                  label="Statistiques communes"
                  value={statsVisibility}
                  onChange={setStatsVisibility}
                  options={configurableOptions}
                />
                <PrivacyRow
                  icon={Activity}
                  label="Activité du duo"
                  value={activityVisibility}
                  onChange={setActivityVisibility}
                  options={configurableOptions}
                />
                <PrivacyRow
                  icon={Target}
                  label="Défi de la semaine"
                  value={challengesVisibility}
                  onChange={setChallengesVisibility}
                  options={configurableOptions}
                />
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || name.trim().length < 2 || uploadingBanner}
            className="w-full btn-primary text-white rounded-xl"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
