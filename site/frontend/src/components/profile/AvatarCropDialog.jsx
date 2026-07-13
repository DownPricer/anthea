import { useEffect, useRef, useState } from 'react';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { cropSquareImage } from '../../lib/imageCrop';

const PREVIEW = 280;

export function AvatarCropDialog({ open, imageSrc, onOpenChange, onConfirm, confirming = false }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const imgRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [open, imageSrc]);

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
    if (!dragging || !imgRef.current) return;
    const scale = imgRef.current.naturalWidth / PREVIEW;
    const dx = (e.clientX - dragStart.current.x) * scale;
    const dy = (e.clientY - dragStart.current.y) * scale;
    setOffset({
      x: dragStart.current.ox - dx,
      y: dragStart.current.oy - dy,
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleConfirm = async () => {
    const result = await cropSquareImage(imageSrc, {
      zoom,
      offsetX: offset.x,
      offsetY: offset.y,
    });
    onConfirm?.(result);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white font-['Outfit']">Recadrer la photo</DialogTitle>
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
                className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                style={{
                  transform: `translate(calc(-50% + ${-offset.x / (imgRef.current?.naturalWidth || 1) * PREVIEW}px), calc(-50% + ${-offset.y / (imgRef.current?.naturalHeight || 1) * PREVIEW}px)) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              />
            ) : null}
          </div>

          <p className="text-zinc-500 text-xs text-center">
            Déplace l&apos;image et ajuste le zoom. Le résultat sera un avatar carré 512×512.
          </p>

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
