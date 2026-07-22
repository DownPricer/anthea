import { useMemo, useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { resolveBadgeLabels } from '../../i18n/badgeLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

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
  const { t } = useTranslation('badges');
  const { formatDate } = useLocaleFormat();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const unlocked = Boolean(badge?.unlocked);
  const rarityKey = normalizeBadgeRarityKey(badge?.rarity_key || badge?.rarity);
  const rarityStyle = getBadgeRarityStyle(badge?.rarity);
  const { name, description, isSecret } = resolveBadgeLabels(badge, t);

  const placeholderMessage = useMemo(() => {
    if (scope === 'duo') return t('sharing.duoDefaultMessage');
    return t('sharing.defaultMessage');
  }, [scope, t]);

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
            message.trim() || t('sharing.duoDefaultMessageWithName', { badgeName: name }),
          visibility: 'public',
          post_on_duo_wall: true,
        });
        toast.success(t('published'));
      } else {
        await postsApi.create({
          type: 'badge',
          badge_id: badge.id,
          description: message.trim() || t('sharing.defaultMessageWithName', { badgeName: name }),
          visibility: 'public',
        });
        toast.success(t('published'));
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

  const unlockedLabel = badge.unlocked_at || badge.progress_detail?.unlocked_at
    ? formatDate(badge.unlocked_at || badge.progress_detail?.unlocked_at)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-surface-elevated border-border max-w-sm max-h-[90vh] overflow-y-auto"
        data-testid="badge-detail-sheet"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">{name}</DialogTitle>
          <DialogDescription className="text-subtle">
            {description || (unlocked ? t('unlocked') : t('keepGoing'))}
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
              {progressText ? <p className="text-muted text-sm">{progressText}</p> : null}
              <div className="h-1.5 bg-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-500 rounded-full"
                  style={{ width: `${Math.min(100, badge.progress || 0)}%` }}
                />
              </div>
              {badge.description && !isSecret ? (
                <p className="text-subtle text-xs">{description}</p>
              ) : null}
            </div>
          )}
          {unlocked && unlockedLabel ? (
            <p className="text-subtle text-xs mt-3">{t('obtainedOn', { date: unlockedLabel })}</p>
          ) : null}
        </div>

        {unlocked && canPublish ? (
          <div className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-xl bg-background border-border text-foreground"
              placeholder={placeholderMessage}
              data-testid="badge-publish-message"
            />
            <Button
              onClick={handlePublish}
              disabled={saving}
              className="w-full rounded-xl btn-primary text-foreground"
              data-testid="badge-publish-btn"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Share2 size={16} className="mr-2" />
                  {scope === 'duo' ? t('publishDuo') : t('publish')}
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
