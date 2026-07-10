import { useState, useRef } from 'react';

import {

  Dialog,

  DialogContent,

  DialogHeader,

  DialogTitle,

  DialogDescription,

} from '../ui/dialog';

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

import { Loader2, Camera, Share2, X } from 'lucide-react';

import { postsApi, uploadsApi, formatApiError, resolveMediaUrl } from '../../lib/api';

import { compressImageFile, revokePreviewUrl, blobToDataUrl } from '../../lib/imageCompress';

import { toast } from 'sonner';



export function ShareWorkoutDialog({

  open,

  onOpenChange,

  session,

  onShared,

  onSkip,

}) {

  const [title, setTitle] = useState(session?.workout_title || '');

  const [description, setDescription] = useState('');

  const [imageUrl, setImageUrl] = useState('');

  const [imagePreview, setImagePreview] = useState(null);

  const [visibility, setVisibility] = useState('public');

  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);



  const publish = async (withPhoto) => {

    if (!session?.id) return;

    setSaving(true);

    try {

      await postsApi.create({

        type: withPhoto && imageUrl ? 'workout_photo' : 'workout',

        title: title.trim() || null,

        description: description.trim() || null,

        image_url: withPhoto ? imageUrl || null : null,

        workout_session_id: session.id,

        visibility,

      });

      toast.success('Publication partagée sur ton profil');

      revokePreviewUrl(imagePreview);

      onShared?.();

      onOpenChange(false);

    } catch (error) {

      toast.error(formatApiError(error));

    } finally {

      setSaving(false);

    }

  };



  const handleImagePick = async (event) => {

    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {

      const { blob, previewUrl } = await compressImageFile(file);

      setImagePreview(previewUrl);

      const dataUrl = await blobToDataUrl(blob);

      const { data } = await uploadsApi.uploadImage(dataUrl, file.name);

      const stored = data?.path || (data?.url?.includes('/uploads/') ? data.url.slice(data.url.indexOf('/uploads/')) : null);

      setImageUrl(stored || resolveMediaUrl(data.url) || data.url);

      toast.success('Photo prête');

    } catch (error) {

      toast.error(error.message || 'Import photo échoué');

    } finally {

      setUploading(false);

      if (fileInputRef.current) fileInputRef.current.value = '';

    }

  };



  return (

    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="bg-[#141414] border-white/10 max-w-md">

        <DialogHeader>

          <DialogTitle className="text-white font-['Outfit']">Partager ta séance</DialogTitle>

          <DialogDescription className="text-zinc-400">

            Publie sur ton mur avec ou sans photo. Les stats de la séance seront affichées.

          </DialogDescription>

        </DialogHeader>



        <div className="space-y-4">

          <div>

            <Label className="text-zinc-400 text-sm">Titre (facultatif)</Label>

            <Input

              value={title}

              onChange={(e) => setTitle(e.target.value)}

              placeholder={session?.workout_title || 'Ma séance'}

              className="mt-1.5 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white"

            />

          </div>



          <div>

            <Label className="text-zinc-400 text-sm">Description (facultative)</Label>

            <Textarea

              value={description}

              onChange={(e) => setDescription(e.target.value)}

              placeholder="Comment s'est passée la séance ?"

              className="mt-1.5 rounded-xl bg-[#0A0A0A] border-white/10 text-white min-h-[80px]"

            />

          </div>



          <div>

            <Label className="text-zinc-400 text-sm flex items-center gap-1.5">

              <Camera size={14} /> Photo (facultatif)

            </Label>

            <input

              ref={fileInputRef}

              type="file"

              accept="image/jpeg,image/png,image/webp"

              className="hidden"

              onChange={handleImagePick}

            />

            <div className="mt-2 flex flex-wrap items-center gap-2">

              <Button

                type="button"

                variant="outline"

                disabled={uploading}

                onClick={() => fileInputRef.current?.click()}

                className="rounded-xl border-white/15 text-white"

              >

                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Importer une photo'}

              </Button>

              {imageUrl ? (

                <button

                  type="button"

                  onClick={() => {

                    revokePreviewUrl(imagePreview);

                    setImagePreview(null);

                    setImageUrl('');

                  }}

                  className="text-zinc-500 text-xs hover:text-red-400 flex items-center gap-1"

                >

                  <X size={12} /> Retirer

                </button>

              ) : null}

            </div>

            {imagePreview ? (

              <img

                src={imagePreview}

                alt="Aperçu"

                className="mt-3 w-full max-h-40 object-cover rounded-xl border border-white/10"

              />

            ) : null}

          </div>



          <div>

            <Label className="text-zinc-400 text-sm">Visibilité</Label>

            <Select value={visibility} onValueChange={setVisibility}>

              <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-[#0A0A0A] border-white/10 text-white">

                <SelectValue />

              </SelectTrigger>

              <SelectContent className="bg-[#141414] border-white/10">

                <SelectItem value="public" className="text-white">Public</SelectItem>

                <SelectItem value="friends" className="text-white">Amis mutuels</SelectItem>

                <SelectItem value="private" className="text-white">Privé (moi seul)</SelectItem>

              </SelectContent>

            </Select>

          </div>



          <div className="flex flex-col gap-2 pt-2">

            <Button

              onClick={() => publish(!!imageUrl)}

              disabled={saving || uploading}

              className="w-full h-12 rounded-xl btn-primary text-white"

            >

              {saving ? (

                <Loader2 className="w-5 h-5 animate-spin" />

              ) : (

                <>

                  <Share2 size={18} className="mr-2" />

                  {imageUrl ? 'Publier avec photo' : 'Publier la séance'}

                </>

              )}

            </Button>

            <Button

              variant="outline"

              onClick={() => {

                onSkip?.();

                onOpenChange(false);

              }}

              disabled={saving}

              className="w-full h-11 rounded-xl bg-white/5 border-white/10 text-zinc-400"

            >

              Passer

            </Button>

          </div>

        </div>

      </DialogContent>

    </Dialog>

  );

}


