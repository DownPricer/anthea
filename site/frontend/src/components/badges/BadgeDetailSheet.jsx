import { useMemo, useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { BadgeArtwork, normalizeBadgeRarityKey } from './BadgeArtwork';
import { getBadgeRarityStyle } from '../../lib/badgeStyles';
import { postsApi, formatApiError } from '../../lib/api';
import { toast } from 'sonner';

function formatUnlockedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Fiche badge (bottom-sheet mobile / modal desktop) + publication.
 * Handler unique pour aperçu Stats et catalogue complet.
 */
export function BadgeDetailSheet({
  badge,
  open,
  onOpenChange,
  scope = 'solo',
  canPublish = true,
  pairKey = null,
  onShared,
}) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const unlocked = Boolean(badge?.unlocked);
  const rarityKey = normalizeBadgeRarityKey(badge?.rarity_key || badge?.rarity);
  const rarityStyle = getBadgeRarityStyle(badge?.rarity);
  const isSecret = Boolean(badge?.is_secret) && !unlocked;
  const name = isSecret ? 'Succès secret' : badge?.name;
  const description = isSecret
    ? 'Continuez pour découvrir ce succès.'
    : badge?.description;

  const progressText = useMemo(() => {
    if (!badge || unlocked) return null;
    const { current, target } = badge;
    if (current != null && typeof current === 'object' && target && typeof target === 'object') {
      return `Âge ${current.age_days ?? 0}/${target.age_days ?? 0} · Séances ${current.common_workouts ?? 0}/${target.common_workouts ?? 0}`;
    }
    if (current != null && target != null) {
      return `${current} / ${target}`;
    }
    return null;
  }, [badge, unlocked]);

  if (!badge) return null;

  const handlePublish = async () => {
    if (!unlocked || !canPublish) return;
    setSaving(true);
    try {
      if (scope === 'duo') {
        await postsApi.create({
          type: 'duo_badge',
          badge_id: badge.id,
          pair_key: pairKey || undefined,
          description:
            message.trim() || 'Notre Duo vient de débloquer un nouveau succès !',
          visibility: 'public',
          post_on_duo_wall: true,
        });
        toast.success('Badge publié');
      } else {
        await postsApi.create({
          type: 'badge',
          badge_id: badge.id,
          description: message.trim() || 'J’ai débloqué un nouveau succès !',
          visibility: 'public',
        });
        toast.success('Badge publié');
      }
      onShared?.(badge);
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const unlockedLabel = formatUnlockedAt(badge.unlocked_at || badge.progress_detail?.unlocked_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#141414] border-white/10 max-w-sm max-h-[90vh] overflow-y-auto"
        data-testid="badge-detail-sheet"
      >
        <DialogHeader>
          <DialogTitle className="text-white">{name}</DialogTitle>
          <DialogDescription className="text-zinc-500">
            {description || (unlocked ? 'Succès débloqué' : 'Continuez pour le débloquer')}
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-2xl border p-5 text-center ${rarityStyle.border} ${rarityStyle.bg}`}>
          <BadgeArtwork
            rarity={rarityKey}
            iconKey={badge.icon_key || badge.icon || 'trophy'}
            locked={!unlocked}
            size={120}
            className="mx-auto"
          />
          <p className={`text-xs uppercase mt-3 tracking-wider ${rarityStyle.text}`}>
            {rarityStyle.label}
          </p>
          {!unlocked && (
            <div className="mt-3 space-y-2">
              {progressText ? <p className="text-zinc-400 text-sm">{progressText}</p> : null}
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-500 rounded-full"
                  style={{ width: `${Math.min(100, badge.progress || 0)}%` }}
                />
              </div>
              {badge.description && !isSecret ? (
                <p className="text-zinc-500 text-xs">{badge.description}</p>
              ) : null}
            </div>
          )}
          {unlocked && unlockedLabel ? (
            <p className="text-zinc-500 text-xs mt-3">Obtenu le {unlockedLabel}</p>
          ) : null}
        </div>

        {unlocked && canPublish ? (
          <div className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-xl bg-[#0A0A0A] border-white/10 text-white"
              placeholder={
                scope === 'duo'
                  ? 'Notre Duo vient de débloquer un nouveau succès !'
                  : 'J’ai débloqué un nouveau succès !'
              }
              data-testid="badge-publish-message"
            />
            <Button
              onClick={handlePublish}
              disabled={saving}
              className="w-full rounded-xl btn-primary text-white"
              data-testid="badge-publish-btn"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Share2 size={16} className="mr-2" />
                  {scope === 'duo' ? 'Publier sur le mur Duo' : 'Publier'}
                </>
              )}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function useBadgeDetail(scope = 'solo', { canPublish = true, pairKey = null, onShared } = {}) {
  const [selected, setSelected] = useState(null);
  const handleBadgeClick = (badge) => setSelected(badge);
  const dialog = (
    <BadgeDetailSheet
      badge={selected}
      open={Boolean(selected)}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
      scope={scope}
      canPublish={canPublish}
      pairKey={pairKey}
      onShared={(b) => {
        onShared?.(b);
        setSelected(null);
      }}
    />
  );
  return { handleBadgeClick, dialog, selected, setSelected };
}
