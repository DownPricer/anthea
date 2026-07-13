import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { cropSquareImage, computeCropSourceRect, DEFAULT_VIEWPORT } from '../../lib/imageCrop';

const PREVIEW = DEFAULT_VIEWPORT;

export function AvatarCropDialog({
  open,
  imageSrc,
  originalFile = null,
  onOpenChange,
  onConfirm,
  confirming = false,
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const cropStateRef = useRef({ zoom: 1, offset: { x: 0, y: 0 } });
  const imgRef = useRef(null);
  const confirmBtnRef = useRef(null);

  cropStateRef.current = { zoom, offset };

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ w: 0, h: 0 });
    setGenerating(false);
  }, [open, imageSrc]);

  const getFinalScale = useCallback((nw, nh, z) => {
    const baseScale = Math.max(PREVIEW / nw, PREVIEW / nh);
    return baseScale * z;
  }, []);

  const handleImageLoad = () => {
    if (!imgRef.current) return;
    setNaturalSize({
      w: imgRef.current.naturalWidth,
      h: imgRef.current.naturalHeight,
    });
  };

  const handlePointerDown = (e) => {
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragging || !naturalSize.w) return;
    const finalScale = getFinalScale(naturalSize.w, naturalSize.h, zoom);
    const dx = (e.clientX - dragStart.current.x) / finalScale;
    const dy = (e.clientY - dragStart.current.y) / finalScale;
    setOffset({
      x: dragStart.current.ox - dx,
      y: dragStart.current.oy - dy,
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleConfirm = async () => {
    const { zoom: z, offset: o } = cropStateRef.current;

    if (process.env.NODE_ENV === 'development') {
      console.debug('[AvatarCrop Confirm]', {
        zoom: z,
        offsetX: o.x,
        offsetY: o.y,
        pendingAvatarFileName: originalFile?.name,
      });
    }

    setGenerating(true);
    try {
      const result = await cropSquareImage(imageSrc, {
        zoom: z,
        offsetX: o.x,
        offsetY: o.y,
        viewportSize: PREVIEW,
      });

      if (process.env.NODE_ENV === 'development') {
        console.debug('[AvatarCrop File]', {
          name: result.file?.name,
          type: result.file?.type,
          size: result.file?.size,
          width: result.width,
          height: result.height,
          isOriginal: result.file === originalFile,
        });
      }

      if (!result.file || result.file.size <= 0 || result.file.type !== 'image/webp') {
        throw new Error('Fichier recadré invalide');
      }
      if (result.file === originalFile) {
        throw new Error('Le fichier recadré ne doit pas être l\'original');
      }

      await onConfirm?.(result);
    } catch (error) {
      console.error('[AvatarCrop Generation Error]', error);
      toast.error('Impossible de recadrer cette photo.');
    } finally {
      setGenerating(false);
    }
  };

  const nw = naturalSize.w || 1;
  const nh = naturalSize.h || 1;
  const finalScale = getFinalScale(nw, nh, zoom);
  const scaledW = nw * finalScale;
  const scaledH = nh * finalScale;
  const imgLeft = PREVIEW / 2 - scaledW / 2 - offset.x * finalScale;
  const imgTop = PREVIEW / 2 - scaledH / 2 - offset.y * finalScale;
  const busy = confirming || generating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#141414] border-white/10 max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          confirmBtnRef.current?.focus?.();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-white font-['Outfit']">Recadrer la photo</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Déplacez et zoomez l&apos;image avant de l&apos;enregistrer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative rounded-full overflow-hidden border-2 border-white/15 bg-black touch-none select-none"
            style={{ width: PREVIEW, height: PREVIEW }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {imageSrc ? (
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Aperçu"
                draggable={false}
                onLoad={handleImageLoad}
                className="absolute max-w-none pointer-events-none"
                style={{
                  width: scaledW,
                  height: scaledH,
                  left: imgLeft,
                  top: imgTop,
                }}
              />
            ) : null}
          </div>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <ZoomOut size={16} className="text-zinc-500 shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--theme-primary)]"
            />
            <ZoomIn size={16} className="text-zinc-500 shrink-0" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-white/15 text-white"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Annuler
          </Button>
          <Button
            ref={confirmBtnRef}
            type="button"
            className="rounded-xl btn-primary text-white"
            onClick={handleConfirm}
            disabled={busy || !imageSrc}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Valider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { computeCropSourceRect, PREVIEW as CROP_VIEWPORT };
