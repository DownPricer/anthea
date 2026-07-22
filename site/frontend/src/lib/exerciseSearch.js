/**
 * Recherche catalogue exercices (debounce + pagination + abort).
 */

const DEFAULT_LIMIT = 10;

export function createExerciseSearchController({ api, limit = DEFAULT_LIMIT } = {}) {
  let timer = null;
  let abort = null;
  let cache = new Map();
  let scrollY = 0;

  function cacheKey(params) {
    return JSON.stringify(params);
  }

  function saveScroll(y) {
    scrollY = y;
  }

  function restoreScroll() {
    return scrollY;
  }

  async function search(params, { debounceMs = 250 } = {}) {
    const key = cacheKey(params);
    if (cache.has(key)) {
      return cache.get(key);
    }

    return new Promise((resolve, reject) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (abort) abort.abort();
        abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
        try {
          const { data } = await api.getAll(
            { ...params, limit: params.limit || limit },
            abort ? { signal: abort.signal } : undefined
          );
          const normalized = Array.isArray(data)
            ? {
                items: data,
                page: 1,
                limit: data.length,
                total: data.length,
                has_more: false,
                custom_creation_enabled: true,
                catalog_ready: false,
              }
            : data;
          cache.set(key, normalized);
          if (cache.size > 40) {
            const first = cache.keys().next().value;
            cache.delete(first);
          }
          resolve(normalized);
        } catch (err) {
          if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
            return;
          }
          reject(err);
        }
      }, debounceMs);
    });
  }

  function clearCache() {
    cache = new Map();
  }

  function cancel() {
    if (timer) clearTimeout(timer);
    if (abort) abort.abort();
  }

  return { search, clearCache, cancel, saveScroll, restoreScroll };
}

export const EXERCISE_FILTER_PRESETS = {
  sports: [
    { value: '', labelKey: 'workouts:create.filters.all' },
    { value: 'strength', labelKey: 'workouts:create.filters.strength' },
    { value: 'bodyweight', labelKey: 'workouts:create.filters.bodyweight' },
    { value: 'cardio', labelKey: 'workouts:create.filters.cardio' },
    { value: 'mobility', labelKey: 'workouts:create.filters.mobility' },
    { value: 'stretching', labelKey: 'workouts:create.filters.stretching' },
    { value: 'running', labelKey: 'workouts:create.filters.running' },
    { value: 'cycling', labelKey: 'workouts:create.filters.cycling' },
    { value: 'swimming', labelKey: 'workouts:create.filters.swimming' },
  ],
  equipment: [
    { value: '', labelKey: 'workouts:create.filters.equipmentAll' },
    { value: 'bodyweight', labelKey: 'workouts:create.filters.equipmentBodyweight' },
    { value: 'dumbbell', labelKey: 'workouts:create.filters.equipmentDumbbell' },
    { value: 'barbell', labelKey: 'workouts:create.filters.equipmentBarbell' },
    { value: 'selectorized_machine', labelKey: 'workouts:create.filters.equipmentMachine' },
    { value: 'cable', labelKey: 'workouts:create.filters.equipmentCable' },
    { value: 'resistance_band', labelKey: 'workouts:create.filters.equipmentBand' },
    { value: 'kettlebell', labelKey: 'workouts:create.filters.equipmentKettlebell' },
    { value: 'smith_machine', labelKey: 'workouts:create.filters.equipmentSmith' },
  ],
};
