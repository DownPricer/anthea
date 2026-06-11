import { useState, useEffect, useRef, useCallback } from 'react';

const WAKE_LOCK_TYPE = 'screen';

/**
 * Empêche la mise en veille de l'écran pendant une séance active.
 * Réacquiert le lock au retour sur l'onglet (visibilitychange).
 */
export function useWakeLock() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const wakeLockRef = useRef(null);
  const shouldHoldRef = useRef(false);

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  }, []);

  const releaseWakeLock = useCallback(async () => {
    shouldHoldRef.current = false;
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) {
      try {
        await lock.release();
      } catch {
        /* déjà libéré */
      }
    }
    setActive(false);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setError('non_supporte');
      return false;
    }

    shouldHoldRef.current = true;
    setError(null);

    try {
      if (wakeLockRef.current) {
        setActive(true);
        return true;
      }

      const lock = await navigator.wakeLock.request(WAKE_LOCK_TYPE);
      wakeLockRef.current = lock;
      setActive(true);

      lock.addEventListener('release', () => {
        wakeLockRef.current = null;
        setActive(false);
        if (shouldHoldRef.current && document.visibilityState === 'visible') {
          requestWakeLock();
        }
      });

      return true;
    } catch (err) {
      const name = err?.name || 'unknown';
      setError(name === 'NotAllowedError' ? 'refuse' : name);
      setActive(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldHoldRef.current) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [requestWakeLock]);

  useEffect(() => () => {
    releaseWakeLock();
  }, [releaseWakeLock]);

  return {
    supported,
    active,
    error,
    requestWakeLock,
    releaseWakeLock,
  };
}
