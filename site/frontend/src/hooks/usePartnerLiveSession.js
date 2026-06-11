import { useState, useEffect, useCallback } from 'react';
import { partnerApi } from '../lib/api';

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

    fetchLive();
    const id = setInterval(fetchLive, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, fetchLive]);

  return { liveSession, refreshLive: fetchLive };
}
