/** Résolution d'URL média exercices — ne jamais préfixer une URL absolue. */

export function resolveLocalMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return url;
  if (url.startsWith('uploads/')) return `/${url}`;
  if (url.includes('/uploads/')) {
    const idx = url.indexOf('/uploads/');
    return url.slice(idx);
  }
  if (url.startsWith('/')) return url;
  return `/${url}`;
}

/**
 * Règle obligatoire : https/http/data/blob restent inchangés.
 */
export function resolveExerciseMediaUrl(url) {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Garde-fou : éviter https://anthea.../https://...
  if (/^https?:\/\//i.test(trimmed.replace(/^\/+/, ''))) {
    return trimmed.replace(/^\/+/, '');
  }

  return resolveLocalMediaUrl(trimmed);
}

export const FALLBACK_EXERCISE_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect fill="#1a1a1a" width="120" height="120"/><text x="60" y="68" text-anchor="middle" fill="#52525b" font-size="12" font-family="sans-serif">Média</text></svg>'
  );

export function handleExerciseImageError(event) {
  const img = event.currentTarget;
  if (!img || img.dataset.fallbackApplied === '1') return;
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
