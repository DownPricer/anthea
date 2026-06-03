/**
 * Variables d'environnement — CRA (REACT_APP_*) et Vite (VITE_*) supportés.
 * Projet actuel : Create React App + Craco → REACT_APP_* par défaut.
 */
function readEnv(name) {
  const cra = process.env[`REACT_APP_${name}`];
  if (cra != null && cra !== '') return cra;

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const vite = import.meta.env[`VITE_${name}`];
    if (vite != null && vite !== '') return vite;
  }
  return undefined;
}

export const BACKEND_URL = readEnv('BACKEND_URL') || 'http://localhost:8000';
export const VAPID_PUBLIC_KEY = readEnv('VAPID_PUBLIC_KEY');

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 20);
}
