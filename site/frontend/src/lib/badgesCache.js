/**
 * Cache mémoire partagé pour les catalogues badges (solo / duo).
 */

const store = new Map();
const inflight = new Map();

const STALE = {
  solo: 2 * 60 * 1000,
  duo: 2 * 60 * 1000,
};

function keyOf(scope) {
  return `badges::${scope || 'solo'}`;
}

export function getBadgesCache(scope) {
  const key = keyOf(scope);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setBadgesCache(scope, data, staleMs = STALE[scope] || STALE.solo) {
  const key = keyOf(scope);
  store.set(key, { data, expiresAt: Date.now() + staleMs, cachedAt: Date.now() });
  return data;
}

export function invalidateBadgesCache(scope) {
  if (!scope) {
    store.clear();
    inflight.clear();
    return;
  }
  const key = keyOf(scope);
  store.delete(key);
  inflight.delete(key);
}

export async function fetchBadgesCached(scope, fetcher, staleMs) {
  const key = keyOf(scope);
  const cached = getBadgesCache(scope);
  if (cached != null) return cached;

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      setBadgesCache(scope, data, staleMs ?? STALE[scope] ?? STALE.solo);
      return data;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

export const BADGES_STALE = STALE;
