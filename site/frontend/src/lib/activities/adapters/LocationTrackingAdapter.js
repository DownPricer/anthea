/**
 * Interface JSDoc pour les adapters de localisation
 * 
 * @typedef {Object} LocationPoint
 * @property {number} lat - Latitude
 * @property {number} lon - Longitude
 * @property {number} accuracy - Précision en mètres
 * @property {number} timestamp - Timestamp en ms
 * @property {number} [altitude] - Altitude en mètres (optionnel)
 * @property {number} [speed] - Vitesse en m/s (optionnel)
 */

/**
 * @typedef {Object} LocationTrackingAdapter
 * @property {() => Promise<string>} requestPermission - Demande la permission de localisation. Retourne 'granted', 'denied', ou 'error'
 * @property {() => Promise<void>} start - Démarre le suivi de localisation
 * @property {() => Promise<void>} stop - Arrête le suivi de localisation
 * @property {() => Promise<void>} pause - Met en pause le suivi
 * @property {() => Promise<void>} resume - Reprend le suivi
 * @property {(callback: (point: LocationPoint) => void) => () => void} subscribe - S'abonne aux mises à jour de position. Retourne une fonction de désabonnement
 */

// Ce fichier ne contient que les JSDoc types, pas d'implémentation
export {};
