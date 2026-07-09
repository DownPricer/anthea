const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_WIDTH = 1280;
const QUALITY = 0.5;

/**
 * Compresse une image fichier (jpg/png/webp) avant upload.
 * @returns {Promise<{ blob: Blob, previewUrl: string, mimeType: string }>}
 */
export async function compressImageFile(file) {
  if (!file || !ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Format non supporté. Utilise JPG, PNG ou WebP.');
  }

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mimeType = file.type === 'image/png' ? 'image/webp' : file.type;
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression échouée'))),
      mimeType,
      QUALITY
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl, mimeType };
}

export function revokePreviewUrl(url) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
