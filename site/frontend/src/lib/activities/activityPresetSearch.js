/**
 * Recherche locale des presets d'activités FitMatch (multilingue, alias, cache).
 */

import {
  ACTIVITY_PRESETS,
  ACTIVITY_PRESET_IDS,
  getPresetById,
  localizePreset,
  isDisplayableActivityPreset,
  warnInvalidActivityPreset,
} from './activityPresets';

const POPULAR_PRESET_IDS = [
  ACTIVITY_PRESET_IDS.OUTDOOR_RUNNING,
  ACTIVITY_PRESET_IDS.OUTDOOR_WALKING,
  ACTIVITY_PRESET_IDS.POOL_SWIMMING,
  ACTIVITY_PRESET_IDS.TREADMILL_RUNNING,
];

/** Alias de recherche par preset (FR / EN / ES) */
export const PRESET_SEARCH_ALIASES = {
  outdoor_running: {
    fr: ['course', 'courir', 'running', 'jogging'],
    en: ['run', 'running', 'jogging'],
    es: ['correr', 'carrera'],
  },
  outdoor_walking: {
    fr: ['marche', 'marcher', 'promenade'],
    en: ['walk', 'walking'],
    es: ['caminar', 'marcha'],
  },
  hiking: {
    fr: ['randonnee', 'randonnée', 'rando'],
    en: ['hike', 'hiking'],
    es: ['senderismo'],
  },
  outdoor_cycling: {
    fr: ['velo', 'vélo', 'cyclisme', 'bicyclette'],
    en: ['bike', 'cycling'],
    es: ['bicicleta', 'ciclismo'],
  },
  outdoor_roller: {
    fr: ['roller', 'patin'],
    en: ['skating', 'inline'],
    es: ['patinaje'],
  },
  pool_swimming: {
    fr: ['natation', 'nage', 'piscine'],
    en: ['swim', 'swimming', 'pool'],
    es: ['natacion', 'natación', 'nadar', 'piscina'],
  },
  track_laps: {
    fr: ['piste', 'tours de piste'],
    en: ['track', 'track laps'],
    es: ['pista', 'vueltas'],
  },
  shuttle_run: {
    fr: ['navette'],
    en: ['shuttle'],
    es: ['naveta'],
  },
  interval_running: {
    fr: ['fractionne', 'fractionné', 'intervalle', 'intervalles'],
    en: ['interval', 'intervals'],
    es: ['intervalos'],
  },
  tabata: {
    fr: ['tabata'],
    en: ['tabata'],
    es: ['tabata'],
  },
  free_intervals: {
    fr: ['intervalles libres'],
    en: ['free intervals'],
    es: ['intervalos libres'],
  },
  treadmill_running: {
    fr: ['tapis', 'tapis de course'],
    en: ['treadmill'],
    es: ['cinta de correr', 'cinta'],
  },
  indoor_cycling: {
    fr: ['velo interieur', 'vélo intérieur', 'home trainer'],
    en: ['indoor bike', 'stationary bike'],
    es: ['ciclismo indoor', 'bici estatica'],
  },
  indoor_rowing: {
    fr: ['rameur', 'aviron interieur', 'aviron intérieur'],
    en: ['rowing', 'rower'],
    es: ['remo'],
  },
  elliptical: {
    fr: ['elliptique'],
    en: ['elliptical'],
    es: ['eliptica', 'elíptica'],
  },
  yoga_session: {
    fr: ['yoga'],
    en: ['yoga'],
    es: ['yoga'],
  },
  stretching_session: {
    fr: ['etirement', 'étirement', 'etirements', 'étirements'],
    en: ['stretch', 'stretching'],
    es: ['estiramiento'],
  },
};

let cachedPresets = null;
let cachePromise = null;

export function foldSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const folded = foldSearchText(value);
  return folded ? folded.split(' ') : [];
}

function pluralVariants(token) {
  if (!token || token.length < 2) return [token];
  const variants = new Set([token]);
  if (token.endsWith('s')) {
    variants.add(token.slice(0, -1));
  } else {
    variants.add(`${token}s`);
  }
  return [...variants];
}

function expandQueryTokens(query) {
  const tokens = tokenize(query);
  const expanded = new Set();
  tokens.forEach((token) => {
    pluralVariants(token).forEach((v) => expanded.add(v));
  });
  return [...expanded];
}

function presetSearchForms(preset, locale = 'fr') {
  const lang = (locale || 'fr').split('-')[0].toLowerCase();
  const forms = new Set();
  const nameObj = preset.name || {};
  Object.values(nameObj).forEach((v) => {
    if (v) forms.add(foldSearchText(v));
  });
  const aliasObj = PRESET_SEARCH_ALIASES[preset.id] || preset.aliases || {};
  Object.values(aliasObj).flat().forEach((v) => {
    if (v) forms.add(foldSearchText(v));
  });
  const descObj = preset.description || {};
  Object.values(descObj).forEach((v) => {
    if (v) forms.add(foldSearchText(v));
  });
  if (lang !== 'fr') {
    (aliasObj[lang] || []).forEach((v) => {
      if (v) forms.add(foldSearchText(v));
    });
  }
  return [...forms].filter(Boolean);
}

function scorePreset(preset, query, locale) {
  const q = foldSearchText(query);
  if (!q) return 0;
  const forms = presetSearchForms(preset, locale);
  let best = 0;
  for (const form of forms) {
    if (form === q) best = Math.max(best, 100);
    else if (form.startsWith(q)) best = Math.max(best, 80);
    else if (q.startsWith(form) && form.length >= 3) best = Math.max(best, 75);
    else if (form.includes(q)) best = Math.max(best, 55);
    else {
      const qTokens = expandQueryTokens(q);
      if (qTokens.every((t) => form.includes(t))) best = Math.max(best, 45);
    }
  }
  return best;
}

function localizeSafePresets(presets, locale, context) {
  const out = [];
  for (const preset of presets || []) {
    if (!isDisplayableActivityPreset(preset, locale)) {
      warnInvalidActivityPreset(preset, context);
      continue;
    }
    const localized = localizePreset(preset, locale);
    if (!localized.label) {
      warnInvalidActivityPreset(preset, context);
      continue;
    }
    out.push(localized);
  }
  return out;
}

export function searchActivityPresets(query, locale = 'fr', presets = ACTIVITY_PRESETS) {
  const q = foldSearchText(query);
  if (!q) return [];
  return presets
    .map((preset) => ({
      preset,
      score: scorePreset(preset, q, locale),
      localized: isDisplayableActivityPreset(preset, locale)
        ? localizePreset(preset, locale)
        : null,
    }))
    .filter((entry) => {
      if (entry.score <= 0) return false;
      if (!entry.localized?.label) {
        warnInvalidActivityPreset(entry.preset, 'activity-preset-search');
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score || a.localized.label.localeCompare(b.localized.label))
    .map((entry) => entry.localized);
}

export function getPopularActivityPresets(locale = 'fr', presets = ACTIVITY_PRESETS) {
  const source = POPULAR_PRESET_IDS.map((id) => {
    const fromList = (presets || []).find((p) => p.id === id);
    return fromList || getPresetById(id);
  }).filter(Boolean);
  return localizeSafePresets(source, locale, 'activity-preset-popular');
}

export function getActivityPresetsForDiscovery({ query, locale = 'fr', hasFilters = false, presets = ACTIVITY_PRESETS }) {
  if (hasFilters) return [];
  const q = foldSearchText(query);
  if (!q) return getPopularActivityPresets(locale, presets);
  return searchActivityPresets(q, locale, presets);
}

export async function loadCachedActivityPresets({ locale = 'fr', force = false } = {}) {
  if (cachedPresets && !force) return cachedPresets;
  if (cachePromise && !force) return cachePromise;

  cachePromise = (async () => {
    try {
      const { activitiesApi } = await import('../api');
      const { data } = await activitiesApi.getPresets({ locale });
      const fromApi = (data?.presets || [])
        .map((p) => {
          const nameI18n =
            p.name_i18n && typeof p.name_i18n === 'object'
              ? p.name_i18n
              : p.name && typeof p.name === 'object'
                ? p.name
                : null;
          const name =
            nameI18n ||
            (typeof p.name === 'string' && p.name.trim()
              ? { fr: p.name, en: p.name, es: p.name }
              : {});
          const descriptionI18n =
            p.description_i18n && typeof p.description_i18n === 'object'
              ? p.description_i18n
              : p.description && typeof p.description === 'object'
                ? p.description
                : {};
          return {
            id: p.id,
            activity_kind: p.activity_kind,
            activity_tracking_mode: p.activity_tracking_mode,
            icon: p.icon,
            name,
            name_i18n: nameI18n || name,
            description: descriptionI18n,
            description_i18n: descriptionI18n,
            aliases: p.aliases || PRESET_SEARCH_ALIASES[p.id],
          };
        })
        .filter((p) => {
          if (isDisplayableActivityPreset(p, locale)) return true;
          warnInvalidActivityPreset(p, 'activity-preset-cache');
          return false;
        });
      if (fromApi.length > 0) {
        cachedPresets = fromApi;
        return cachedPresets;
      }
    } catch {
      /* fallback local */
    }
    cachedPresets = ACTIVITY_PRESETS.map((p) => ({
      ...p,
      aliases: PRESET_SEARCH_ALIASES[p.id],
    }));
    return cachedPresets;
  })();

  return cachePromise;
}

export function clearActivityPresetCache() {
  cachedPresets = null;
  cachePromise = null;
}

export function getModeBadgeLabelKey(mode) {
  return `activity:modes.${mode}`;
}
