/** Image de remplacement quand un GIF/média d'exercice est indisponible. */
export const FALLBACK_EXERCISE_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect fill="#1a1a1a" width="120" height="120"/><text x="60" y="68" text-anchor="middle" fill="#52525b" font-size="12" font-family="sans-serif">Média</text></svg>'
  );

export function handleExerciseImageError(event) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = FALLBACK_EXERCISE_IMAGE;
}

/** Nettoie un exercice pour l'API (JSON sérialisable). */
export function sanitizeExerciseForApi(exercise) {
  if (!exercise || typeof exercise !== 'object') return exercise;
  const out = { ...exercise };
  if (out.image_url != null && typeof out.image_url !== 'string') {
    delete out.image_url;
  }
  if (typeof out.image_url === 'string' && out.image_url.length > 500_000) {
    out.image_url = null;
  }
  return out;
}
