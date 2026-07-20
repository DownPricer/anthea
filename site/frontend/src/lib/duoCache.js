/**
 * Cache mémoire léger pour les données Duo (pas de React Query dans le projet).
 * Clés : ["duo", domain, pairKey, ...extras]
 */

const store = new Map();

const STALE = {
  profile: 3 * 60 * 1000,
  stats: 45 * 1000,
  badges: 2 * 60 * 1000,
  challenges: 2 * 60 * 1000,
  activity: 45 * 1000,
  detailedStats: 60 * 1000,
  notifications: 20 * 1000,
  partner: 2 * 60 * 1000,
};

function keyOf(parts) {
  return parts.filter((p) => p != null && p !== '').join('::');
}

export function duoCacheKey(domain, pairKey, ...extras) {
  return keyOf(['duo', domain, pairKey, ...extras]);
}

export function getDuoCache(parts) {
  const key = Array.isArray(parts) ? keyOf(parts) : parts;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setDuoCache(parts, data, staleMs) {
  const key = Array.isArray(parts) ? keyOf(parts) : parts;
  const ttl = staleMs ?? STALE.stats;
  store.set(key, { data, expiresAt: Date.now() + ttl, cachedAt: Date.now() });
  return data;
}

export function invalidateDuoCache(matcher) {
  if (!matcher) {
    store.clear();
    return;
  }
  const prefix = Array.isArray(matcher) ? keyOf(matcher) : String(matcher);
  for (const key of store.keys()) {
    if (key === prefix || key.startsWith(`${prefix}::`) || key.includes(`::${prefix}`)) {
      store.delete(key);
    }
  }
}

export function invalidateDuoDomain(domain, pairKey) {
  const needle = keyOf(['duo', domain, pairKey].filter(Boolean));
  for (const key of store.keys()) {
    if (key.startsWith(needle)) store.delete(key);
  }
}

export const DUO_STALE = STALE;

/** Dev-only timing helpers */
export function duoTime(label) {
  if (process.env.NODE_ENV !== 'development') return () => {};
  const full = `[DuoPage] ${label}`;
  // eslint-disable-next-line no-console
  console.time(full);
  return () => {
    // eslint-disable-next-line no-console
    console.timeEnd(full);
  };
}
