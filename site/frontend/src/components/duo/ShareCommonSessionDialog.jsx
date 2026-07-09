import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { postsApi, formatApiError } from '../../lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function ShareCommonSessionDialog({
  open,
  onOpenChange,
  mySession,
  partnerSession,
  duoProfile,
  onShared,
}) {
  const [postOnDuoWall, setPostOnDuoWall] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (!mySession?.id) return;
    setLoading(true);
    try {
      await postsApi.repost({
        workout_session_id: mySession.id,
        partner_session_id: partnerSession?.id,
        post_on_duo_wall: postOnDuoWall,
      });
      toast.success('Séance commune republiée');
      onShared?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-['Outfit']">Republier la séance commune</DialogTitle>
        </DialogHeader>
        <p className="text-zinc-400 text-sm">
          La republication apparaîtra dans l&apos;onglet Republications de ton profil.
        </p>
        {duoProfile ? (
          <label className="flex items-center gap-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={postOnDuoWall}
              onChange={(e) => setPostOnDuoWall(e.target.checked)}
              className="rounded border-white/20"
            />
            <span className="text-sm text-zinc-300">Publier aussi sur le mur duo</span>
          </label>
        ) : null}
        <Button
          type="button"
          onClick={handleShare}
          disabled={loading}
          className="w-full btn-primary text-white rounded-xl mt-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Republier'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
