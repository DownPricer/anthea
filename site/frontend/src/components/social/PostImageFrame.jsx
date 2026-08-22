import { cn } from '../../lib/utils';
import { POST_IMAGE_ASPECT_CLASS } from '../../lib/postImageAspect';

/**
 * Cadre 4:5 sans second recadrage — object-contain préserve le cadrage validé
 * et affiche les anciennes images sans déformation (letterbox si besoin).
 */
export function PostImageFrame({ src, alt = '', className, onError }) {
  if (!src) return null;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-xl border border-border bg-overlay',
        POST_IMAGE_ASPECT_CLASS,
        className
      )}
      data-testid="post-image-frame"
    >
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
        loading="lazy"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onError={onError}
      />
    </div>
  );
}
