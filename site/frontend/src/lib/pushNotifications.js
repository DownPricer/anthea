import { pushApi } from './api';
import { isPushConfigured, VAPID_PUBLIC_KEY } from './env';

export const PUSH_STATUS = {
  UNSUPPORTED: 'unsupported',
  NOT_CONFIGURED: 'not_configured',
  DEFAULT: 'default',
  GRANTED: 'granted',
  DENIED: 'denied',
  SUBSCRIBED: 'subscribed',
  EXPIRED: 'expired',
};

function detectIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  );
}

export function getPushPlatformHints() {
  const ios = detectIOS();
  return {
    ios,
    needsInstall: ios && !isStandalonePwa(),
    message: ios && !isStandalonePwa()
      ? 'Sur iPhone/iPad, installez FitMatch sur l’écran d’accueil (Partager → Sur l’écran d’accueil) puis activez les notifications.'
      : null,
  };
}

export async function getPushPermissionState() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return PUSH_STATUS.UNSUPPORTED;
  }
  if (!isPushConfigured()) return PUSH_STATUS.NOT_CONFIGURED;
  return Notification.permission;
}

/** Enregistre le SW sans demander la permission. */
export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js');
}

export async function getCurrentPushSubscription() {
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg?.pushManager) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Statut UX pour Paramètres.
 * @returns {{ status: string, label: string, canEnable: boolean, canDisable: boolean, hint: string|null }}
 */
export async function getDevicePushStatus() {
  const hints = getPushPlatformHints();
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      status: PUSH_STATUS.UNSUPPORTED,
      label: 'Non prises en charge',
      canEnable: false,
      canDisable: false,
      hint: hints.message || 'Ce navigateur ne prend pas en charge les notifications Web Push.',
    };
  }
  if (!isPushConfigured()) {
    return {
      status: PUSH_STATUS.NOT_CONFIGURED,
      label: 'Non configurées (serveur)',
      canEnable: false,
      canDisable: false,
      hint: 'La clé VAPID publique n’est pas configurée.',
    };
  }

  const permission = Notification.permission;
  if (permission === 'denied') {
    return {
      status: PUSH_STATUS.DENIED,
      label: 'Refusées dans le navigateur',
      canEnable: false,
      canDisable: false,
      hint: hints.message || 'Autorisez les notifications dans les réglages du navigateur.',
    };
  }

  try {
    await ensureServiceWorker();
    const sub = await getCurrentPushSubscription();
    if (sub) {
      return {
        status: PUSH_STATUS.SUBSCRIBED,
        label: 'Activées',
        canEnable: false,
        canDisable: true,
        hint: hints.message,
      };
    }
  } catch {
    /* ignore */
  }

  if (permission === 'granted') {
    return {
      status: PUSH_STATUS.EXPIRED,
      label: 'Abonnement expiré',
      canEnable: true,
      canDisable: false,
      hint: 'Réactivez les notifications sur cet appareil.',
    };
  }

  return {
    status: PUSH_STATUS.DEFAULT,
    label: 'Permission non demandée',
    canEnable: true,
    canDisable: false,
    hint: hints.message,
  };
}

/** Enregistre le SW et l'abonnement push si configuré. Demande la permission uniquement au clic. */
export async function setupPushNotifications() {
  if (!isPushConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  const hints = getPushPlatformHints();
  if (hints.needsInstall) {
    return { ok: false, reason: 'ios_install_required', hint: hints.message };
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    await pushApi.subscribe({
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });
    return { ok: true };
  } catch (e) {
    console.warn('Push setup failed', e);
    return { ok: false, reason: 'error' };
  }
}

export async function disablePushNotifications() {
  try {
    const sub = await getCurrentPushSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      try {
        await pushApi.unsubscribe({ endpoint });
      } catch {
        /* serveur peut être offline */
      }
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (e) {
    console.warn('Push disable failed', e);
    return { ok: false, reason: 'error' };
  }
}

export async function sendTestPush() {
  const { data } = await pushApi.test();
  return data;
}

function urlBase64ToUint8Array(base64String) {
  if (!base64String) throw new Error('VAPID public key missing');
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
