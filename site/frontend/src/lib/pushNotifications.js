import { pushApi } from './api';
import { isPushConfigured } from './env';

/** Enregistre le SW et l'abonnement push si configuré côté serveur. */
export async function setupPushNotifications() {
  if (!isPushConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.REACT_APP_VAPID_PUBLIC_KEY ||
          (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY)
      ),
    });

    await pushApi.subscribe(sub.toJSON());
    return { ok: true };
  } catch (e) {
    console.warn('Push setup failed', e);
    return { ok: false, reason: 'error' };
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
