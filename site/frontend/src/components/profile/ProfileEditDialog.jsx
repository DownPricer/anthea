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
import {
  filterSelectableSoloBadges,
  getBadgeDisplayName,
  normalizeFeaturedBadgeIds,
  toggleFeaturedBadgeId,
} from '../../lib/featuredBadges';
import { BadgeArtwork } from '../badges/BadgeArtwork';
import { useTranslation } from 'react-i18next';

const FITNESS_LEVEL_VALUES = ['beginner', 'intermediate', 'advanced', 'expert'];
const GOAL_VALUES = ['lose_weight', 'gain_muscle', 'stay_fit', 'improve_endurance', 'flexibility'];

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
  const { t } = useTranslation(['profile', 'common', 'badges']);
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
    () => filterSelectableSoloBadges(badges),
    [badges]
  );

  useEffect(() => {
    if (!open) return;
    if (featuredTouched) return;
    const savedIds = Array.isArray(savedFeaturedIdsRef.current)
      ? savedFeaturedIdsRef.current
      : [];
    const validIds = normalizeFeaturedBadgeIds(savedIds, unlockedSoloBadges, { max: 3 });
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
      const { next, rejected } = toggleFeaturedBadgeId(current, id, 3);
      if (rejected) {
        toast.error(t('edit.maxFeatured'));
      }
      return next;
    });
  }

  const handleSubmit = async () => {
    const normalizedHandle = normalizeHandle(form.handle);
    if (!isValidHandle(normalizedHandle)) {
      toast.error(t('edit.invalidHandle'));
      return;
    }

    setSaving(true);
    const payload = { ...dirtyPayload };
    if (!Object.keys(payload).length) {
      setSaving(false);
      onOpenChange(false);
      return;
    }
    const result = await onSave(payload);
    setSaving(false);

    if (result?.success) {
      const rawReturned = Array.isArray(result?.user?.featured_badge_ids)
        ? result.user.featured_badge_ids.map(String)
        : Array.isArray(result?.user?.featured_badges)
          ? result.user.featured_badges.map((b) => (typeof b === 'string' ? b : b?.id)).filter(Boolean).map(String)
          : [];
      const returnedIds = normalizeFeaturedBadgeIds(rawReturned, unlockedSoloBadges, { max: 3 });
      setSelectedBadgeIds(returnedIds);
      setBaselineBadgeIds(returnedIds);
      setFeaturedTouched(false);
      toast.success(t('edit.success'));
      onOpenChange(false);
    } else if (result?.error) {
      toast.error(result.error);
    }
  };

  const formBody = (
    <div className="space-y-5 pb-4" data-testid="profile-edit-panel">
      {isDirty ? (
        <p className="text-amber-400/90 text-xs" data-testid="profile-unsaved-hint">
          {t('edit.unsaved')}
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
            className="rounded-xl border-border text-foreground w-full sm:w-auto"
          >
            {avatarUploading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Camera size={16} className="mr-2" />
            )}
            {t('edit.importPhoto')}
          </Button>
          {form.avatar_url ? (
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, avatar_url: '' }));
                revokePreviewUrl(avatarPreview);
                setAvatarPreview(null);
              }}
              className="text-subtle text-xs hover:text-red-400 flex items-center gap-1"
            >
              <X size={12} /> {t('edit.removePhoto')}
            </button>
          ) : (
            <p className="text-subtle text-xs">{t('edit.photoFormats')}</p>
          )}
        </div>
      </div>

      <div>
        <Label className="text-muted text-sm">{t('edit.displayName')}</Label>
        <Input
          value={form.display_name}
          onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
          className="mt-2 h-11 rounded-xl bg-background border-border text-foreground"
        />
      </div>

      <div>
        <Label className="text-muted text-sm">{t('edit.handle')}</Label>
        <div className="relative mt-2">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle">@</span>
          <Input
            value={form.handle}
            onChange={(e) => setForm((f) => ({ ...f, handle: normalizeHandle(e.target.value) }))}
            placeholder="mon_pseudo"
            className="h-11 rounded-xl bg-background border-border text-foreground pl-8"
          />
        </div>
        <p className="text-subtle text-xs mt-1">{t('edit.handleHint')}</p>
      </div>

      <div>
        <Label className="text-muted text-sm">{t('edit.bio')}</Label>
        <Textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          placeholder={t('edit.bioPlaceholder')}
          className="mt-2 rounded-xl bg-background border-border text-foreground min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted text-sm">{t('edit.level')}</Label>
          <Select
            value={form.fitness_level}
            onValueChange={(v) => setForm((f) => ({ ...f, fitness_level: v }))}
          >
            <SelectTrigger className="mt-2 h-11 rounded-xl bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-elevated border-border">
              {FITNESS_LEVEL_VALUES.map((value) => (
                <SelectItem key={value} value={value} className="text-foreground">
                  {t(`common:fitnessLevels.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted text-sm">{t('edit.goal')}</Label>
          <Select
            value={form.main_goal || undefined}
            onValueChange={(v) => setForm((f) => ({ ...f, main_goal: v }))}
          >
            <SelectTrigger className="mt-2 h-11 rounded-xl bg-background border-border text-foreground">
              <SelectValue placeholder={t('edit.choose')} />
            </SelectTrigger>
            <SelectContent className="bg-surface-elevated border-border">
              {GOAL_VALUES.map((value) => (
                <SelectItem key={value} value={value} className="text-foreground">
                  {t(`common:goals.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {unlockedSoloBadges.length > 0 ? (
        <div className="space-y-2">
          <div>
            <Label className="text-muted text-sm">{t('edit.featuredBadges')}</Label>
            <p className="text-subtle text-xs mt-0.5">
              {t('edit.featuredCount', { count: selectedBadgeIds.length })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {unlockedSoloBadges.map((badge) => {
              const selectedIndex = selectedBadgeIds.indexOf(String(badge.id));
              const isSelected = selectedIndex >= 0;
              const badgeName = getBadgeDisplayName(badge, (key, opts) => t(key, { ...opts, ns: 'badges' }));
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => toggleFeaturedBadge(badge.id)}
                  aria-pressed={isSelected}
                  className={`relative min-w-0 overflow-hidden rounded-xl border p-2 text-center transition-colors ${
                    isSelected
                      ? 'border-[var(--theme-primary)] bg-[var(--theme-surface-active)] ring-1 ring-[var(--theme-primary)]/40'
                      : 'border-border bg-hover hover:border-border-strong'
                  }`}
                >
                  <span
                    className={`absolute left-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      isSelected
                        ? 'bg-[var(--theme-primary)] text-foreground'
                        : 'bg-overlay text-subtle'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check size={10} className="mr-0.5" />
                        {selectedIndex + 1}
                      </>
                    ) : '—'}
                  </span>
                  <BadgeArtwork
                    rarity={badge.rarity_key || badge.rarity}
                    iconKey={badge.icon_key || badge.icon || 'trophy'}
                    locked={false}
                    size={40}
                    className="mx-auto shrink-0 size-10"
                  />
                  <p className="mt-1 min-w-0 line-clamp-2 break-words text-center text-[10px] text-muted">
                    {badgeName}
                  </p>
                  {isSelected ? (
                    <span className="text-[9px] font-medium text-[var(--theme-primary)]">
                      {t('edit.selected')}
                    </span>
                  ) : null}
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
      className="w-full h-11 rounded-xl btn-primary text-foreground font-medium"
      data-testid="profile-settings-save"
    >
      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t('edit.save')}
    </Button>
  );

  const discardDialog = (
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent className="bg-surface-elevated border-border text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('edit.discardTitle')}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted">
            {t('edit.discardDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-border bg-transparent text-foreground">
            {t('edit.discardContinue')}
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-red-600 hover:bg-red-500 text-foreground"
            onClick={confirmDiscard}
          >
            {t('edit.discardLeave')}
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
            className="bg-surface-elevated border-border text-foreground max-h-[92vh] flex flex-col"
            onCloseAutoFocus={(event) => {
              if (suppressCloseAutoFocus) event.preventDefault();
            }}
          >
            <DrawerHeader className="text-left shrink-0">
              <DrawerTitle className="font-['Outfit'] text-foreground">{t('edit.title')}</DrawerTitle>
              <DrawerDescription className="text-subtle">
                {t('edit.description')}
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4">{formBody}</div>
            <DrawerFooter className="shrink-0 border-t border-border">{saveButton}</DrawerFooter>
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
          className="bg-surface-elevated border-border text-foreground w-full sm:max-w-[480px] flex flex-col p-0"
          onCloseAutoFocus={(event) => {
            if (suppressCloseAutoFocus) event.preventDefault();
          }}
        >
          <SheetHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <SheetTitle className="font-['Outfit'] text-foreground text-left">{t('edit.title')}</SheetTitle>
            <SheetDescription className="text-subtle text-left">
              {t('edit.description')}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">{formBody}</div>
          <div className="shrink-0 border-t border-border px-6 py-4">{saveButton}</div>
        </SheetContent>
      </Sheet>
      {discardDialog}
    </>
  );
}
