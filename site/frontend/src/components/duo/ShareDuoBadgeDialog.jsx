import { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { postsApi, formatApiError } from '../../lib/api';
import { getBadgeRarityStyle } from '../../lib/badgeStyles';
import { toast } from 'sonner';

export function ShareDuoBadgeDialog({ badge, open, onOpenChange, onShared }) {
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (!badge) return null;

  const rarityStyle = getBadgeRarityStyle(badge.rarity);

  const handleShare = async () => {
    setSaving(true);
    try {
      await postsApi.create({
        type: 'duo_badge',
        badge_id: badge.id,
        description: description.trim() || null,
        visibility: 'public',
      });
      toast.success('Badge publié sur le mur duo');
      onShared?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/10 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Publier sur le mur duo</DialogTitle>
        </DialogHeader>
        <div className={`rounded-2xl border p-4 text-center ${rarityStyle.border} ${rarityStyle.bg}`}>
          <p className={`text-xs uppercase ${rarityStyle.text}`}>{rarityStyle.label}</p>
          <p className="text-white font-semibold mt-2">{badge.name}</p>
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl bg-[#0A0A0A] border-white/10 text-white"
          placeholder="Message facultatif..."
        />
        <Button onClick={handleShare} disabled={saving} className="w-full rounded-xl btn-primary text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <><Share2 size={16} className="mr-2" /> Publier sur le mur duo</>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function ShareDuoBadgeButton({ badge, className = '', onShared }) {
  const [open, setOpen] = useState(false);
  if (!badge?.unlocked) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-violet-300 hover:underline text-xs ${className}`}
      >
        Mur duo
      </button>
      <ShareDuoBadgeDialog
        badge={badge}
        open={open}
        onOpenChange={setOpen}
        onShared={onShared}
      />
    </>
  );
}
