import { pushApi } from './api';

const VAPID_PUBLIC = process.env.REACT_APP_VAPID_PUBLIC_KEY;

/** Enregistre le SW et l'abonnement push si le navigateur le permet. */
export async function setupPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!VAPID_PUBLIC) {
    return { ok: false, reason: 'no_vapid_key' };
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
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
