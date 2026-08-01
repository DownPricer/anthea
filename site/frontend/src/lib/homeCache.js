/**
 * Cache mémoire court pour les données Accueil (semaine / aujourd'hui).
 * Stale-while-revalidate + déduplication des requêtes simultanées.
 */

import { startOfWeek, addDays, format } from 'date-fns';

const store = new Map();
const inflight = new Map();

/** Durée de fraîcheur (ms) — configurable. */
export const HOME_STALE = {
  week: 90 * 1000,
  today: 90 * 1000,
};

/** Durée max d'affichage stale avant purge (ms). */
export const HOME_MAX_STALE = {
  week: 5 * 60 * 1000,
  today: 5 * 60 * 1000,
};

function keyOf(parts) {
  return parts.filter((p) => p != null && p !== '').join('::');
}

export function homeCacheKey(domain, ...extras) {
  return keyOf(['home', domain, ...extras]);
}

function logDev(event, meta) {
  if (process.env.NODE_ENV === 'production') return;
  console.debug(`[home-cache] ${event}`, meta);
}

export function getHomeCacheEntry(key, maxStaleMs) {
  const entry = store.get(key);
  if (!entry) return { hit: false };
  const age = Date.now() - entry.cachedAt;
  const ttl = entry.ttl ?? HOME_STALE.week;
  const maxStale = maxStaleMs ?? HOME_MAX_STALE.week;
  if (age <= ttl) {
    return { hit: true, fresh: true, data: entry.data };
  }
  if (age <= maxStale) {
    return { hit: true, fresh: false, data: entry.data };
  }
  store.delete(key);
  return { hit: false };
}

/** @deprecated Préférer getHomeCacheEntry — compat rétro. */
export function getHomeCache(parts) {
  const key = Array.isArray(parts) ? keyOf(parts) : parts;
  const entry = getHomeCacheEntry(key);
  return entry.hit ? entry.data : null;
}

export function setHomeCache(parts, data, staleMs) {
  const key = Array.isArray(parts) ? keyOf(parts) : parts;
  const ttl = staleMs ?? HOME_STALE.week;
  store.set(key, { data, ttl, cachedAt: Date.now() });
  return data;
}

export function invalidateHomeCache(matcher) {
  if (!matcher) {
    store.clear();
    return;
  }
  const prefix = Array.isArray(matcher) ? keyOf(matcher) : String(matcher);
  for (const cacheKey of store.keys()) {
    if (
      cacheKey === prefix ||
      cacheKey.startsWith(`${prefix}::`) ||
      cacheKey.includes(`::${prefix}`)
    ) {
      store.delete(cacheKey);
    }
  }
}

/** Invalide le cache semaine pour un utilisateur (toutes semaines). */
export function invalidateHomeWeekCache(userId) {
  if (!userId) return;
  invalidateHomeCache(homeCacheKey('week', userId));
}

export function dedupeInflight(key, fetcher) {
  if (inflight.has(key)) {
    logDev('dedupe', { key });
    return inflight.get(key);
  }
  const promise = (async () => {
    try {
      return await fetcher();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

/**
 * Charge l'agenda hebdomadaire avec cache SWR et déduplication.
 * @param {string} userId
 * @param {string} wsStr — lundi ISO
 * @param {string} weStr — dimanche ISO
 * @param {() => Promise<object>} fetcher
 */
export async function fetchHomeWeekCached(userId, wsStr, weStr, fetcher) {
  const key = homeCacheKey('week', userId, wsStr, weStr);
  const cached = getHomeCacheEntry(key, HOME_MAX_STALE.week);

  if (cached.hit && cached.fresh) {
    logDev('hit', { key, fresh: true });
    return cached.data;
  }

  if (cached.hit && !cached.fresh) {
    logDev('hit', { key, fresh: false });
    dedupeInflight(key, async () => {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      try {
        const data = await fetcher();
        setHomeCache(key, data, HOME_STALE.week);
        logDev('revalidate', { key, ms: Math.round(performance.now() - t0) });
        return data;
      } catch (err) {
        logDev('revalidate-error', { key, err: err?.message });
        return cached.data;
      }
    });
    return cached.data;
  }

  logDev('miss', { key });
  return dedupeInflight(key, async () => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const data = await fetcher();
    setHomeCache(key, data, HOME_STALE.week);
    logDev('fetch', { key, ms: Math.round(performance.now() - t0) });
    return data;
  });
}

/** Précharge la semaine courante après authentification (non bloquant). */
export function preloadHomeWeek(userId, fetcher) {
  if (!userId || typeof fetcher !== 'function') return;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const wsStr = format(weekStart, 'yyyy-MM-dd');
  const weStr = format(weekEnd, 'yyyy-MM-dd');
  fetchHomeWeekCached(userId, wsStr, weStr, fetcher).catch(() => {});
}

/** @internal test helper */
export function __clearHomeCacheForTests() {
  store.clear();
  inflight.clear();
}
