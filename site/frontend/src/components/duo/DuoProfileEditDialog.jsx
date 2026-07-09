import { useState, useRef, useEffect } from 'react';

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

import { duoApi, uploadsApi, formatApiError, resolveMediaUrl } from '../../lib/api';

import { compressImageFile, revokePreviewUrl, blobToDataUrl } from '../../lib/imageCompress';

import { toast } from 'sonner';

import { Loader2, ImagePlus, Bell } from 'lucide-react';



export function DuoProfileEditDialog({ open, onOpenChange, duoProfile, onSaved }) {

  const [name, setName] = useState(duoProfile?.name || '');

  const [relationType, setRelationType] = useState(duoProfile?.relation_type || 'partners');

  const [visibility, setVisibility] = useState(duoProfile?.account_visibility || 'private');

  const [showStats, setShowStats] = useState(!!duoProfile?.show_stats);

  const [showBadges, setShowBadges] = useState(duoProfile?.show_badges !== false);

  const [showActivity, setShowActivity] = useState(!!duoProfile?.show_recent_activity);

  const [showPosts, setShowPosts] = useState(!!duoProfile?.show_posts);

  const [showChallenges, setShowChallenges] = useState(duoProfile?.show_challenges !== false);

  const [bannerUrl, setBannerUrl] = useState(duoProfile?.banner_url || '');

  const [bannerPreview, setBannerPreview] = useState(null);

  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [saving, setSaving] = useState(false);

  const bannerInputRef = useRef(null);



  const handleOpen = (isOpen) => {

    if (isOpen && duoProfile) {

      setName(duoProfile.name || '');

      setRelationType(duoProfile.relation_type || 'partners');

      setVisibility(duoProfile.account_visibility || 'private');

      setShowStats(!!duoProfile.show_stats);

      setShowBadges(duoProfile.show_badges !== false);

      setShowActivity(!!duoProfile.show_recent_activity);

      setShowPosts(!!duoProfile.show_posts);

      setShowChallenges(duoProfile.show_challenges !== false);

      setBannerUrl(duoProfile.banner_url || '');

      setBannerPreview(null);

    }

    onOpenChange(isOpen);

  };



  useEffect(() => () => revokePreviewUrl(bannerPreview), [bannerPreview]);



  const handleBannerPick = async (event) => {

    const file = event.target.files?.[0];

    if (!file) return;

    setUploadingBanner(true);

    try {

      const { blob, previewUrl } = await compressImageFile(file);

      setBannerPreview(previewUrl);

      const dataUrl = await blobToDataUrl(blob);

      const { data } = await uploadsApi.uploadImage(dataUrl, file.name);

      setBannerUrl(resolveMediaUrl(data.url) || data.url);

      toast.success('Bannière importée');

    } catch (error) {

      toast.error(error.message || 'Échec import bannière');

    } finally {

      setUploadingBanner(false);

      if (bannerInputRef.current) bannerInputRef.current.value = '';

    }

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

        show_challenges: showChallenges,

        banner_url: bannerUrl.trim() || null,

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



  const bannerDisplay = bannerPreview || resolveMediaUrl(bannerUrl);



  return (

    <Dialog open={open} onOpenChange={handleOpen}>

      <DialogContent className="bg-[#141414] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">

        <DialogHeader>

          <DialogTitle className="font-['Outfit']">Modifier le duo</DialogTitle>

        </DialogHeader>



        <div className="space-y-4 mt-2">

          <div>

            <Label className="text-zinc-400">Bannière</Label>

            <div

              className="mt-2 h-24 rounded-xl border border-white/10 overflow-hidden relative"

              style={

                bannerDisplay

                  ? { backgroundImage: `url(${bannerDisplay})`, backgroundSize: 'cover', backgroundPosition: 'center' }

                  : { background: 'linear-gradient(135deg, #1a1a2e, #0A0A0A)' }

              }

            >

              {!bannerDisplay ? (

                <p className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">

                  Aucune bannière

                </p>

              ) : null}

            </div>

            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerPick} />

            <div className="flex gap-2 mt-2">

              <Button

                type="button"

                size="sm"

                variant="outline"

                disabled={uploadingBanner}

                onClick={() => bannerInputRef.current?.click()}

                className="rounded-xl border-white/15 text-white"

              >

                {uploadingBanner ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} className="mr-1" />}

                Importer

              </Button>

              {bannerUrl ? (

                <Button

                  type="button"

                  size="sm"

                  variant="ghost"

                  onClick={() => { setBannerUrl(''); setBannerPreview(null); }}

                  className="text-zinc-400"

                >

                  Retirer

                </Button>

              ) : null}

            </div>

          </div>



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

            <ToggleRow label="Afficher les défis de la semaine" checked={showChallenges} onChange={setShowChallenges} />

          </div>



          <div className="rounded-xl border border-dashed border-white/15 p-3">

            <div className="flex items-center gap-2 text-zinc-400 text-sm">

              <Bell size={14} />

              <span>Demandes duo</span>

            </div>

            <p className="text-zinc-600 text-xs mt-2">

              Les demandes de suivi et d&apos;accès au profil duo seront gérées ici prochainement.

            </p>

          </div>



          <Button

            type="button"

            onClick={handleSave}

            disabled={saving || name.trim().length < 2 || uploadingBanner}

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

