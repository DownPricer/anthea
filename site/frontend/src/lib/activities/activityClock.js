/**
 * Horloge d'activité pure (calculs basés sur timestamps)
 */

import { ACTIVITY_STATUS } from './constants';

/**
 * Calcule le temps écoulé d'une activité à partir de ses timestamps
 * @param {Object} params
 * @param {string} params.startedAt - ISO timestamp de début
 * @param {string} params.status - Statut actuel
 * @param {string} [params.pausedAt] - ISO timestamp de pause
 * @param {number} [params.pausedSeconds] - Secondes en pause accumulées
 * @param {string} [params.endedAt] - ISO timestamp de fin
 * @param {Date} [params.now] - Date actuelle (défaut: new Date())
 * @returns {{elapsedSeconds: number, movingSeconds: number, pausedSeconds: number}}
 */
export function computeElapsed({
  startedAt,
  status,
  pausedAt = null,
  pausedSeconds = 0,
  endedAt = null,
  now = new Date(),
}) {
  if (!startedAt) {
    return { elapsedSeconds: 0, movingSeconds: 0, pausedSeconds: 0 };
  }

  const start = new Date(startedAt).getTime();
  const currentTime = status === ACTIVITY_STATUS.COMPLETED && endedAt
    ? new Date(endedAt).getTime()
    : now.getTime();

  const totalElapsed = Math.max(0, Math.floor((currentTime - start) / 1000));

  let currentPauseDuration = 0;
  if (status === ACTIVITY_STATUS.PAUSED && pausedAt) {
    const pauseStart = new Date(pausedAt).getTime();
    currentPauseDuration = Math.max(0, Math.floor((currentTime - pauseStart) / 1000));
  }

  const totalPaused = (pausedSeconds || 0) + currentPauseDuration;
  const movingSeconds = Math.max(0, totalElapsed - totalPaused);

  return {
    elapsedSeconds: totalElapsed,
    movingSeconds,
    pausedSeconds: totalPaused,
  };
}
