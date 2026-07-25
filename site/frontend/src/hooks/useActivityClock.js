/**
 * Hook pour gérer l'horloge d'une activité
 * Utilise les timestamps pour les calculs, tick toutes les 1s pour l'affichage
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { computeElapsed } from '../lib/activities/activityClock';
import { ACTIVITY_STATUS } from '../lib/activities/constants';

export function useActivityClock() {
  const [startedAt, setStartedAt] = useState(null);
  const [status, setStatus] = useState(ACTIVITY_STATUS.PENDING);
  const [pausedAt, setPausedAt] = useState(null);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const [endedAt, setEndedAt] = useState(null);
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [movingSeconds, setMovingSeconds] = useState(0);
  const intervalRef = useRef(null);

  // Recalcule les temps
  const updateElapsed = useCallback(() => {
    if (!startedAt) {
      setElapsedSeconds(0);
      setMovingSeconds(0);
      return;
    }

    const result = computeElapsed({
      startedAt,
      status,
      pausedAt,
      pausedSeconds,
      endedAt,
      now: new Date(),
    });

    setElapsedSeconds(result.elapsedSeconds);
    setMovingSeconds(result.movingSeconds);
  }, [startedAt, status, pausedAt, pausedSeconds, endedAt]);

  // Tick toutes les secondes quand l'activité est active
  useEffect(() => {
    if (status === ACTIVITY_STATUS.ACTIVE) {
      intervalRef.current = setInterval(updateElapsed, 1000);
      updateElapsed(); // Mise à jour immédiate
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      updateElapsed(); // Mise à jour finale
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, updateElapsed]);

  // Démarrer
  const start = useCallback(() => {
    const now = new Date().toISOString();
    setStartedAt(now);
    setStatus(ACTIVITY_STATUS.ACTIVE);
    setPausedAt(null);
    setPausedSeconds(0);
    setEndedAt(null);
  }, []);

  // Pause
  const pause = useCallback(() => {
    if (status !== ACTIVITY_STATUS.ACTIVE) return;
    
    const now = new Date().toISOString();
    setPausedAt(now);
    setStatus(ACTIVITY_STATUS.PAUSED);
  }, [status]);

  // Reprendre
  const resume = useCallback(() => {
    if (status !== ACTIVITY_STATUS.PAUSED || !pausedAt) return;

    const now = new Date();
    const pauseStart = new Date(pausedAt);
    const pauseDuration = Math.floor((now - pauseStart) / 1000);

    setPausedSeconds((prev) => prev + pauseDuration);
    setPausedAt(null);
    setStatus(ACTIVITY_STATUS.ACTIVE);
  }, [status, pausedAt]);

  // Terminer
  const complete = useCallback(() => {
    const now = new Date().toISOString();
    setEndedAt(now);
    setStatus(ACTIVITY_STATUS.COMPLETED);
    
    // Si en pause, ajoute la durée de pause finale
    if (status === ACTIVITY_STATUS.PAUSED && pausedAt) {
      const pauseStart = new Date(pausedAt);
      const pauseDuration = Math.floor((new Date(now) - pauseStart) / 1000);
      setPausedSeconds((prev) => prev + pauseDuration);
    }
  }, [status, pausedAt]);

  // Reset
  const reset = useCallback(() => {
    setStartedAt(null);
    setStatus(ACTIVITY_STATUS.PENDING);
    setPausedAt(null);
    setPausedSeconds(0);
    setEndedAt(null);
    setElapsedSeconds(0);
    setMovingSeconds(0);
  }, []);

  // Restaurer depuis un état
  const restore = useCallback((state) => {
    setStartedAt(state.startedAt);
    setStatus(state.status);
    setPausedAt(state.pausedAt || null);
    setPausedSeconds(state.pausedSeconds || 0);
    setEndedAt(state.endedAt || null);
    
    // Recalcule immédiatement
    setTimeout(() => updateElapsed(), 0);
  }, [updateElapsed]);

  return {
    elapsedSeconds,
    movingSeconds,
    pausedSeconds,
    status,
    startedAt,
    pausedAt,
    endedAt,
    start,
    pause,
    resume,
    complete,
    reset,
    restore,
  };
}
