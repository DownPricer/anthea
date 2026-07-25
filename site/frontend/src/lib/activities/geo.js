/**
 * Utilitaires géographiques pour le suivi d'activité
 * GeoJSON order: [longitude, latitude]
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calcule la distance en mètres entre deux points GPS (formule haversine)
 * @param {number} lat1 - Latitude point 1
 * @param {number} lon1 - Longitude point 1
 * @param {number} lat2 - Latitude point 2
 * @param {number} lon2 - Longitude point 2
 * @returns {number} Distance en mètres
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c * 1000; // retourne en mètres
}

/**
 * Valide qu'un point GPS est valide
 * @param {{lat: number, lon: number}} point
 * @returns {boolean}
 */
export function isValidGpsPoint(point) {
  if (!point || typeof point.lat !== 'number' || typeof point.lon !== 'number') {
    return false;
  }
  return (
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180 &&
    !isNaN(point.lat) &&
    !isNaN(point.lon)
  );
}

/**
 * Calcule la distance totale en mouvement (exclut segments de pause)
 * @param {Array<{lat: number, lon: number, segment?: string}>} points
 * @returns {number} Distance en mètres
 */
export function calculateMovingDistance(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  
  let distance = 0;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    
    // Ne pas compter les points de nouveaux segments (après pause)
    if (curr.segment === 'new_segment') continue;
    
    if (isValidGpsPoint(prev) && isValidGpsPoint(curr)) {
      distance += haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    }
  }
  
  return distance;
}

/**
 * Calcule l'allure moyenne en minutes/km
 * @param {number} distanceMeters
 * @param {number} movingSeconds
 * @returns {number} Allure en min/km (ou Infinity si distance = 0)
 */
export function calculateAveragePace(distanceMeters, movingSeconds) {
  if (distanceMeters <= 0 || movingSeconds <= 0) return Infinity;
  const km = distanceMeters / 1000;
  const minutes = movingSeconds / 60;
  return minutes / km;
}

/**
 * Calcule la vitesse moyenne en km/h
 * @param {number} distanceMeters
 * @param {number} movingSeconds
 * @returns {number} Vitesse en km/h
 */
export function calculateAverageSpeed(distanceMeters, movingSeconds) {
  if (movingSeconds <= 0) return 0;
  const km = distanceMeters / 1000;
  const hours = movingSeconds / 3600;
  return km / hours;
}

/**
 * Simplifie un tracé GPS (algorithme Douglas-Peucker simplifié)
 * @param {Array<{lat: number, lon: number}>} points
 * @param {number} epsilon - Tolérance en mètres (défaut 10m)
 * @returns {Array<{lat: number, lon: number}>}
 */
export function simplifyRoute(points, epsilon = 10) {
  if (!Array.isArray(points) || points.length <= 2) return points;
  
  // Garde toujours le premier et le dernier point
  const result = [points[0]];
  
  // Algorithme simple: garde un point si éloigné du dernier point gardé
  let lastKept = points[0];
  
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const dist = haversineDistance(lastKept.lat, lastKept.lon, curr.lat, curr.lon);
    
    if (dist >= epsilon) {
      result.push(curr);
      lastKept = curr;
    }
  }
  
  result.push(points[points.length - 1]);
  
  return result;
}

/**
 * Convertit un GeoJSON LineString/MultiLineString en points {lat, lon}
 */
export function routeGeoJsonToLatLonPoints(route) {
  if (!route || typeof route !== 'object') return [];
  const coords = [];
  if (route.type === 'LineString' && Array.isArray(route.coordinates)) {
    route.coordinates.forEach((c) => {
      if (Array.isArray(c) && c.length >= 2) coords.push({ lon: c[0], lat: c[1] });
    });
  } else if (route.type === 'MultiLineString' && Array.isArray(route.coordinates)) {
    route.coordinates.forEach((seg, segIdx) => {
      seg.forEach((c, i) => {
        if (Array.isArray(c) && c.length >= 2) {
          coords.push({
            lon: c[0],
            lat: c[1],
            segment: segIdx > 0 && i === 0 ? 'new_segment' : undefined,
          });
        }
      });
    });
  }
  return coords;
}

/**
 * Calcule la bounding box d'un tracé
 * @param {Array<{lat: number, lon: number}>} points
 * @returns {{minLat: number, maxLat: number, minLon: number, maxLon: number} | null}
 */
export function calculateBoundingBox(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  
  for (const point of points) {
    if (!isValidGpsPoint(point)) continue;
    
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }
  
  if (minLat === Infinity) return null;
  
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Réduit un tracé à une distance maximale (trim début/fin pour confidentialité)
 * @param {Array<{lat: number, lon: number}>} points
 * @param {number} trimDistanceMeters - Distance à retirer du début et de la fin
 * @returns {Array<{lat: number, lon: number}>}
 */
export function trimRouteByDistance(points, trimDistanceMeters) {
  if (!Array.isArray(points) || points.length < 2 || trimDistanceMeters <= 0) {
    return points;
  }
  
  // Trim début
  let startIndex = 0;
  let distFromStart = 0;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    
    if (isValidGpsPoint(prev) && isValidGpsPoint(curr)) {
      distFromStart += haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
      
      if (distFromStart >= trimDistanceMeters) {
        startIndex = i;
        break;
      }
    }
  }
  
  // Trim fin
  let endIndex = points.length - 1;
  let distFromEnd = 0;
  
  for (let i = points.length - 2; i >= startIndex; i--) {
    const curr = points[i];
    const next = points[i + 1];
    
    if (isValidGpsPoint(curr) && isValidGpsPoint(next)) {
      distFromEnd += haversineDistance(curr.lat, curr.lon, next.lat, next.lon);
      
      if (distFromEnd >= trimDistanceMeters) {
        endIndex = i;
        break;
      }
    }
  }
  
  if (startIndex >= endIndex) {
    // Tracé trop court après trim, retourne point milieu
    const midIndex = Math.floor(points.length / 2);
    return [points[midIndex]];
  }
  
  return points.slice(startIndex, endIndex + 1);
}
