/**
 * Implémentation Web de la géolocalisation
 * Utilise navigator.geolocation.watchPosition
 * 
 * NOTE: Ce n'est PAS une solution de géolocalisation en arrière-plan.
 * Pour Android/Capacitor avec géolocalisation en arrière-plan, voir FITMATCH_BACKGROUND_GPS.md
 * 
 * @implements {LocationTrackingAdapter}
 */

import { GPS_STATES } from '../constants';

export class WebGeolocationAdapter {
  constructor() {
    this.watchId = null;
    this.subscribers = [];
    this.state = GPS_STATES.IDLE;
    this.isPaused = false;
  }

  /**
   * Demande la permission de géolocalisation
   * NOTE: La permission est demandée automatiquement lors du premier appel à watchPosition
   * Cette méthode est principalement pour vérifier la disponibilité
   */
  async requestPermission() {
    if (!('geolocation' in navigator)) {
      return 'denied';
    }

    // Avec Web API, on ne peut pas vraiment demander la permission sans démarrer le watch
    // On vérifie juste si l'API est disponible
    try {
      // Test de disponibilité
      const result = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              resolve('denied');
            } else {
              resolve('error');
            }
          },
          {
            timeout: 5000,
            maximumAge: 60000,
          }
        );
      });
      return result;
    } catch {
      return 'error';
    }
  }

  /**
   * Démarre le suivi de localisation
   * La permission sera demandée automatiquement par le navigateur
   */
  async start() {
    if (this.watchId !== null) {
      return; // Déjà démarré
    }

    this.isPaused = false;
    this.state = GPS_STATES.REQUESTING;

    return new Promise((resolve, reject) => {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.state = GPS_STATES.TRACKING;

          if (!this.isPaused) {
            const point = {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp || Date.now(),
              altitude: position.coords.altitude,
              speed: position.coords.speed,
            };

            this.subscribers.forEach((callback) => {
              try {
                callback(point);
              } catch (error) {
                console.error('[WebGeolocationAdapter] Subscriber error:', error);
              }
            });
          }

          resolve();
        },
        (error) => {
          this.state = GPS_STATES.ERROR;
          console.error('[WebGeolocationAdapter] Position error:', error);
          
          if (error.code === error.PERMISSION_DENIED) {
            this.state = GPS_STATES.DENIED;
          }
          
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 15000,
        }
      );
    });
  }

  /**
   * Arrête le suivi de localisation
   */
  async stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.state = GPS_STATES.IDLE;
    this.isPaused = false;
  }

  /**
   * Met en pause le suivi (continue de recevoir les positions mais ne les envoie pas aux subscribers)
   */
  async pause() {
    this.isPaused = true;
  }

  /**
   * Reprend le suivi
   */
  async resume() {
    this.isPaused = false;
  }

  /**
   * S'abonne aux mises à jour de position
   * @param {(point: LocationPoint) => void} callback
   * @returns {() => void} Fonction de désabonnement
   */
  subscribe(callback) {
    this.subscribers.push(callback);

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Obtient l'état actuel
   */
  getState() {
    return this.state;
  }
}
