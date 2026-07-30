/**
 * Checkpoints serveur légers + flush hors-ligne.
 * Idempotence via clés activity:<id>:event:<eventId>
 */

import { activitiesApi } from '../api';
import {
  drainPoints,
  drainLaps,
  queueCheckpoint,
  drainCheckpoints,
  saveActiveActivity,
} from './activityStore';
import { TRACKING_MODES } from './constants';

export const CHECKPOINT_INTERVAL_MS = 12000;

export function buildEventIdempotencyKey(activityId, eventId) {
  return `activity:${activityId}:event:${eventId}`;
}

export function buildLapIdempotencyKey(activityId, clientEventId) {
  return `activity:${activityId}:lap:${clientEventId}`;
}

export function buildRouteChunkKey(activityId, sequence) {
  return `activity:${activityId}:route:${sequence}`;
}

function pickNewer(local, server) {
  if (!local) return { source: 'server', activity: server };
  if (!server) return { source: 'local', activity: local };
  const localTs = Date.parse(local.updated_at || local.clock?.pausedAt || local.clock?.startedAt || 0) || 0;
  const serverTs = Date.parse(server.updated_at || server.paused_at || server.started_at || 0) || 0;
  if (localTs > serverTs) return { source: 'local', activity: local };
  return { source: 'server', activity: server };
}

export function mergeLocalAndServer(local, server) {
  return pickNewer(local, server);
}

/**
 * Envoie un checkpoint métriques + lots GPS/laps en attente.
 * Ne jette pas : retourne { ok, offline }.
 */
export async function flushActivityCheckpoint(activityId, snapshot = {}) {
  if (!activityId) return { ok: false, offline: !navigator.onLine };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queueCheckpoint(activityId, {
      kind: 'metrics',
      payload: snapshot.metrics || {},
      event_id: snapshot.eventId || `cp-${Date.now()}`,
    });
    return { ok: false, offline: true };
  }

  try {
    const metrics = snapshot.metrics || {};
    if (Object.keys(metrics).length > 0) {
      const eventId = snapshot.eventId || `cp-${Date.now()}`;
      await activitiesApi.updateMetrics(activityId, {
        ...metrics,
        idempotency_key: buildEventIdempotencyKey(activityId, eventId),
      });
    }

    const pendingPoints = await drainPoints(activityId);
    if (pendingPoints.length > 0) {
      const chunkSize = 40;
      for (let i = 0; i < pendingPoints.length; i += chunkSize) {
        const chunk = pendingPoints.slice(i, i + chunkSize);
        const sequence = snapshot.routeSequence ?? Math.floor(Date.now() / 1000) + i;
        await activitiesApi.addPoints(activityId, {
          points: chunk.map((p, idx) => ({
            longitude: p.lon ?? p.longitude,
            latitude: p.lat ?? p.latitude,
            timestamp: p.timestamp,
            accuracy: p.accuracy,
            altitude: p.altitude,
            speed: p.speed,
            idempotency_key:
              p.idempotency_key ||
              buildRouteChunkKey(activityId, `${sequence}-${idx}`),
            after_pause: p.segment === 'new_segment',
            new_segment: p.segment === 'new_segment',
          })),
          idempotency_key: buildRouteChunkKey(activityId, sequence),
        });
      }
    }

    const pendingLaps = await drainLaps(activityId);
    for (const lap of pendingLaps) {
      await activitiesApi.addLaps(activityId, {
        action: lap.action || 'add',
        count: lap.count || 1,
        idempotency_key:
          lap.idempotency_key ||
          buildLapIdempotencyKey(activityId, lap.client_event_id || `${Date.now()}`),
      });
    }

    const queued = await drainCheckpoints(activityId);
    for (const cp of queued) {
      if (cp.kind === 'metrics' && cp.payload) {
        await activitiesApi.updateMetrics(activityId, {
          ...cp.payload,
          idempotency_key: buildEventIdempotencyKey(
            activityId,
            cp.event_id || cp.timestamp || Date.now(),
          ),
        });
      }
    }

    return { ok: true, offline: false };
  } catch (error) {
    if (!navigator.onLine || error?.response?.status >= 500 || !error?.response) {
      await queueCheckpoint(activityId, {
        kind: 'metrics',
        payload: snapshot.metrics || {},
        event_id: snapshot.eventId || `cp-fail-${Date.now()}`,
      });
      return { ok: false, offline: true };
    }
    return { ok: false, offline: false, error };
  }
}

/**
 * Dernier checkpoint au pagehide — fetch keepalive (pas de gros GPS).
 */
import { resolveApiBaseUrl } from '../apiBaseUrl';

export function keepaliveMetricsCheckpoint(activityId, metrics) {
  if (!activityId || !metrics) return;
  if (typeof fetch === 'undefined') return;
  try {
    fetch(`${resolveApiBaseUrl()}/activities/${activityId}/metrics`, {
      method: 'PATCH',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function persistLocalSnapshot(snapshot) {
  if (!snapshot?.activity_id && !snapshot?.id) return;
  const id = snapshot.activity_id || snapshot.id;
  await saveActiveActivity({
    id: 'current',
    activity_id: id,
    workout_session_id: snapshot.workout_session_id || null,
    workout_exercise_index: snapshot.workout_exercise_index ?? null,
    scheduled_workout_id: snapshot.scheduled_workout_id || null,
    preset_id: snapshot.preset_id || null,
    status: snapshot.status,
    started_at: snapshot.started_at,
    paused_at: snapshot.paused_at,
    accumulated_active_seconds: snapshot.moving_seconds ?? snapshot.accumulated_active_seconds,
    moving_seconds: snapshot.moving_seconds,
    paused_seconds: snapshot.paused_seconds,
    distance_meters: snapshot.distance_meters,
    laps: snapshot.laps,
    interval_state: snapshot.interval_state || null,
    last_gps_point: snapshot.last_gps_point || null,
    gpsPoints: snapshot.gpsPoints || [],
    tracking_mode: snapshot.tracking_mode,
    name: snapshot.name,
    clock: snapshot.clock,
    updated_at: new Date().toISOString(),
  });
}

export function buildMetricsFromMode({ mode, distanceMeters, laps, intervalState }) {
  const metrics = {};
  if (
    mode === TRACKING_MODES.MANUAL_DISTANCE ||
    mode === TRACKING_MODES.GPS ||
    mode === TRACKING_MODES.LAPS
  ) {
    metrics.distance_meters = distanceMeters;
  }
  if (mode === TRACKING_MODES.INTERVALS && intervalState) {
    metrics.interval_results = [
      {
        round: intervalState.round,
        phase: intervalState.phase,
        remaining: intervalState.remaining,
      },
    ];
  }
  return metrics;
}
