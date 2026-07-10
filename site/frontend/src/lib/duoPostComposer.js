/** Bouton Publier actif si texte ou image, et pas en cours d'envoi/upload. */
export function canSubmitDuoPost(content, uploadedImagePath, isSubmitting, uploading) {
  if (isSubmitting || uploading) return false;
  const hasText = Boolean(String(content || '').trim());
  const hasImage = Boolean(uploadedImagePath);
  return hasText || hasImage;
}
