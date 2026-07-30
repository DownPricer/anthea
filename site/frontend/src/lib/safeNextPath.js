/**
 * Valide un paramètre `next` post-auth : routes internes uniquement.
 * Interdit les URLs absolues et les protocol-relative (//evil.com).
 */
export function sanitizeNextPath(raw, fallback = '/') {
  if (raw == null || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return fallback;
  if (trimmed.includes('\\')) return fallback;
  return trimmed;
}

export function readNextFromSearch(search) {
  try {
    const params = new URLSearchParams(search || '');
    return sanitizeNextPath(params.get('next'), null);
  } catch {
    return null;
  }
}

export function withNextParam(path, next) {
  const safe = sanitizeNextPath(next, null);
  if (!safe || safe === '/') return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}next=${encodeURIComponent(safe)}`;
}
