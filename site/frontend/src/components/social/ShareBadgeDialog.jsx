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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { postsApi, formatApiError } from '../../lib/api';
import { getBadgeRarityStyle } from '../../lib/badgeStyles';
import { toast } from 'sonner';

export function ShareBadgeDialog({ badge, open, onOpenChange, onShared }) {
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);

  if (!badge) return null;

  const rarityStyle = getBadgeRarityStyle(badge.rarity);

  const handleShare = async () => {
    setSaving(true);
    try {
      await postsApi.create({
        type: 'badge',
        badge_id: badge.id,
        description: description.trim() || null,
        visibility,
      });
      toast.success('Badge partagé sur ton profil');
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
          <DialogTitle className="text-white">Partager ce badge</DialogTitle>
        </DialogHeader>

        <div
          className={`rounded-2xl border p-4 text-center ${rarityStyle.border} ${rarityStyle.bg}`}
        >
          <p className={`text-xs uppercase ${rarityStyle.text}`}>{rarityStyle.label}</p>
          <p className="text-white font-semibold mt-2">{badge.name}</p>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-zinc-400 text-sm">Message (facultatif)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
              placeholder="Fierté du moment..."
            />
          </div>
          <div>
            <Label className="text-zinc-400 text-sm">Visibilité</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="mt-1.5 h-10 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                <SelectItem value="public" className="text-white">Public</SelectItem>
                <SelectItem value="friends" className="text-white">Amis mutuels</SelectItem>
                <SelectItem value="private" className="text-white">Privé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleShare}
            disabled={saving}
            className="w-full h-11 rounded-xl btn-primary text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                <Share2 size={16} className="mr-2" /> Publier
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShareBadgeButton({ badge, className = '' }) {
  const [open, setOpen] = useState(false);

  if (!badge?.unlocked) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-[var(--theme-primary)] hover:underline text-xs ${className}`}
      >
        Partager
      </button>
      <ShareBadgeDialog badge={badge} open={open} onOpenChange={setOpen} />
    </>
  );
}
