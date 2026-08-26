/** Catalogue Défis Héros — un fetch, cache mémoire. */

let catalogPromise = null;
let catalogCache = null;
let catalogAt = 0;
const TTL_MS = 10 * 60 * 1000;

export function heroChallengesCacheKey() {
  return 'hero-challenges-catalog';
}

export function clearHeroChallengesCache() {
  catalogPromise = null;
  catalogCache = null;
  catalogAt = 0;
}

export async function fetchHeroCatalog(loader) {
  const now = Date.now();
  if (catalogCache && now - catalogAt < TTL_MS) {
    return catalogCache;
  }
  if (!catalogPromise) {
    catalogPromise = Promise.resolve()
      .then(loader)
      .then((data) => {
        catalogCache = data;
        catalogAt = Date.now();
        catalogPromise = null;
        return data;
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

export function isHeroWorkout(workout) {
  return workout?.source_type === 'hero_challenge' && Boolean(workout?.hero_challenge_snapshot || workout?.hero_challenge_id);
}

export function heroSnapshot(workout) {
  return workout?.hero_challenge_snapshot || null;
}

export function heroPlayerKind(workout) {
  if (!isHeroWorkout(workout)) return null;
  const type = heroSnapshot(workout)?.challenge_type;
  if (type === 'amrap' || type === 'rounds') return type;
  if (type === 'structured') return 'structured';
  return null;
}

export function repsPerRound(snapshot) {
  return (snapshot?.exercises || []).reduce((n, ex) => n + (Number(ex.reps) || 0), 0);
}

export function formatHeroScore(result, t) {
  const rounds = Number(result?.rounds) || 0;
  const reps = result?.total_reps;
  if (reps) {
    return t('challenges:hero.scoreLine', { rounds, reps, minutes: Math.round((result.duration_seconds || 0) / 60) });
  }
  return t('challenges:hero.roundsCount', { count: rounds });
}

export const HERO_THEME_IDS = [
  'default',
  'spiderman',
  'thor',
  'shangchi',
  'deadpool',
  'batman',
  'wonderwoman',
  'aquaman',
];

export function themeUnlockBadge(themeId) {
  const map = {
    spiderman: 'hero_spiderman_challenge',
    thor: 'hero_thor_challenge',
    shangchi: 'hero_shangchi_challenge',
    deadpool: 'hero_deadpool_challenge',
    batman: 'hero_batman_challenge',
    wonderwoman: 'hero_wonderwoman_challenge',
    aquaman: 'hero_aquaman_challenge',
  };
  return map[themeId] || null;
}

/** Thème visuel depuis snapshot/résultat — jamais de fallback franchise codé en dur. */
export function resolveHeroThemeId(result, snapshot) {
  const fromResult = result?.visual_theme?.id;
  if (fromResult) return fromResult;
  const fromSnap = snapshot?.visual_theme?.id;
  if (fromSnap) return fromSnap;
  return 'default';
}

export function heroDurationMinutes(result, snapshot) {
  const sec = Number(result?.duration_seconds);
  if (sec > 0) return Math.round(sec / 60);
  const snapSec = Number(snapshot?.duration_seconds);
  if (snapSec > 0) return Math.round(snapSec / 60);
  return null;
}

export function heroHasRoundsScore(result, snapshot) {
  const type = result?.challenge_type || snapshot?.challenge_type;
  if (type === 'amrap' || type === 'rounds') return true;
  return Number(result?.rounds) > 0;
}

export function heroBenchmarkReached(result) {
  return Boolean(result?.benchmark_reached ?? result?.success);
}
