import { useState, useRef } from 'react';

import { Loader2, ImagePlus, Send } from 'lucide-react';

import { Button } from '../ui/button';

import { postsApi, uploadsApi, formatApiError } from '../../lib/api';

import { compressImageFile, revokePreviewUrl, blobToDataUrl } from '../../lib/imageCompress';

import { PostImageCropDialog } from '../social/PostImageCropDialog';
import { PostImageFrame } from '../social/PostImageFrame';

import { canSubmitDuoPost } from '../../lib/duoPostComposer';

import { toast } from 'sonner';



function uploadPathFromResponse(data) {

  if (data?.path) return data.path;

  const url = data?.url;

  if (!url) return null;

  const idx = url.indexOf('/uploads/');

  return idx >= 0 ? url.slice(idx) : url;

}



export function DuoPostComposer({ duoProfile, onPosted }) {

  const [content, setContent] = useState('');

  const [uploadedImagePath, setUploadedImagePath] = useState(null);

  const [preview, setPreview] = useState(null);

  const [uploading, setUploading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [cropOpen, setCropOpen] = useState(false);

  const [cropSrc, setCropSrc] = useState(null);

  const [pendingImageFile, setPendingImageFile] = useState(null);

  const fileRef = useRef(null);



  const isMember = !!duoProfile?.is_member;

  const pairKey = duoProfile?.pair_key || null;

  const canSubmit = canSubmitDuoPost(content, uploadedImagePath, isSubmitting, uploading);



  if (!isMember) return null;



  const handleImagePick = async (event) => {

    const file = event.target.files?.[0];

    if (!file) return;

    if (cropSrc) revokePreviewUrl(cropSrc);

    const src = URL.createObjectURL(file);

    setPendingImageFile(file);

    setCropSrc(src);

    setCropOpen(true);

    if (fileRef.current) fileRef.current.value = '';

  };



  const handleCropConfirm = async (cropResult) => {

    setUploading(true);

    try {

      const { blob, previewUrl } = await compressImageFile(cropResult.file);

      if (preview) revokePreviewUrl(preview);

      setPreview(previewUrl);

      const dataUrl = await blobToDataUrl(blob);

      const { data } = await uploadsApi.uploadImage(dataUrl, cropResult.file.name);

      const stored = uploadPathFromResponse(data);

      if (!stored) throw new Error('Réponse upload invalide');

      setUploadedImagePath(stored);

      setCropOpen(false);

      if (cropSrc) revokePreviewUrl(cropSrc);

      setCropSrc(null);

      setPendingImageFile(null);

      toast.success('Photo prête');

    } catch (error) {

      if (process.env.NODE_ENV === 'development') console.error('[duo post upload]', error);

      toast.error(error.message || 'Échec import image');

    } finally {

      setUploading(false);

    }

  };



  const handleSubmit = async (event) => {

    event?.preventDefault?.();

    const description = content.trim();

    if (!description && !uploadedImagePath) {

      toast.info('Ajoute un texte ou une photo');

      return;

    }

    if (!pairKey) {

      toast.error('Impossible d\'identifier le duo');

      return;

    }

    setIsSubmitting(true);

    try {

      const payload = {

        type: 'duo_free',

        title: description.slice(0, 120) || 'Publication duo',

        description: description || null,

        image_url: uploadedImagePath || null,

        visibility: 'duo',

        duo_id: pairKey,

        post_on_duo_wall: true,

      };

      if (process.env.NODE_ENV === 'development') {

        console.debug('[DuoPostComposer]', {

          contentLength: content?.trim()?.length,

          uploadedImagePath,

          isSubmitting: true,

          isMember,

          duoId: pairKey,

          pairKey,

          canSubmit,

          payload,

        });

      }

      const { data } = await postsApi.create(payload);

      const created = data?.post || data;

      if (process.env.NODE_ENV === 'development') console.debug('[duo post created]', created);

      setContent('');

      setUploadedImagePath(null);

      if (preview) revokePreviewUrl(preview);

      setPreview(null);

      toast.success('Publication envoyée sur le mur du duo');

      onPosted?.(created);

    } catch (error) {

      if (process.env.NODE_ENV === 'development') console.error('[duo post create error]', error);

      toast.error(formatApiError(error));

    } finally {

      setIsSubmitting(false);

    }

  };



  return (

    <>

    <form

      className="card p-4 space-y-3 border border-border"

      data-testid="duo-post-composer"

      onSubmit={handleSubmit}

    >

      <p className="text-muted text-xs uppercase tracking-wider">Publier sur le mur du duo</p>

      {!pairKey ? (

        <p className="text-amber-400 text-xs">Impossible d&apos;identifier le duo.</p>

      ) : null}

      <textarea

        value={content}

        onChange={(event) => setContent(event.target.value)}

        placeholder="Partagez un moment, une victoire..."

        className="flex min-h-[80px] w-full rounded-xl bg-background border border-border px-3 py-2 text-foreground text-sm placeholder:text-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--theme-primary)] disabled:opacity-50"

        maxLength={500}

        disabled={isSubmitting}

      />

      {preview ? (

        <div className="relative">

          <PostImageFrame src={preview} alt="" />

          <button

            type="button"

            onClick={() => {

              revokePreviewUrl(preview);

              setPreview(null);

              setUploadedImagePath(null);

            }}

            className="absolute top-2 right-2 text-xs bg-overlay text-foreground px-2 py-1 rounded-lg"

          >

            Retirer

          </button>

        </div>

      ) : null}

      {process.env.NODE_ENV === 'development' ? (

        <p className="text-[10px] text-subtle font-mono">

          debug: canSubmit={String(canSubmit)} len={content.trim().length} pairKey={pairKey || '—'}

        </p>

      ) : null}

      <div className="flex items-center gap-2">

        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImagePick} />

        <Button

          type="button"

          size="sm"

          variant="outline"

          disabled={uploading || isSubmitting}

          onClick={() => fileRef.current?.click()}

          className="rounded-xl border-border text-foreground"

        >

          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} className="mr-1" />}

          {uploading ? 'Importation…' : 'Photo'}

        </Button>

        <Button

          type="submit"

          size="sm"

          disabled={!canSubmit || !pairKey}

          className="rounded-xl btn-primary text-foreground ml-auto"

        >

          {isSubmitting ? (

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

    </form>

    <PostImageCropDialog
      open={cropOpen}
      imageSrc={cropSrc}
      originalFile={pendingImageFile}
      onOpenChange={(open) => {
        setCropOpen(open);
        if (!open) {
          if (cropSrc) revokePreviewUrl(cropSrc);
          setCropSrc(null);
          setPendingImageFile(null);
        }
      }}
      onConfirm={handleCropConfirm}
      confirming={uploading}
    />

    </>

  );

}

