import { useState, useEffect, useRef } from 'react';
import { Loader2, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '../UserAvatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { getPublicHandle, isValidHandle, normalizeHandle } from '../../lib/userProfile';
import { revokePreviewUrl } from '../../lib/imageCompress';

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

export function ProfileEditDialog({
  open,
  onOpenChange,
  user,
  badges = [],
  onSave,
  onAvatarFileSelected,
  avatarUploading = false,
  suppressCloseAutoFocus = false,
}) {
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('beginner');
  const [mainGoal, setMainGoal] = useState('');
  const [featuredBadges, setFeaturedBadges] = useState([]);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user || !open) return;
    setDisplayName(user.display_name || '');
    setHandle(getPublicHandle(user));
    setAvatarUrl(user.avatar_url || '');
    setAvatarPreview(null);
    setBio(user.bio || '');
    setFitnessLevel(user.fitness_level || 'beginner');
    setMainGoal(user.main_goal || '');
    setFeaturedBadges(user.featured_badges || []);
  }, [user, open]);

  useEffect(() => () => revokePreviewUrl(avatarPreview), [avatarPreview]);

  const handleAvatarPick = (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    onAvatarFileSelected?.(file);
  };

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const previewUser = {
    ...user,
    avatar_url: avatarPreview || avatarUrl || user?.avatar_url,
    display_name: displayName,
    updated_at: user?.updated_at,
  };

  const toggleFeaturedBadge = (badgeId) => {
    setFeaturedBadges((prev) => {
      if (prev.includes(badgeId)) return prev.filter((id) => id !== badgeId);
      if (prev.length >= 3) {
        toast.info('Maximum 3 badges mis en avant');
        return prev;
      }
      return [...prev, badgeId];
    });
  };

  const handleSubmit = async () => {
    const normalizedHandle = normalizeHandle(handle);
    if (!isValidHandle(normalizedHandle)) {
      toast.error('Arobase invalide (3-30 caractères, lettres, chiffres et _ uniquement)');
      return;
    }

    setSaving(true);
    const result = await onSave({
      display_name: displayName.trim(),
      handle: normalizedHandle,
      avatar_url: avatarUrl.trim() || null,
      bio: bio.trim(),
      fitness_level: fitnessLevel,
      main_goal: mainGoal,
      featured_badges: featuredBadges,
    });
    setSaving(false);

    if (result?.success) {
      toast.success('Profil mis à jour !');
      onOpenChange(false);
    } else if (result?.error) {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#141414] border-white/10 max-w-lg max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          if (suppressCloseAutoFocus) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-white font-['Outfit']">Modifier le profil</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Photo, pseudo, bio et badges mis en avant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <UserAvatar user={previewUser} className="w-16 h-16 text-2xl" cacheVersion={user?.updated_at} />
            <div className="flex-1 min-w-0 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarPick}
              />
              <Button
                type="button"
                variant="outline"
                disabled={avatarUploading}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-white/15 text-white w-full sm:w-auto"
              >
                {avatarUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Camera size={16} className="mr-2" />
                )}
                Importer une photo
              </Button>
              {avatarUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl('');
                    revokePreviewUrl(avatarPreview);
                    setAvatarPreview(null);
                  }}
                  className="text-zinc-500 text-xs hover:text-red-400 flex items-center gap-1"
                >
                  <X size={12} /> Retirer la photo
                </button>
              ) : (
                <p className="text-zinc-600 text-xs">JPG, PNG ou WebP</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-zinc-400 text-sm">Nom affiché</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
            />
          </div>

          <div>
            <Label className="text-zinc-400 text-sm">Arobase</Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">@</span>
              <Input
                value={handle}
                onChange={(e) => setHandle(normalizeHandle(e.target.value))}
                placeholder="mon_pseudo"
                className="h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white pl-8"
              />
            </div>
            <p className="text-zinc-600 text-xs mt-1">Unique, visible publiquement (3-30 car., a-z, 0-9, _)</p>
          </div>

          <div>
            <Label className="text-zinc-400 text-sm">Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Quelques mots sur toi..."
              className="mt-2 rounded-xl bg-[#0A0A0A] border-white/10 text-white min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-400 text-sm">Niveau</Label>
              <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                <SelectTrigger className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
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
                <SelectTrigger className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
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

          {unlockedBadges.length > 0 ? (
            <div className="space-y-2">
              <div>
                <Label className="text-zinc-400 text-sm">Badges mis en avant</Label>
                <p className="text-zinc-600 text-xs mt-0.5">Jusqu&apos;à 3 ({featuredBadges.length}/3)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {unlockedBadges.map((badge) => {
                  const selected = featuredBadges.includes(badge.id);
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => toggleFeaturedBadge(badge.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-[var(--theme-surface-active)] border-[var(--theme-primary)] text-white'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {badge.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <Button
            onClick={handleSubmit}
            disabled={saving || avatarUploading}
            className="w-full h-11 rounded-xl btn-primary text-white font-medium"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
