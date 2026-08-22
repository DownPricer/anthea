import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
import {
  cropRectImage,
  computeCropSourceRect,
  POST_VIEWPORT_WIDTH,
  POST_VIEWPORT_HEIGHT,
} from '../../lib/imageCrop';

const VIEWPORT_W = POST_VIEWPORT_WIDTH;
const VIEWPORT_H = POST_VIEWPORT_HEIGHT;

export function PostImageCropDialog({
  open,
  imageSrc,
  originalFile = null,
  onOpenChange,
  onConfirm,
  confirming = false,
}) {
  const { t } = useTranslation(['common', 'profile']);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const cropStateRef = useRef({ zoom: 1, offset: { x: 0, y: 0 } });
  const imgRef = useRef(null);

  cropStateRef.current = { zoom, offset };

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ w: 0, h: 0 });
    setGenerating(false);
  }, [open, imageSrc]);

  const getFinalScale = useCallback((nw, nh, z) => {
    const baseScale = Math.max(VIEWPORT_W / nw, VIEWPORT_H / nh);
    return baseScale * z;
  }, []);

  const handleImageLoad = () => {
    if (!imgRef.current) return;
    setNaturalSize({
      w: imgRef.current.naturalWidth,
      h: imgRef.current.naturalHeight,
    });
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
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
    setGenerating(true);
    try {
      const result = await cropRectImage(imageSrc, {
        zoom: z,
        offsetX: o.x,
        offsetY: o.y,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
      });
      if (!result.file || result.file.size <= 0) {
        throw new Error('Fichier recadré invalide');
      }
      await onConfirm?.(result);
    } catch (error) {
      console.error('[PostImageCrop]', error);
      toast.error(t('profile:photoImportFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const nw = naturalSize.w || 1;
  const nh = naturalSize.h || 1;
  const finalScale = getFinalScale(nw, nh, zoom);
  const scaledW = nw * finalScale;
  const scaledH = nh * finalScale;
  const imgLeft = VIEWPORT_W / 2 - scaledW / 2 - offset.x * finalScale;
  const imgTop = VIEWPORT_H / 2 - scaledH / 2 - offset.y * finalScale;
  const busy = confirming || generating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-elevated border-border max-w-md w-[calc(100vw-1.5rem)]">
        <DialogHeader>
          <DialogTitle className="text-foreground font-['Outfit']">
            {t('profile:cropPostTitle', { defaultValue: 'Recadrer la photo' })}
          </DialogTitle>
          <DialogDescription className="text-subtle">
            {t('profile:cropPostHint', { defaultValue: 'Déplacez et zoomez avant publication.' })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative rounded-xl overflow-hidden border-2 border-border bg-background touch-none select-none mx-auto"
            style={{ width: VIEWPORT_W, height: VIEWPORT_H, maxWidth: '100%' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {imageSrc ? (
              <img
                ref={imgRef}
                src={imageSrc}
                alt={t('profile:cropPostPreviewAlt', { defaultValue: 'Aperçu recadrage' })}
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
            <ZoomOut size={16} className="text-subtle shrink-0" aria-hidden />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--theme-primary)] min-h-10"
              aria-label={t('profile:cropZoom', { defaultValue: 'Zoom' })}
            />
            <ZoomIn size={16} className="text-subtle shrink-0" aria-hidden />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-border text-foreground"
            onClick={handleReset}
            disabled={busy}
          >
            <RotateCcw size={14} className="mr-1.5" />
            {t('profile:cropReset', { defaultValue: 'Réinitialiser' })}
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-border text-foreground w-full sm:w-auto min-h-11"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="button"
            className="rounded-xl btn-primary text-foreground w-full sm:w-auto min-h-11"
            onClick={handleConfirm}
            disabled={busy || !imageSrc}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('profile:cropConfirm', { defaultValue: 'Valider' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { computeCropSourceRect, VIEWPORT_W as POST_CROP_VIEWPORT_W, VIEWPORT_H as POST_CROP_VIEWPORT_H };
