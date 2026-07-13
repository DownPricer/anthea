import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';
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
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const cropStateRef = useRef({ zoom: 1, offset: { x: 0, y: 0 } });
  const imgRef = useRef(null);

  cropStateRef.current = { zoom, offset };

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ w: 0, h: 0 });
  }, [open, imageSrc]);

  const getFinalScale = useCallback(
    (nw, nh, z) => {
      const baseScale = Math.max(PREVIEW / nw, PREVIEW / nh);
      return baseScale * z;
    },
    []
  );

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
    const result = await cropSquareImage(imageSrc, {
      zoom: z,
      offsetX: o.x,
      offsetY: o.y,
      viewportSize: PREVIEW,
    });

    if (process.env.NODE_ENV === 'development') {
      console.debug('[AvatarUpload]', {
        uploadedName: result.file?.name,
        uploadedType: result.file?.type,
        uploadedSize: result.file?.size,
        isOriginalFile: result.file === originalFile,
      });
    }

    await onConfirm?.(result);
  };

  const nw = naturalSize.w || 1;
  const nh = naturalSize.h || 1;
  const finalScale = getFinalScale(nw, nh, zoom);
  const scaledW = nw * finalScale;
  const scaledH = nh * finalScale;
  const imgLeft = PREVIEW / 2 - scaledW / 2 - offset.x * finalScale;
  const imgTop = PREVIEW / 2 - scaledH / 2 - offset.y * finalScale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white font-['Outfit']">Recadrer la photo</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Déplace et zoome l&apos;image. Le résultat sera un avatar carré 512×512.
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
            disabled={confirming}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="rounded-xl btn-primary text-white"
            onClick={handleConfirm}
            disabled={confirming || !imageSrc}
          >
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Valider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { computeCropSourceRect, PREVIEW as CROP_VIEWPORT };
