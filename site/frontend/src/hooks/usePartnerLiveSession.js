import { useState, useEffect, useCallback } from 'react';
import { partnerApi } from '../lib/api';

/** Détection d'une nouvelle séance partenaire : 10–15 s */
const POLL_MS = 12000;

/** Polling léger du statut séance en cours du partenaire. */
export function usePartnerLiveSession(enabled = true) {
  const [liveSession, setLiveSession] = useState(null);

  const fetchLive = useCallback(async () => {
    try {
      const { data } = await partnerApi.getLiveSession();
      setLiveSession(data?.active ? data : null);
    } catch {
      setLiveSession(null);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLiveSession(null);
      return undefined;
    }

    const run = () => {
      fetchLive();
    };

    run();
    const id = setInterval(run, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchLive();
    };
    const onFocus = () => fetchLive();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, fetchLive]);

  return { liveSession, refreshLive: fetchLive };
}
