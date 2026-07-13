const AVATAR_SIZE = 512;
const OUTPUT_MIME = 'image/webp';
const DEFAULT_VIEWPORT = 280;

/**
 * Calcule le rectangle source (repère image naturelle) pour un viewport carré.
 * Même formule que le preview CSS (cover + zoom + offset).
 */
export function computeCropSourceRect(
  naturalWidth,
  naturalHeight,
  viewportSize,
  zoom,
  offsetX,
  offsetY
) {
  const baseScale = Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
  const finalScale = baseScale * zoom;

  const scaledW = naturalWidth * finalScale;
  const scaledH = naturalHeight * finalScale;

  const cx = viewportSize / 2;
  const cy = viewportSize / 2;
  const imgCenterX = cx - offsetX * finalScale;
  const imgCenterY = cy - offsetY * finalScale;
  const imgLeft = imgCenterX - scaledW / 2;
  const imgTop = imgCenterY - scaledH / 2;

  let sx = (0 - imgLeft) / finalScale;
  let sy = (0 - imgTop) / finalScale;
  let sw = viewportSize / finalScale;
  let sh = viewportSize / finalScale;

  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > naturalWidth) sw = naturalWidth - sx;
  if (sy + sh > naturalHeight) sh = naturalHeight - sy;

  sw = Math.max(1, sw);
  sh = Math.max(1, sh);

  return {
    sx,
    sy,
    sw,
    sh,
    baseScale,
    finalScale,
    naturalWidth,
    naturalHeight,
    viewportSize,
    zoom,
    offsetX,
    offsetY,
  };
}

/**
 * Recadre une image en carré 512×512 — coordonnées alignées sur AvatarCropDialog.
 */
export async function cropSquareImage(
  imageSrc,
  { zoom = 1, offsetX = 0, offsetY = 0, viewportSize = DEFAULT_VIEWPORT },
  outputSize = AVATAR_SIZE
) {
  const image = await loadImage(imageSrc);
  const rect = computeCropSourceRect(
    image.naturalWidth,
    image.naturalHeight,
    viewportSize,
    zoom,
    offsetX,
    offsetY
  );

  if (process.env.NODE_ENV === 'development') {
    console.debug('[AvatarCrop]', {
      naturalWidth: rect.naturalWidth,
      naturalHeight: rect.naturalHeight,
      viewportWidth: viewportSize,
      viewportHeight: viewportSize,
      cropX: rect.sx,
      cropY: rect.sy,
      sourceWidth: rect.sw,
      sourceHeight: rect.sh,
      zoom,
      offsetX,
      offsetY,
      outputWidth: outputSize,
      outputHeight: outputSize,
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, outputSize, outputSize);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Recadrage échoué'))),
      OUTPUT_MIME,
      0.88
    );
  });

  const filename = `avatar-${Date.now()}.webp`;
  const file = new File([blob], filename, {
    type: OUTPUT_MIME,
    lastModified: Date.now(),
  });

  return {
    blob,
    file,
    previewUrl: URL.createObjectURL(blob),
    mimeType: OUTPUT_MIME,
    width: outputSize,
    height: outputSize,
    cropRect: rect,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossible de charger l\'image'));
    img.src = src;
  });
}

export { AVATAR_SIZE, OUTPUT_MIME, DEFAULT_VIEWPORT };
