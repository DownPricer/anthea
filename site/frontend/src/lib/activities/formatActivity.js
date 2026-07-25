/**
 * Formateurs pour les données d'activité
 */

/**
 * Formate un temps en secondes en HH:MM:SS ou MM:SS
 * @param {number} seconds
 * @param {boolean} [alwaysShowHours=false]
 * @returns {string}
 */
export function formatElapsed(seconds, alwaysShowHours = false) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (n) => String(n).padStart(2, '0');

  if (h > 0 || alwaysShowHours) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  return `${pad(m)}:${pad(s)}`;
}

/**
 * Formate une allure en min/km
 * @param {number} paceMinPerKm
 * @returns {string} ex: "5:30 /km" ou "--" si invalide
 */
export function formatPace(paceMinPerKm) {
  if (
    typeof paceMinPerKm !== 'number' ||
    isNaN(paceMinPerKm) ||
    !isFinite(paceMinPerKm) ||
    paceMinPerKm <= 0
  ) {
    return '--';
  }

  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.floor((paceMinPerKm - minutes) * 60);

  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

/**
 * Formate une distance en mètres en km avec 2 décimales
 * @param {number} meters
 * @returns {string} ex: "5.23 km"
 */
export function formatDistanceMeters(meters) {
  if (typeof meters !== 'number' || isNaN(meters) || meters < 0) {
    return '0.00 km';
  }

  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
}

/**
 * Formate une vitesse en km/h
 * @param {number} kmh
 * @returns {string} ex: "12.5 km/h" ou "--" si invalide
 */
export function formatSpeedKmh(kmh) {
  if (
    typeof kmh !== 'number' ||
    isNaN(kmh) ||
    !isFinite(kmh) ||
    kmh < 0
  ) {
    return '--';
  }

  return `${kmh.toFixed(1)} km/h`;
}
