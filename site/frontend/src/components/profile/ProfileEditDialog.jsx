import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Loader2, Camera, X, Check } from 'lucide-react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '../ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
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

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : true
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return mobile;
}

function buildInitialForm(user) {
  return {
    display_name: user?.display_name || '',
    handle: getPublicHandle(user) || '',
    avatar_url: user?.avatar_url || '',
    bio: user?.bio || '',
    fitness_level: user?.fitness_level || 'beginner',
    main_goal: user?.main_goal || '',
  };
}

function idsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

/**
 * Panneau Modifier mon profil — bottom sheet mobile / panneau latéral desktop
 * (même UX que DuoProfileEditDialog).
 */
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
  const isMobile = useIsMobile();
  const [form, setForm] = useState(() => buildInitialForm(user));
  const [baseline, setBaseline] = useState(() => buildInitialForm(user));
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [selectedBadgeIds, setSelectedBadgeIds] = useState([]);
  const [baselineBadgeIds, setBaselineBadgeIds] = useState([]);
  const [featuredTouched, setFeaturedTouched] = useState(false);
  const fileInputRef = useRef(null);
  const savedFeaturedIdsRef = useRef([]);

  const syncFromUser = useCallback((u) => {
    const next = buildInitialForm(u);
    setForm(next);
    setBaseline(next);
    setAvatarPreview(null);
    savedFeaturedIdsRef.current = Array.isArray(u?.featured_badge_ids)
      ? u.featured_badge_ids.map(String)
      : Array.isArray(u?.featured_badges)
        ? u.featured_badges.map(String)
        : [];
    setSelectedBadgeIds([]);
    setBaselineBadgeIds([]);
    setFeaturedTouched(false);
  }, []);

  useEffect(() => {
    if (open && user) syncFromUser(user);
  }, [open, user, syncFromUser]);

  useEffect(() => () => revokePreviewUrl(avatarPreview), [avatarPreview]);

  const dirtyPayload = useMemo(() => {
    const payload = {};
    if ((form.display_name || '').trim() !== (baseline.display_name || '').trim()) {
      payload.display_name = form.display_name.trim();
    }
    if (normalizeHandle(form.handle) !== normalizeHandle(baseline.handle)) {
      payload.handle = normalizeHandle(form.handle);
    }
    if ((form.avatar_url || '') !== (baseline.avatar_url || '')) {
      payload.avatar_url = form.avatar_url.trim() || null;
    }
    if ((form.bio || '').trim() !== (baseline.bio || '').trim()) {
      payload.bio = form.bio.trim();
    }
    if (form.fitness_level !== baseline.fitness_level) {
      payload.fitness_level = form.fitness_level;
    }
    if ((form.main_goal || '') !== (baseline.main_goal || '')) {
      payload.main_goal = form.main_goal;
    }
    if (!idsEqual(selectedBadgeIds, baselineBadgeIds)) {
      payload.featured_badge_ids = selectedBadgeIds;
    }
    return payload;
  }, [form, baseline, selectedBadgeIds, baselineBadgeIds]);

  const isDirty = Object.keys(dirtyPayload).length > 0;

  const requestClose = (nextOpen) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const confirmDiscard = () => {
    setDiscardOpen(false);
    onOpenChange(false);
  };

  const handleAvatarPick = (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    onAvatarFileSelected?.(file);
  };

  const unlockedSoloBadges = useMemo(
    () => (badges || [])
      .filter((b) => b?.unlocked && b?.id)
      .filter((b) => {
        const id = String(b.id);
        if (b.scope === 'duo') return false;
        if (b.family === 'duo') return false;
        if (id.startsWith('duo_')) return false;
        return true;
      }),
    [badges]
  );

  useEffect(() => {
    if (!open) return;
    if (featuredTouched) return;
    const unlockedIdSet = new Set(unlockedSoloBadges.map((b) => String(b.id)));
    const savedIds = Array.isArray(savedFeaturedIdsRef.current)
      ? savedFeaturedIdsRef.current
      : [];
    const validIds = savedIds
      .map(String)
      .filter((id) => unlockedIdSet.has(id))
      .slice(0, 3);
    setSelectedBadgeIds(validIds);
    setBaselineBadgeIds(validIds);

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Personal Featured Badges]', {
        userFeaturedIds: user?.featured_badge_ids,
        userFeaturedBadges: user?.featured_badges,
        unlockedSoloBadgeIds: unlockedSoloBadges?.map((badge) => badge.id),
        selectedBadgeIds: validIds,
      });
    }
  }, [open, unlockedSoloBadges, featuredTouched, user?.featured_badge_ids, user?.featured_badges, user]);

  const previewUser = {
    ...user,
    avatar_url: avatarPreview || form.avatar_url || user?.avatar_url,
    display_name: form.display_name,
    updated_at: user?.updated_at,
  };

  function toggleFeaturedBadge(badgeId) {
    const id = String(badgeId);
    setFeaturedTouched(true);
    setSelectedBadgeIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= 3) {
        toast.error('Vous pouvez mettre en avant jusqu’à 3 badges.');
        return current;
      }
      return [...current, id];
    });
  };

  const handleSubmit = async () => {
    const normalizedHandle = normalizeHandle(form.handle);
    if (!isValidHandle(normalizedHandle)) {
      toast.error('Arobase invalide (3-30 caractères, lettres, chiffres et _ uniquement)');
      return;
    }

    setSaving(true);
    const result = await onSave({
      display_name: form.display_name.trim(),
      handle: normalizedHandle,
      avatar_url: form.avatar_url.trim() || null,
      bio: form.bio.trim(),
      fitness_level: form.fitness_level,
      main_goal: form.main_goal,
      featured_badge_ids: selectedBadgeIds,
    });
    setSaving(false);

    if (result?.success) {
      const returnedIds = Array.isArray(result?.user?.featured_badge_ids)
        ? result.user.featured_badge_ids.map(String)
        : Array.isArray(result?.user?.featured_badges)
          ? result.user.featured_badges.map((b) => (typeof b === 'string' ? b : b?.id)).filter(Boolean).map(String)
          : [];
      setSelectedBadgeIds(returnedIds.slice(0, 3));
      setBaselineBadgeIds(returnedIds.slice(0, 3));
      setFeaturedTouched(false);
      toast.success('Profil mis à jour !');
      onOpenChange(false);
    } else if (result?.error) {
      toast.error(result.error);
    }
  };

  const formBody = (
    <div className="space-y-5 pb-4" data-testid="profile-edit-panel">
      {isDirty ? (
        <p className="text-amber-400/90 text-xs" data-testid="profile-unsaved-hint">
          Modifications non enregistrées
        </p>
      ) : null}

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
          {form.avatar_url ? (
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, avatar_url: '' }));
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
          value={form.display_name}
          onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
          className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
        />
      </div>

      <div>
        <Label className="text-zinc-400 text-sm">Arobase</Label>
        <div className="relative mt-2">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">@</span>
          <Input
            value={form.handle}
            onChange={(e) => setForm((f) => ({ ...f, handle: normalizeHandle(e.target.value) }))}
            placeholder="mon_pseudo"
            className="h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white pl-8"
          />
        </div>
        <p className="text-zinc-600 text-xs mt-1">Unique, visible publiquement (3-30 car., a-z, 0-9, _)</p>
      </div>

      <div>
        <Label className="text-zinc-400 text-sm">Bio</Label>
        <Textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          placeholder="Quelques mots sur toi..."
          className="mt-2 rounded-xl bg-[#0A0A0A] border-white/10 text-white min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-zinc-400 text-sm">Niveau</Label>
          <Select
            value={form.fitness_level}
            onValueChange={(v) => setForm((f) => ({ ...f, fitness_level: v }))}
          >
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
          <Select
            value={form.main_goal || undefined}
            onValueChange={(v) => setForm((f) => ({ ...f, main_goal: v }))}
          >
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

      {unlockedSoloBadges.length > 0 ? (
        <div className="space-y-2">
          <div>
            <Label className="text-zinc-400 text-sm">Badges mis en avant</Label>
            <p className="text-zinc-600 text-xs mt-0.5">
              {selectedBadgeIds.length} badge{selectedBadgeIds.length > 1 ? 's' : ''} sélectionné{selectedBadgeIds.length > 1 ? 's' : ''} sur 3
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {unlockedSoloBadges.map((badge) => {
              const selectedIndex = selectedBadgeIds.indexOf(String(badge.id));
              const isSelected = selectedIndex >= 0;
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => toggleFeaturedBadge(badge.id)}
                  aria-pressed={isSelected}
                  className={`relative min-w-0 overflow-hidden rounded-xl border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-[var(--theme-primary)] bg-[var(--theme-surface-active)] ring-1 ring-[var(--theme-primary)]/40'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <span
                    className={`absolute right-2 top-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isSelected ? 'bg-[var(--theme-primary)] text-white' : 'bg-black/30 text-zinc-500'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check size={12} className="mr-1" />
                        {selectedIndex + 1}
                      </>
                    ) : '—'}
                  </span>
                  <p className="text-white text-sm font-medium min-w-0 line-clamp-2 break-words pr-10">
                    {badge.name}
                  </p>
                  {isSelected ? (
                    <p className="mt-1 text-[11px] font-medium text-[var(--theme-primary)]">
                      Sélectionné
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Appuyer pour sélectionner
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );

  const saveButton = (
    <Button
      type="button"
      onClick={handleSubmit}
      disabled={saving || avatarUploading}
      className="w-full h-11 rounded-xl btn-primary text-white font-medium"
      data-testid="profile-settings-save"
    >
      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
    </Button>
  );

  const discardDialog = (
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent className="bg-[#141414] border-white/10 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Quitter sans enregistrer ?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Vos modifications seront perdues.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-white/15 bg-transparent text-white">
            Continuer la modification
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-red-600 hover:bg-red-500 text-white"
            onClick={confirmDiscard}
          >
            Quitter
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={requestClose}>
          <DrawerContent
            className="bg-[#141414] border-white/10 text-white max-h-[92vh] flex flex-col"
            onCloseAutoFocus={(event) => {
              if (suppressCloseAutoFocus) event.preventDefault();
            }}
          >
            <DrawerHeader className="text-left shrink-0">
              <DrawerTitle className="font-['Outfit'] text-white">Modifier le profil</DrawerTitle>
              <DrawerDescription className="text-zinc-500">
                Photo, pseudo, bio et badges mis en avant
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4">{formBody}</div>
            <DrawerFooter className="shrink-0 border-t border-white/10">{saveButton}</DrawerFooter>
          </DrawerContent>
        </Drawer>
        {discardDialog}
      </>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side="right"
          className="bg-[#141414] border-white/10 text-white w-full sm:max-w-[480px] flex flex-col p-0"
          onCloseAutoFocus={(event) => {
            if (suppressCloseAutoFocus) event.preventDefault();
          }}
        >
          <SheetHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-white/10">
            <SheetTitle className="font-['Outfit'] text-white text-left">Modifier le profil</SheetTitle>
            <SheetDescription className="text-zinc-500 text-left">
              Photo, pseudo, bio et badges mis en avant
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">{formBody}</div>
          <div className="shrink-0 border-t border-white/10 px-6 py-4">{saveButton}</div>
        </SheetContent>
      </Sheet>
      {discardDialog}
    </>
  );
}
