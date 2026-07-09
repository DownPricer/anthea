import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '../UserAvatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { getPublicHandle, isValidHandle, normalizeHandle } from '../../lib/userProfile';

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
}) {
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('beginner');
  const [mainGoal, setMainGoal] = useState('');
  const [featuredBadges, setFeaturedBadges] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    setDisplayName(user.display_name || '');
    setHandle(getPublicHandle(user));
    setAvatarUrl(user.avatar_url || '');
    setBio(user.bio || '');
    setFitnessLevel(user.fitness_level || 'beginner');
    setMainGoal(user.main_goal || '');
    setFeaturedBadges(user.featured_badges || []);
  }, [user, open]);

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const previewUser = { ...user, avatar_url: avatarUrl || user?.avatar_url, display_name: displayName };

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
      <DialogContent className="bg-[#141414] border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white font-['Outfit']">Modifier le profil</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <UserAvatar user={previewUser} className="w-16 h-16 text-2xl" />
            <div className="flex-1 min-w-0">
              <Label className="text-zinc-400 text-sm">Photo de profil (URL)</Label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
              />
              <p className="text-zinc-600 text-xs mt-1">Laisse vide pour l&apos;avatar par défaut</p>
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
            disabled={saving}
            className="w-full h-11 rounded-xl btn-primary text-white font-medium"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
