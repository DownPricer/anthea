/**
 * Formatage des résumés d'exercices / activités pour les publications de séance.
 */

import { formatElapsed, formatDistanceMeters, formatPace } from './formatActivity';

function isValidPaceSecPerKm(pace) {
  return (
    typeof pace === 'number' &&
    Number.isFinite(pace) &&
    pace > 0 &&
    pace < 3600
  );
}

function isValidDistance(meters) {
  return typeof meters === 'number' && Number.isFinite(meters) && meters > 0;
}

function durationSeconds(summary) {
  const moving = summary?.moving_seconds;
  const elapsed = summary?.elapsed_seconds;
  if (typeof moving === 'number' && Number.isFinite(moving) && moving > 0) return moving;
  if (typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed > 0) return elapsed;
  return null;
}

/**
 * Ligne de métriques compacte pour une entrée de snapshot (sans GPS).
 * @returns {string|null}
 */
export function formatExerciseSummaryMetrics(entry, { locale = 'fr' } = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const parts = [];
  const mode = entry.tracking_mode || entry.activity_tracking_mode;
  const dist = entry.distance_meters;
  const secs = durationSeconds(entry);
  const laps = entry.laps;
  const paceSec = entry.average_pace_seconds_per_km;

  if (mode === 'laps' || (typeof laps === 'number' && laps > 0)) {
    if (isValidDistance(dist)) {
      // natation : mètres préférés si < 3 km
      if (dist < 3000) {
        const meters = Math.round(dist);
        parts.push(
          locale === 'en'
            ? `${meters} m`
            : `${meters.toLocaleString(locale === 'es' ? 'es' : 'fr-FR')} m`,
        );
      } else {
        parts.push(formatDistanceMeters(dist).replace('.', ','));
      }
    }
    if (typeof laps === 'number' && laps > 0) {
      parts.push(
        locale === 'en'
          ? `${laps} laps`
          : locale === 'es'
            ? `${laps} largos`
            : `${laps} longueurs`,
      );
    }
    if (secs != null) parts.push(formatElapsed(secs));
    return parts.length ? parts.join(' · ') : null;
  }

  if (mode === 'timer' || mode === 'intervals') {
    if (mode === 'intervals') {
      const rounds = entry.interval_rounds || entry.rounds || entry.reps;
      if (typeof rounds === 'number' && rounds > 0) {
        parts.push(
          locale === 'en'
            ? `${rounds} reps`
            : locale === 'es'
              ? `${rounds} repeticiones`
              : `${rounds} répétitions`,
        );
      }
      if (secs != null) {
        const mins = Math.max(1, Math.round(secs / 60));
        parts.push(
          locale === 'en' ? `${mins} min` : locale === 'es' ? `${mins} min` : `${mins} min`,
        );
      }
      return parts.length ? parts.join(' · ') : secs != null ? formatElapsed(secs) : null;
    }
    return secs != null ? formatElapsed(secs) : null;
  }

  // GPS / manual distance / classic with distance
  if (isValidDistance(dist)) {
    const km = dist / 1000;
    const formatted =
      locale === 'en'
        ? `${km.toFixed(km >= 10 ? 1 : 2)} km`
        : `${km.toFixed(km >= 10 ? 1 : 2).replace('.', ',')} km`;
    parts.push(formatted);
  }
  if (secs != null) parts.push(formatElapsed(secs));
  if (
    isValidPaceSecPerKm(paceSec) &&
    (mode === 'gps' || mode === 'manual_distance' || !mode)
  ) {
    const paceLabel = formatPace(paceSec / 60);
    if (paceLabel && paceLabel !== '--') {
      parts.push(paceLabel.replace(' /km', '/km'));
    }
  }

  // Classic strength
  if (!parts.length) {
    const sets = entry.sets;
    const reps = entry.reps;
    const duration = entry.duration;
    if (typeof sets === 'number' && sets > 0 && typeof reps === 'number' && reps > 0) {
      return locale === 'en'
        ? `${sets} sets · ${reps} reps`
        : locale === 'es'
          ? `${sets} series · ${reps} repeticiones`
          : `${sets} séries · ${reps} répétitions`;
    }
    if (typeof reps === 'number' && reps > 0) {
      return locale === 'en' ? `${reps} reps` : `${reps} répétitions`;
    }
    if (typeof duration === 'number' && duration > 0) {
      return formatElapsed(duration);
    }
  }

  return parts.length ? parts.join(' · ') : null;
}

export function getExerciseSummaryDisplayName(entry, locale = 'fr') {
  if (!entry) return '';
  if (typeof entry.name === 'string' && entry.name.trim()) return entry.name.trim();
  const i18n = entry.name_i18n;
  if (i18n && typeof i18n === 'object') {
    const lang = (locale || 'fr').split('-')[0];
    for (const key of [lang, 'fr', 'en', 'es']) {
      if (typeof i18n[key] === 'string' && i18n[key].trim()) return i18n[key].trim();
    }
  }
  return entry.preset_id || entry.exercise_id || '';
}
