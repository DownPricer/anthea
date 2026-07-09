import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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
import { DUO_RELATION_OPTIONS } from '../../lib/duoProfile';
import { duoApi, formatApiError } from '../../lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function DuoProfileEditDialog({ open, onOpenChange, duoProfile, onSaved }) {
  const [name, setName] = useState(duoProfile?.name || '');
  const [relationType, setRelationType] = useState(duoProfile?.relation_type || 'partners');
  const [visibility, setVisibility] = useState(duoProfile?.account_visibility || 'private');
  const [showStats, setShowStats] = useState(!!duoProfile?.show_stats);
  const [showBadges, setShowBadges] = useState(duoProfile?.show_badges !== false);
  const [showActivity, setShowActivity] = useState(!!duoProfile?.show_recent_activity);
  const [showPosts, setShowPosts] = useState(!!duoProfile?.show_posts);
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen) => {
    if (isOpen && duoProfile) {
      setName(duoProfile.name || '');
      setRelationType(duoProfile.relation_type || 'partners');
      setVisibility(duoProfile.account_visibility || 'private');
      setShowStats(!!duoProfile.show_stats);
      setShowBadges(duoProfile.show_badges !== false);
      setShowActivity(!!duoProfile.show_recent_activity);
      setShowPosts(!!duoProfile.show_posts);
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await duoApi.updateProfile({
        name: name.trim(),
        relation_type: relationType,
        account_visibility: visibility,
        show_stats: showStats,
        show_badges: showBadges,
        show_recent_activity: showActivity,
        show_posts: showPosts,
      });
      toast.success('Profil duo mis à jour');
      onSaved?.(data);
      onOpenChange(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="bg-[#141414] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-['Outfit']">Modifier le duo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-zinc-400">Nom du duo</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
              placeholder="Les Guerriers"
            />
            {duoProfile?.tag ? (
              <p className="text-zinc-600 text-xs mt-1 font-mono">
                Identifiant : {duoProfile.tag}
              </p>
            ) : null}
          </div>

          <div>
            <Label className="text-zinc-400">Type de relation</Label>
            <Select value={relationType} onValueChange={setRelationType}>
              <SelectTrigger className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                {DUO_RELATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-white">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-zinc-400">Visibilité</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="mt-2 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                <SelectItem value="public" className="text-white">Public</SelectItem>
                <SelectItem value="private" className="text-white">Privé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <p className="text-zinc-500 text-xs uppercase tracking-wider">Confidentialité duo</p>
            <ToggleRow label="Afficher les stats communes" checked={showStats} onChange={setShowStats} />
            <ToggleRow label="Afficher les badges duo" checked={showBadges} onChange={setShowBadges} />
            <ToggleRow label="Afficher l'activité récente" checked={showActivity} onChange={setShowActivity} />
            <ToggleRow label="Afficher le mur duo" checked={showPosts} onChange={setShowPosts} />
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || name.trim().length < 2}
            className="w-full btn-primary text-white rounded-xl"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <span className="text-sm text-zinc-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-white/20"
      />
    </label>
  );
}
