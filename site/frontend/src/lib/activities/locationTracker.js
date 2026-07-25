/**
 * Location tracker avec filtrage des points GPS
 * Gère les segments de pause automatiquement
 */

import { WebGeolocationAdapter } from './adapters/WebGeolocationAdapter';
import { isValidGpsPoint } from './geo';

const MIN_ACCURACY_METERS = 50; // Rejette les points avec précision > 50m
const MIN_DISTANCE_METERS = 5; // Distance minimale entre deux points

/**
 * Crée un tracker de localisation
 * @returns {Object} Tracker avec méthodes start, stop, pause, resume, subscribe
 */
export function createLocationTracker() {
  const adapter = new WebGeolocationAdapter();
  
  let lastValidPoint = null;
  let subscribers = [];
  let isActive = false;

  const notifySubscribers = (point) => {
    subscribers.forEach((callback) => {
      try {
        callback(point);
      } catch (error) {
        console.error('[LocationTracker] Subscriber error:', error);
      }
    });
  };

  // Filtre les points GPS
  const handleRawPoint = (rawPoint) => {
    if (!isActive) return;

    // Valide le point
    if (!isValidGpsPoint({ lat: rawPoint.lat, lon: rawPoint.lon })) {
      console.warn('[LocationTracker] Invalid GPS point rejected:', rawPoint);
      return;
    }

    // Rejette les points avec mauvaise précision
    if (rawPoint.accuracy > MIN_ACCURACY_METERS) {
      console.warn('[LocationTracker] Low accuracy point rejected:', rawPoint.accuracy);
      return;
    }

    // Calcule la distance depuis le dernier point
    if (lastValidPoint) {
      const distance = calculateDistance(
        lastValidPoint.lat,
        lastValidPoint.lon,
        rawPoint.lat,
        rawPoint.lon
      );

      // Rejette les points trop proches
      if (distance < MIN_DISTANCE_METERS) {
        return;
      }
    }

    const point = {
      lat: rawPoint.lat,
      lon: rawPoint.lon,
      accuracy: rawPoint.accuracy,
      timestamp: rawPoint.timestamp || Date.now(),
      altitude: rawPoint.altitude,
      speed: rawPoint.speed,
    };

    lastValidPoint = point;
    notifySubscribers(point);
  };

  return {
    /**
     * Démarre le suivi
     */
    async start() {
      isActive = true;
      lastValidPoint = null;
      
      adapter.subscribe(handleRawPoint);
      await adapter.start();
    },

    /**
     * Arrête le suivi
     */
    async stop() {
      isActive = false;
      await adapter.stop();
      lastValidPoint = null;
    },

    /**
     * Met en pause (ajoute flag new_segment au prochain point)
     */
    async pause() {
      await adapter.pause();
      // Marque que le prochain point sera un nouveau segment
      lastValidPoint = null;
    },

    /**
     * Reprend le suivi
     */
    async resume() {
      await adapter.resume();
      
      // Le prochain point sera marqué comme nouveau segment
      const originalNotify = notifySubscribers;
      let isFirstAfterResume = true;
      
      const wrappedNotify = (point) => {
        if (isFirstAfterResume) {
          isFirstAfterResume = false;
          originalNotify({ ...point, segment: 'new_segment' });
        } else {
          originalNotify(point);
        }
      };
      
      // Remplace temporairement pour le premier point
      notifySubscribers = wrappedNotify;
      
      setTimeout(() => {
        notifySubscribers = originalNotify;
      }, 5000);
    },

    /**
     * Demande la permission
     */
    async requestPermission() {
      return adapter.requestPermission();
    },

    /**
     * S'abonne aux points GPS filtrés
     */
    subscribe(callback) {
      subscribers.push(callback);
      
      return () => {
        const index = subscribers.indexOf(callback);
        if (index > -1) {
          subscribers.splice(index, 1);
        }
      };
    },

    /**
     * Obtient l'état de l'adapter
     */
    getState() {
      return adapter.getState();
    },
  };
}

// Calcul de distance simple (haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
