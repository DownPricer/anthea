const AVATAR_SIZE = 512;
const OUTPUT_MIME = 'image/webp';

/**
 * Recadre une image en carré 512×512 avec zoom et décalage.
 * @param {string} imageSrc - data URL ou blob URL
 * @param {{ zoom: number, offsetX: number, offsetY: number }} options
 * @param {number} outputSize - taille de sortie (px)
 */
export async function cropSquareImage(
  imageSrc,
  { zoom = 1, offsetX = 0, offsetY = 0 },
  outputSize = AVATAR_SIZE
) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');

  const viewSize = Math.min(image.width, image.height) / zoom;
  const centerX = image.width / 2 + offsetX;
  const centerY = image.height / 2 + offsetY;
  const sx = Math.max(0, centerX - viewSize / 2);
  const sy = Math.max(0, centerY - viewSize / 2);
  const sw = Math.min(viewSize, image.width - sx);
  const sh = Math.min(viewSize, image.height - sy);

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputSize, outputSize);

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

export { AVATAR_SIZE, OUTPUT_MIME };
