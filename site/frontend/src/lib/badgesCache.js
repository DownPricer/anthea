/**
 * Cache mémoire partagé pour les catalogues badges (solo / duo).
 *
 * Clés scoppées par utilisateur (+ pairKey pour duo) pour éviter toute fuite
 * entre comptes sur la même session navigateur.
 *
 * Invalidation : logout (clear total) + fin de séance (invalidateBadgesForUser).
 * TTL 2 min reste une filet de sécurité si une mutation badge échappe à ces points.
 */

const store = new Map();
const inflight = new Map();

const STALE = {
  solo: 2 * 60 * 1000,
  duo: 2 * 60 * 1000,
};

export function badgesCacheKey({ scope = 'solo', userId = null, pairKey = null } = {}) {
  const uid = userId != null ? String(userId) : 'anon';
  if (scope === 'duo') {
    const pk = pairKey ? String(pairKey) : 'no-pair';
    return `badges::duo::${pk}::${uid}`;
  }
  return `badges::solo::${uid}`;
}

function resolveContext(context) {
  if (typeof context === 'string') {
    return { scope: context === 'duo' ? 'duo' : 'solo', userId: null, pairKey: null };
  }
  return context || { scope: 'solo', userId: null, pairKey: null };
}

export function getBadgesCache(context) {
  const ctx = resolveContext(context);
  const key = badgesCacheKey(ctx);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setBadgesCache(context, data, staleMs) {
  const ctx = resolveContext(context);
  const key = badgesCacheKey(ctx);
  const ttl = staleMs ?? STALE[ctx.scope] ?? STALE.solo;
  store.set(key, { data, expiresAt: Date.now() + ttl, cachedAt: Date.now() });
  return data;
}

export function invalidateBadgesCache(context) {
  if (context == null) {
    store.clear();
    inflight.clear();
    return;
  }
  const key = badgesCacheKey(resolveContext(context));
  store.delete(key);
  inflight.delete(key);
}

export function invalidateBadgesForUser(userId) {
  if (userId == null) return;
  const uid = String(userId);
  for (const key of [...store.keys(), ...inflight.keys()]) {
    if (key.endsWith(`::${uid}`)) {
      store.delete(key);
      inflight.delete(key);
    }
  }
}

export function invalidateAllBadgesCache() {
  store.clear();
  inflight.clear();
}

export async function fetchBadgesCached(context, fetcher, staleMs) {
  const ctx = resolveContext(context);
  const key = badgesCacheKey(ctx);
  const cached = getBadgesCache(ctx);
  if (cached != null) return cached;

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      setBadgesCache(ctx, data, staleMs);
      return data;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

export const BADGES_STALE = STALE;
