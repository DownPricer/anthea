import { useState } from 'react';
import { Share2, Loader2, Lock } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { postsApi, formatApiError } from '../../lib/api';
import { getBadgeRarityStyle } from '../../lib/badgeStyles';
import { toast } from 'sonner';

/**
 * Fiche badge Duo : progression si verrouillé, publication si débloqué.
 */
export function ShareDuoBadgeDialog({ badge, open, onOpenChange, onShared }) {
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (!badge) return null;

  const unlocked = Boolean(badge.unlocked);
  const rarityStyle = getBadgeRarityStyle(badge.rarity);

  const handleShare = async () => {
    if (!unlocked) return;
    setSaving(true);
    try {
      await postsApi.create({
        type: 'duo_badge',
        badge_id: badge.id,
        description: description.trim() || 'Nous avons débloqué un nouveau badge !',
        visibility: 'public',
        post_on_duo_wall: true,
      });
      toast.success('Badge publié sur le mur Duo');
      onShared?.(badge);
      setDescription('');
      onOpenChange(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/10 max-w-sm" data-testid="duo-badge-detail">
        <DialogHeader>
          <DialogTitle className="text-white">
            {unlocked ? badge.name : 'Badge verrouillé'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            {badge.description || (unlocked ? 'Badge Duo débloqué' : 'Continuez pour le débloquer')}
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-2xl border p-4 text-center ${rarityStyle.border} ${rarityStyle.bg}`}>
          <p className={`text-xs uppercase ${rarityStyle.text}`}>{rarityStyle.label}</p>
          <p className="text-white font-semibold mt-2">{badge.name}</p>
          {!unlocked ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-center gap-1 text-zinc-500 text-xs">
                <Lock size={12} /> Verrouillé
              </div>
              {(badge.target || 0) > 0 ? (
                <>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-500 rounded-full"
                      style={{ width: `${Math.min(100, badge.progress || 0)}%` }}
                    />
                  </div>
                  <p className="text-zinc-500 text-xs">
                    {badge.current ?? 0}/{badge.target}
                    {badge.condition ? ` · ${badge.condition}` : ''}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {unlocked ? (
          <>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl bg-[#0A0A0A] border-white/10 text-white"
              placeholder="Nous avons débloqué un nouveau badge !"
              data-testid="duo-badge-publish-message"
            />
            <Button
              onClick={handleShare}
              disabled={saving}
              className="w-full rounded-xl btn-primary text-white"
              data-testid="duo-badge-publish-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <><Share2 size={16} className="mr-2" /> Publier sur le mur Duo</>
              )}
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Hook-like helper state for badge click → dialog */
export function useDuoBadgePublish(onShared) {
  const [selected, setSelected] = useState(null);
  const handleBadgeClick = (badge) => setSelected(badge);
  const dialog = (
    <ShareDuoBadgeDialog
      badge={selected}
      open={Boolean(selected)}
      onOpenChange={(open) => { if (!open) setSelected(null); }}
      onShared={(b) => {
        onShared?.(b);
        setSelected(null);
      }}
    />
  );
  return { handleBadgeClick, dialog, selected };
}
