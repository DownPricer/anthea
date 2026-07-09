import { useState, useRef } from 'react';
import { Loader2, ImagePlus, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { postsApi, uploadsApi, formatApiError, resolveMediaUrl } from '../../lib/api';
import { compressImageFile, revokePreviewUrl, blobToDataUrl } from '../../lib/imageCompress';
import { toast } from 'sonner';

export function DuoPostComposer({ duoProfile, onPosted }) {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  if (!duoProfile?.is_member) return null;

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { blob, previewUrl } = await compressImageFile(file);
      setPreview(previewUrl);
      const dataUrl = await blobToDataUrl(blob);
      const { data } = await uploadsApi.uploadImage(dataUrl, file.name);
      const stored = data.path || data.url;
      setImageUrl(stored);
      toast.success('Photo prête');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('[duo post upload]', error);
      toast.error(error.message || 'Échec import image');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    const description = text.trim();
    if (!description && !imageUrl) {
      toast.info('Ajoute un texte ou une photo');
      return;
    }
    setPosting(true);
    try {
      const payload = {
        type: 'duo_free',
        title: description.slice(0, 120) || 'Publication duo',
        description: description || null,
        image_url: imageUrl || null,
        visibility: 'public',
        duo_id: duoProfile.id,
        post_on_duo_wall: true,
      };
      if (process.env.NODE_ENV === 'development') console.debug('[duo post create]', payload);
      const { data } = await postsApi.create(payload);
      if (process.env.NODE_ENV === 'development') console.debug('[duo post created]', data);
      setText('');
      setImageUrl(null);
      if (preview) revokePreviewUrl(preview);
      setPreview(null);
      toast.success('Publication ajoutée au mur duo');
      onPosted?.(data);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('[duo post create error]', error);
      toast.error(formatApiError(error));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="card p-4 space-y-3 border border-white/10" data-testid="duo-post-composer">
      <p className="text-zinc-400 text-xs uppercase tracking-wider">Publier sur le mur du duo</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Partagez un moment, une victoire..."
        className="min-h-[80px] rounded-xl bg-[#0A0A0A] border-white/10 text-white"
        maxLength={500}
        disabled={posting}
      />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10">
          <img src={preview} alt="" className="w-full max-h-48 object-cover" />
          <button
            type="button"
            onClick={() => {
              revokePreviewUrl(preview);
              setPreview(null);
              setImageUrl(null);
            }}
            className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded-lg"
          >
            Retirer
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading || posting}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border-white/15 text-white"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} className="mr-1" />}
          Photo
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={posting || uploading}
          onClick={handleSubmit}
          className="rounded-xl btn-primary text-white ml-auto"
        >
          {posting ? (
            <>
              <Loader2 size={14} className="animate-spin mr-1" /> Publication…
            </>
          ) : (
            <>
              <Send size={14} className="mr-1" /> Publier
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
