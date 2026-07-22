/**
 * Cache mémoire court pour les données Accueil (semaine / aujourd'hui).
 */

const store = new Map();

export const HOME_STALE = {
  week: 45 * 1000,
  today: 45 * 1000,
};

function keyOf(parts) {
  return parts.filter((p) => p != null && p !== '').join('::');
}

export function homeCacheKey(domain, ...extras) {
  return keyOf(['home', domain, ...extras]);
}

export function getHomeCache(parts) {
  const key = Array.isArray(parts) ? keyOf(parts) : parts;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setHomeCache(parts, data, staleMs) {
  const key = Array.isArray(parts) ? keyOf(parts) : parts;
  const ttl = staleMs ?? HOME_STALE.week;
  store.set(key, { data, expiresAt: Date.now() + ttl, cachedAt: Date.now() });
  return data;
}

export function invalidateHomeCache(matcher) {
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

/** @internal test helper */
export function __clearHomeCacheForTests() {
  store.clear();
}
