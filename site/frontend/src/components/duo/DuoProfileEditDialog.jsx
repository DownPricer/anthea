import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { DUO_RELATION_OPTIONS, DUO_ROLE_OPTIONS, getDuoRoleLabel } from '../../lib/duoProfile';
import { duoApi, uploadsApi, badgesApi, formatApiError, resolveMediaUrl } from '../../lib/api';
import { invalidateDuoDomain } from '../../lib/duoCache';
import { compressImageFile, revokePreviewUrl, blobToDataUrl } from '../../lib/imageCompress';
import { UserAvatar } from '../UserAvatar';
import { BadgeArtwork } from '../badges/BadgeArtwork';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getBadgeDisplayName } from '../../lib/featuredBadges';
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
  Users,
  Palette,
  Star,
  Check,
} from 'lucide-react';

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

function resolveMemberRole(profile, member) {
  if (!member) return 'member';
  if (member.duo_role) return member.duo_role;
  const roles = profile?.member_roles || {};
  if (roles[member.id]) return roles[member.id];
  if (member.is_coach || profile?.coach_member_id === member.id) return 'coach';
  if (member.is_leader || profile?.leader_member_id === member.id) return 'leader';
  return 'member';
}

function PrivacyRow({ icon: Icon, label, locked, lockedLabel, value, onChange, options }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-hover p-3 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={16} className="text-subtle shrink-0" />
        <span className="text-sm text-muted">{label}</span>
      </div>
      {locked ? (
        <span className="text-xs text-subtle flex items-center gap-1 shrink-0">
          <Lock size={12} />
          {lockedLabel}
        </span>
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

function buildInitialForm(profile) {
  const members = Array.isArray(profile?.members) ? profile.members : [];
  const roles = {};
  members.forEach((m) => {
    roles[m.id] = resolveMemberRole(profile, m);
  });
  return {
    name: profile?.name ?? '',
    relation_type: profile?.relation_type ?? 'partners',
    account_visibility: profile?.account_visibility ?? 'private',
    wall_visibility: resolveDuoVis(profile, 'wall_visibility', 'show_posts', 'followers'),
    badges_visibility: resolveDuoVis(profile, 'badges_visibility', 'show_badges', 'public'),
    stats_visibility: resolveDuoVis(profile, 'stats_visibility', 'show_stats', 'followers'),
    activity_visibility: resolveDuoVis(profile, 'activity_visibility', 'show_recent_activity', 'followers'),
    challenges_visibility: resolveDuoVis(profile, 'challenges_visibility', 'show_challenges', 'followers'),
    banner_url: profile?.banner_url ?? null,
    member_roles: roles,
  };
}

function rolesEqual(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] || 'member') !== (b[k] || 'member')) return false;
  }
  return true;
}

function idsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

/**
 * Panneau Modifier le Duo — bottom sheet mobile / panneau latéral desktop.
 */
export function DuoProfileEditDialog({ open, onOpenChange, duoProfile, onSaved }) {
  const { t } = useTranslation(['duo', 'common', 'profile', 'badges']);
  const isMobile = useIsMobile();
  const [form, setForm] = useState(() => buildInitialForm(duoProfile));
  const [baseline, setBaseline] = useState(() => buildInitialForm(duoProfile));
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [bannerChanged, setBannerChanged] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [unlockedBadges, setUnlockedBadges] = useState([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [selectedBadgeIds, setSelectedBadgeIds] = useState([]);
  const [baselineBadgeIds, setBaselineBadgeIds] = useState([]);
  const [featuredTouched, setFeaturedTouched] = useState(false);
  const savedFeaturedIdsRef = useRef([]);
  const bannerInputRef = useRef(null);
  const pendingCloseRef = useRef(false);

  const members = Array.isArray(duoProfile?.members) ? duoProfile.members.slice(0, 2) : [];
  const isPublicDuo = form.account_visibility === 'public';

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

  const syncFromProfile = useCallback((profile) => {
    const next = buildInitialForm(profile);
    setForm(next);
    setBaseline(next);
    setBannerPreview(null);
    setBannerRemoved(false);
    setBannerChanged(false);
    savedFeaturedIdsRef.current = Array.isArray(profile?.featured_badge_ids)
      ? profile.featured_badge_ids.map(String)
      : [];
    setSelectedBadgeIds([]);
    setBaselineBadgeIds([]);
    setFeaturedTouched(false);
  }, []);

  useEffect(() => {
    if (open && duoProfile) syncFromProfile(duoProfile);
  }, [open, duoProfile, syncFromProfile]);

  useEffect(() => {
    if (!open || !duoProfile?.pair_key) return undefined;
    let cancelled = false;
    setBadgesLoading(true);
    badgesApi
      .getDuoBadges(duoProfile.pair_key)
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data?.badges) ? data.badges : Array.isArray(data) ? data : [];
        setUnlockedBadges(list.filter((b) => b?.unlocked && b?.id));
      })
      .catch(() => {
        if (!cancelled) setUnlockedBadges([]);
      })
      .finally(() => {
        if (!cancelled) setBadgesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, duoProfile?.pair_key]);

  useEffect(() => {
    if (!open) return;
    if (badgesLoading) return;
    if (featuredTouched) return;

    const savedIds = Array.isArray(savedFeaturedIdsRef.current)
      ? savedFeaturedIdsRef.current
      : [];
    const unlockedIdSet = new Set((unlockedBadges || []).map((b) => String(b.id)));
    const validIds = savedIds
      .map(String)
      .filter((id) => unlockedIdSet.has(id))
      .slice(0, 3);

    setSelectedBadgeIds(validIds);
    setBaselineBadgeIds(validIds);

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[FeaturedBadges Init]', {
        rawIds: duoProfile?.featured_badge_ids,
        enriched: duoProfile?.featured_badges,
        unlockedIds: (unlockedBadges || []).map((b) => b.id),
      });
    }
  }, [open, badgesLoading, unlockedBadges, featuredTouched, duoProfile?.featured_badge_ids, duoProfile?.featured_badges]);

  useEffect(() => () => revokePreviewUrl(bannerPreview), [bannerPreview]);

  const dirtyPayload = useMemo(() => {
    const payload = {};
    if ((form.name || '').trim() !== (baseline.name || '').trim()) {
      payload.name = form.name.trim();
    }
    if (form.relation_type !== baseline.relation_type) {
      payload.relation_type = form.relation_type;
    }
    if (form.account_visibility !== baseline.account_visibility) {
      payload.account_visibility = form.account_visibility;
      if (form.account_visibility === 'public') {
        payload.wall_visibility = 'public';
        payload.badges_visibility = 'public';
      } else {
        payload.wall_visibility = 'followers';
        payload.badges_visibility = 'followers';
      }
    }
    if (form.stats_visibility !== baseline.stats_visibility) {
      payload.stats_visibility = form.stats_visibility;
    }
    if (form.activity_visibility !== baseline.activity_visibility) {
      payload.activity_visibility = form.activity_visibility;
    }
    if (form.challenges_visibility !== baseline.challenges_visibility) {
      payload.challenges_visibility = form.challenges_visibility;
    }
    if (bannerChanged) {
      if (bannerRemoved) {
        payload.banner_url = null;
        payload.clear_banner = true;
      } else if (form.banner_url) {
        payload.banner_url = form.banner_url;
      }
    }
    if (!rolesEqual(form.member_roles, baseline.member_roles)) {
      payload.member_roles = form.member_roles;
    }
    if (!idsEqual(selectedBadgeIds, baselineBadgeIds)) {
      payload.featured_badge_ids = selectedBadgeIds;
    }
    return payload;
  }, [
    form,
    baseline,
    bannerChanged,
    bannerRemoved,
    selectedBadgeIds,
    baselineBadgeIds,
  ]);

  const isDirty = Object.keys(dirtyPayload).length > 0;

  const requestClose = (nextOpen) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (isDirty) {
      pendingCloseRef.current = true;
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const confirmDiscard = () => {
    setDiscardOpen(false);
    pendingCloseRef.current = false;
    onOpenChange(false);
  };

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
      setForm((f) => ({ ...f, banner_url: stored }));
      setBannerRemoved(false);
      setBannerChanged(true);
      toast.success('Bannière importée');
    } catch (error) {
      toast.error(error.message || 'Échec import bannière');
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleRemoveBanner = () => {
    if (!window.confirm(t('duo:edit.removeBannerConfirm'))) return;
    setForm((f) => ({ ...f, banner_url: null }));
    setBannerPreview(null);
    setBannerRemoved(true);
    setBannerChanged(true);
  };

  const setMemberRole = (memberId, role) => {
    setForm((f) => ({
      ...f,
      member_roles: { ...f.member_roles, [memberId]: role },
    }));
  };

  const toggleFeaturedBadge = (badgeId) => {
    setFeaturedTouched(true);
    setSelectedBadgeIds((current) => {
      if (current.includes(badgeId)) {
        return current.filter((id) => id !== badgeId);
      }
      if (current.length >= 3) {
        toast.error('Maximum 3 badges mis en avant');
        return current;
      }
      return [...current, badgeId];
    });
  };

  const handleSave = async () => {
    if (!isDirty) return;
    if (dirtyPayload.name != null && dirtyPayload.name.length < 2) {
      toast.error('Nom de duo invalide');
      return;
    }
    setSaving(true);
    try {
      const { data } = await duoApi.updateProfile(dirtyPayload);
      invalidateDuoDomain('stats', data?.pair_key || duoProfile?.pair_key);
      invalidateDuoDomain('profile', data?.pair_key || duoProfile?.pair_key);
      const savedIds = Array.isArray(data?.featured_badge_ids)
        ? data.featured_badge_ids.slice(0, 3)
        : [];
      savedFeaturedIdsRef.current = savedIds.map(String);
      setSelectedBadgeIds(savedIds);
      setBaselineBadgeIds(savedIds);
      setFeaturedTouched(false);
      toast.success('Profil duo mis à jour');
      onSaved?.(data);
      onOpenChange(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const bannerDisplay = bannerPreview
    || (!bannerRemoved ? resolveMediaUrl(form.banner_url) : null);

  const formBody = (
    <div className="space-y-6 pb-4" data-testid="duo-settings-panel">
      {isDirty ? (
        <p className="text-amber-400/90 text-xs" data-testid="duo-unsaved-hint">
          Modifications non enregistrées
        </p>
      ) : null}

      {/* Identité */}
      <section className="space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-subtle flex items-center gap-2">
          <Users size={12} /> Identité
        </h3>
        <div>
          <Label className="text-muted">Nom du duo</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            maxLength={32}
            className="mt-2 h-11 rounded-xl bg-background border-border text-foreground"
            placeholder="Les Guerriers"
          />
          {duoProfile?.tag ? (
            <p className="text-subtle text-xs mt-1 font-mono">Identifiant : {duoProfile.tag}</p>
          ) : null}
        </div>
        <div>
          <Label className="text-muted">Type de relation</Label>
          <Select
            value={form.relation_type}
            onValueChange={(v) => setForm((f) => ({ ...f, relation_type: v }))}
          >
            <SelectTrigger className="mt-2 h-11 rounded-xl bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-elevated border-border">
              {DUO_RELATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-foreground">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Apparence */}
      <section className="space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-subtle flex items-center gap-2">
          <Palette size={12} /> Apparence
        </h3>
        <div
          className="h-24 rounded-xl border border-border overflow-hidden relative"
          style={
            bannerDisplay
              ? { backgroundImage: `url(${bannerDisplay})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: 'linear-gradient(135deg, var(--theme-primary), var(--background))' }
          }
        >
          {!bannerDisplay ? (
            <p className="absolute inset-0 flex items-center justify-center text-subtle text-xs">
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
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploadingBanner}
            onClick={() => bannerInputRef.current?.click()}
            className="rounded-xl border-border text-foreground"
          >
            {uploadingBanner ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} className="mr-1" />}
            Importer
          </Button>
          {(form.banner_url || baseline.banner_url) && !bannerRemoved ? (
            <Button type="button" size="sm" variant="ghost" onClick={handleRemoveBanner} className="text-muted">
              {t('duo:edit.removeBanner')}
            </Button>
          ) : null}
        </div>
      </section>

      {/* Confidentialité */}
      <section className="rounded-xl border border-border p-4 space-y-3" data-testid="duo-privacy-settings">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[var(--theme-primary)]" />
            <span className="text-foreground text-sm font-medium">Confidentialité</span>
          </div>
          <Select
            value={form.account_visibility}
            onValueChange={(v) => setForm((f) => ({ ...f, account_visibility: v }))}
          >
            <SelectTrigger className="w-36 h-9 rounded-lg bg-background border-border text-foreground text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-elevated border-border">
              <SelectItem value="public" className="text-foreground">Profil public</SelectItem>
              <SelectItem value="private" className="text-foreground">Profil privé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => setPrivacyOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left text-muted text-xs"
        >
          <span>Détails de visibilité</span>
          <ChevronDown size={14} className={`transition-transform ${privacyOpen ? 'rotate-180' : ''}`} />
        </button>
        {privacyOpen ? (
          <div className="space-y-2">
            <PrivacyRow icon={LayoutGrid} label="Mur duo" locked lockedLabel={isPublicDuo ? 'Public' : 'Abonnés du duo acceptés'} />
            <PrivacyRow icon={Award} label="Badges Duo" locked lockedLabel={isPublicDuo ? 'Public' : 'Abonnés du duo acceptés'} />
            <PrivacyRow
              icon={BarChart3}
              label={t('duo:edit.commonStats')}
              value={form.stats_visibility}
              onChange={(v) => setForm((f) => ({ ...f, stats_visibility: v }))}
              options={configurableOptions}
            />
            <PrivacyRow
              icon={Activity}
              label="Activité du duo"
              value={form.activity_visibility}
              onChange={(v) => setForm((f) => ({ ...f, activity_visibility: v }))}
              options={configurableOptions}
            />
            <PrivacyRow
              icon={Target}
              label="Défi de la semaine"
              value={form.challenges_visibility}
              onChange={(v) => setForm((f) => ({ ...f, challenges_visibility: v }))}
              options={configurableOptions}
            />
          </div>
        ) : null}
      </section>

      {/* Membres et rôles */}
      <section className="space-y-3" data-testid="duo-members-roles">
        <h3 className="text-xs uppercase tracking-wider text-subtle flex items-center gap-2">
          <Users size={12} /> Membres et rôles
        </h3>
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-3 rounded-xl bg-hover p-3"
          >
            <UserAvatar user={member} className="w-10 h-10 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-medium truncate">
                {member.display_name || member.username}
              </p>
              <p className="text-subtle text-xs truncate">
                @{member.handle || member.username}
              </p>
            </div>
            <Select
              value={form.member_roles?.[member.id] || 'member'}
              onValueChange={(v) => setMemberRole(member.id, v)}
            >
              <SelectTrigger className="w-[160px] h-9 rounded-lg bg-background border-border text-foreground text-xs shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-elevated border-border">
                {DUO_ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-foreground">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <p className="text-subtle text-[11px]">
          Coach et Responsable du Duo — les permissions existantes sont conservées.
        </p>
      </section>

      {/* Badges mis en avant */}
      <section className="space-y-3" data-testid="duo-featured-badges-settings">
        <h3 className="text-xs uppercase tracking-wider text-subtle flex items-center gap-2">
          <Star size={12} /> Badges mis en avant
        </h3>
        <p className="text-subtle text-xs">
          Choisissez jusqu&apos;à 3 badges débloqués à afficher sur le profil.
        </p>
        <p className="text-sm font-medium text-foreground">
          {selectedBadgeIds.length} badge{selectedBadgeIds.length > 1 ? 's' : ''} sélectionné{selectedBadgeIds.length > 1 ? 's' : ''} sur 3
        </p>
        {badgesLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-subtle" size={18} />
          </div>
        ) : unlockedBadges.length === 0 ? (
          <p className="text-subtle text-xs">Aucun badge Duo débloqué pour le moment.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {unlockedBadges.map((badge) => {
              const selected = selectedBadgeIds.includes(badge.id);
              const order = selectedBadgeIds.indexOf(badge.id);
              const badgeName = getBadgeDisplayName(badge, (key, opts) => t(key, { ...opts, ns: 'badges' }));
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => toggleFeaturedBadge(badge.id)}
                  aria-pressed={selected}
                  className={`relative min-w-0 overflow-hidden rounded-xl border p-2 text-center transition-colors ${
                    selected
                      ? 'border-[var(--theme-primary)] bg-[var(--theme-surface-active)] ring-1 ring-[var(--theme-primary)]/40'
                      : 'border-border bg-hover hover:border-border-strong'
                  }`}
                >
                  <span
                    className={`absolute left-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      selected
                        ? 'bg-[var(--theme-primary)] text-foreground'
                        : 'bg-overlay text-subtle'
                    }`}
                  >
                    {selected ? (
                      <>
                        <Check size={10} className="mr-0.5" />
                        {order + 1}
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
                  {selected ? (
                    <span className="text-[9px] font-medium text-[var(--theme-primary)]">
                      Sélectionné
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

  const saveButton = (
    <Button
      type="button"
      onClick={handleSave}
      disabled={saving || !isDirty || uploadingBanner}
      className="w-full btn-primary text-foreground rounded-xl h-11"
      data-testid="duo-settings-save"
    >
      {saving ? <Loader2 className="animate-spin" size={18} /> : t('common:actions.save')}
    </Button>
  );

  const discardDialog = (
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent className="bg-surface-elevated border-border text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>Quitter sans enregistrer ?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted">
            Vos modifications seront perdues.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-border bg-transparent text-foreground">
            {t('profile:edit.discardContinue')}
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-red-600 hover:bg-red-500 text-foreground"
            onClick={confirmDiscard}
          >
            {t('profile:edit.discardLeave')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={requestClose}>
          <DrawerContent className="bg-surface-elevated border-border text-foreground max-h-[92vh] flex flex-col">
            <DrawerHeader className="text-left shrink-0">
              <DrawerTitle className="font-['Outfit'] text-foreground">Modifier le Duo</DrawerTitle>
              <DrawerDescription className="text-subtle">
                Identité, confidentialité, membres et apparence
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4">
              {formBody}
            </div>
            <DrawerFooter className="shrink-0 border-t border-border">
              {saveButton}
            </DrawerFooter>
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
        >
          <SheetHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <SheetTitle className="font-['Outfit'] text-foreground text-left">Modifier le Duo</SheetTitle>
            <SheetDescription className="text-subtle text-left">
              Identité, confidentialité, membres et apparence
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {formBody}
          </div>
          <div className="shrink-0 border-t border-border px-6 py-4">
            {saveButton}
          </div>
        </SheetContent>
      </Sheet>
      {discardDialog}
    </>
  );
}

export { getDuoRoleLabel };
