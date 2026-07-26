/**
 * Variante d'exercice tracké intégrée dans WorkoutPlayerPage.
 * Ne remplace ni le header ni la navigation du Player.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Minus, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useActivityClock } from '../../hooks/useActivityClock';
import { createLocationTracker } from '../../lib/activities/locationTracker';
import { TRACKING_MODES, GPS_STATES, ACTIVITY_STATUS } from '../../lib/activities/constants';
import {
  formatElapsed,
  formatDistanceMeters,
  formatPace,
} from '../../lib/activities/formatActivity';
import { calculateMovingDistance, calculateAveragePace } from '../../lib/activities/geo';
import {
  getActiveActivity,
  clearActiveActivity,
  queuePoints,
  queueLaps,
  hasSeenGpsKeepOpenTip,
  markGpsKeepOpenTipSeen,
} from '../../lib/activities/activityStore';
import {
  CHECKPOINT_INTERVAL_MS,
  flushActivityCheckpoint,
  keepaliveMetricsCheckpoint,
  buildMetricsFromMode,
  buildLapIdempotencyKey,
  persistLocalSnapshot,
} from '../../lib/activities/activityCheckpoint';
import { activitiesApi, formatApiError } from '../../lib/api';
import {
  getActivityTrackingMode,
  buildStartIdempotencyKey,
} from '../../lib/activities/workoutActivityExercise';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

export { buildStartIdempotencyKey };

function unwrapStartResponse(data) {
  if (data?.activity && typeof data.activity === 'object') {
    return {
      activity: data.activity,
      created: Boolean(data.created),
      resumed: Boolean(data.resumed),
    };
  }
  return { activity: data, created: true, resumed: false };
}

function applyActivityToState(activity, {
  setActivity,
  setPhase,
  startedRef,
  clock,
  setLaps,
  setManualDistance,
  mode,
  restartClock = false,
}) {
  setActivity(activity);
  setPhase('active');
  startedRef.current = true;
  if (restartClock) {
    clock.start();
  } else {
    clock.restore({
      startedAt: activity.started_at,
      status: activity.status || ACTIVITY_STATUS.ACTIVE,
      pausedAt: activity.paused_at,
      pausedSeconds: activity.paused_seconds || 0,
      endedAt: activity.ended_at,
    });
  }
  if (activity.laps) setLaps(activity.laps);
  if (activity.distance_meters && mode === TRACKING_MODES.MANUAL_DISTANCE) {
    setManualDistance(String((activity.distance_meters / 1000).toFixed(2)));
  }
}

export function TrackedActivityInPlayer({
  exercise,
  exerciseIndex,
  scheduledWorkoutId,
  workoutSessionId = null,
  exerciseName,
  onExerciseComplete,
  onRedirectToExercise = null,
  globalPaused = false,
}) {
  const { t } = useTranslation(['player', 'activity', 'common']);
  const mode = getActivityTrackingMode(exercise) || TRACKING_MODES.TIMER;
  const config = exercise?.activity_config || {};
  const presetId = exercise?.preset_id || (exercise?.exercise_id || '').replace(/^activity:/, '');

  const [phase, setPhase] = useState('ready'); // ready | active | finishing
  const [activity, setActivity] = useState(null);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [gpsState, setGpsState] = useState(GPS_STATES.IDLE);
  const [manualDistance, setManualDistance] = useState('');
  const [laps, setLaps] = useState(0);
  const [lapsPending, setLapsPending] = useState(false);
  const [intervalRound, setIntervalRound] = useState(1);
  const [intervalPhase, setIntervalPhase] = useState('work');
  const [intervalRemaining, setIntervalRemaining] = useState(0);
  const [startPending, setStartPending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [offlineSave, setOfflineSave] = useState(false);
  const [restoredBanner, setRestoredBanner] = useState(false);
  const [gpsKeepOpenTip, setGpsKeepOpenTip] = useState(false);

  const location = useLocation();
  const clock = useActivityClock();
  const locationTrackerRef = useRef(null);
  const syncRef = useRef(null);
  const intervalTimerRef = useRef(null);
  const startedRef = useRef(false);
  const startPendingRef = useRef(false);
  const toastShownRef = useRef(false);
  const recoveringRef = useRef(false);
  const distanceRef = useRef(0);
  const lapsRef = useRef(0);
  const activityRef = useRef(null);
  const modeRef = useRef(mode);
  const intervalStateRef = useRef({ round: 1, phase: 'work', remaining: 0 });
  const syncFnRef = useRef(async () => {});
  const persistFnRef = useRef(() => {});
  const clockRef = useRef(clock);
  const gpsPointsRef = useRef([]);

  const distanceMeters =
    mode === TRACKING_MODES.GPS
      ? calculateMovingDistance(gpsPoints)
      : mode === TRACKING_MODES.LAPS
        ? laps * (Number(config.pool_length_meters) || 25)
        : mode === TRACKING_MODES.MANUAL_DISTANCE
          ? (parseFloat(manualDistance) || 0) * 1000
          : Number(activity?.distance_meters) || 0;

  const paceMinPerKmRaw = calculateAveragePace(distanceMeters, clock.movingSeconds);
  const paceMinPerKm =
    Number.isFinite(paceMinPerKmRaw) && paceMinPerKmRaw > 0 ? paceMinPerKmRaw : null;
  const paceSecPerKm = paceMinPerKm != null ? paceMinPerKm * 60 : null;

  distanceRef.current = distanceMeters;
  lapsRef.current = laps;
  activityRef.current = activity;
  modeRef.current = mode;
  clockRef.current = clock;
  gpsPointsRef.current = gpsPoints;
  intervalStateRef.current = {
    round: intervalRound,
    phase: intervalPhase,
    remaining: intervalRemaining,
  };

  const persistSnapshotNow = useCallback(() => {
    const act = activityRef.current;
    const clk = clockRef.current;
    const points = gpsPointsRef.current || [];
    if (!act?.id) return;
    persistLocalSnapshot({
      activity_id: act.id,
      id: act.id,
      name: exerciseName,
      tracking_mode: modeRef.current,
      scheduled_workout_id: scheduledWorkoutId,
      workout_exercise_index: exerciseIndex,
      workout_session_id: workoutSessionId,
      preset_id: presetId,
      status: clk.status,
      started_at: clk.startedAt,
      paused_at: clk.pausedAt,
      moving_seconds: clk.movingSeconds,
      paused_seconds: clk.pausedSeconds,
      distance_meters: distanceRef.current,
      laps: lapsRef.current,
      interval_state: intervalStateRef.current,
      last_gps_point: points.length ? points[points.length - 1] : null,
      gpsPoints: points,
      clock: {
        startedAt: clk.startedAt,
        status: clk.status,
        pausedAt: clk.pausedAt,
        pausedSeconds: clk.pausedSeconds,
        endedAt: clk.endedAt,
      },
    }).catch(() => {});
  }, [exerciseName, scheduledWorkoutId, exerciseIndex, workoutSessionId, presetId]);

  const syncMetrics = useCallback(async () => {
    const act = activityRef.current;
    if (!act?.id) return;
    persistFnRef.current();
    const metrics = buildMetricsFromMode({
      mode: modeRef.current,
      distanceMeters: distanceRef.current,
      laps: lapsRef.current,
      intervalState: intervalStateRef.current,
    });
    const result = await flushActivityCheckpoint(act.id, {
      metrics,
      eventId: `cp-${Date.now()}`,
    });
    if (result.offline) setOfflineSave(true);
    else if (result.ok) setOfflineSave(false);
  }, []);

  syncFnRef.current = syncMetrics;
  persistFnRef.current = persistSnapshotNow;

  useEffect(() => {
    if (location?.state?.activityRestored) {
      setRestoredBanner(true);
      const tmr = setTimeout(() => setRestoredBanner(false), 2000);
      return () => clearTimeout(tmr);
    }
    return undefined;
  }, [location?.state?.activityRestored]);

  const isSameWorkoutSession = useCallback((current) => {
    if (!current) return false;
    if (
      scheduledWorkoutId &&
      String(current.scheduled_workout_id || '') === String(scheduledWorkoutId)
    ) {
      return true;
    }
    if (
      workoutSessionId &&
      String(current.workout_session_id || '') === String(workoutSessionId)
    ) {
      return true;
    }
    return false;
  }, [scheduledWorkoutId, workoutSessionId]);

  const isLinkedCurrent = useCallback((current) => {
    if (!current) return false;
    if (!['active', 'paused'].includes(current.status)) return false;
    const idx = current.workout_exercise_index;
    if (Number(idx) !== Number(exerciseIndex)) return false;
    return isSameWorkoutSession(current);
  }, [exerciseIndex, isSameWorkoutSession]);

  const redirectIfOtherExercise = useCallback((current) => {
    if (!current || !isSameWorkoutSession(current)) return false;
    const idx = Number(current.workout_exercise_index);
    if (!Number.isFinite(idx) || idx === Number(exerciseIndex)) return false;
    if (typeof onRedirectToExercise === 'function') {
      onRedirectToExercise(idx);
      return true;
    }
    return false;
  }, [exerciseIndex, isSameWorkoutSession, onRedirectToExercise]);

  // Reprise après reload — aucun POST start
  useEffect(() => {
    let cancelled = false;
    recoveringRef.current = true;
    (async () => {
      try {
        const { data } = await activitiesApi.getCurrent();
        const current = data?.activity;
        if (current && isLinkedCurrent(current)) {
          if (cancelled) return;
          applyActivityToState(current, {
            setActivity,
            setPhase,
            startedRef,
            clock,
            setLaps,
            setManualDistance,
            mode,
          });
          return;
        }
        // CAS B — autre exercice de la même séance déjà actif
        if (current && redirectIfOtherExercise(current)) {
          return;
        }
      } catch {
        /* ignore */
      }
      try {
        const local = await getActiveActivity();
        if (
          local &&
          Number(local.workout_exercise_index) === Number(exerciseIndex) &&
          ((scheduledWorkoutId &&
            String(local.scheduled_workout_id || '') === String(scheduledWorkoutId)) ||
            (workoutSessionId &&
              String(local.workout_session_id || '') === String(workoutSessionId)))
        ) {
          if (cancelled) return;
          applyActivityToState(
            {
              ...local,
              started_at: local.clock?.startedAt || local.started_at,
              status: local.clock?.status || local.status || ACTIVITY_STATUS.ACTIVE,
              paused_at: local.clock?.pausedAt,
              paused_seconds: local.clock?.pausedSeconds || 0,
            },
            {
              setActivity,
              setPhase,
              startedRef,
              clock,
              setLaps,
              setManualDistance,
              mode,
            },
          );
          if (local.gpsPoints) setGpsPoints(local.gpsPoints);
        }
      } catch {
        /* ignore */
      } finally {
        recoveringRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
      recoveringRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledWorkoutId, exerciseIndex, workoutSessionId]);

  useEffect(() => {
    if (phase !== 'active' || !activity) return;
    if (globalPaused && clock.status === ACTIVITY_STATUS.ACTIVE) {
      handlePause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalPaused]);

  useEffect(() => {
    if (mode !== TRACKING_MODES.GPS || phase !== 'active' || clock.status !== ACTIVITY_STATUS.ACTIVE) {
      return undefined;
    }
    startGps();
    return () => {
      if (locationTrackerRef.current) {
        locationTrackerRef.current.stop();
        locationTrackerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase, clock.status]);

  useEffect(() => {
    if (phase !== 'active' || !activity?.id) return undefined;
    const run = () => syncFnRef.current();
    syncRef.current = setInterval(run, CHECKPOINT_INTERVAL_MS);
    return () => clearInterval(syncRef.current);
  }, [phase, activity?.id]);

  useEffect(() => {
    const onOnline = () => {
      setOfflineSave(false);
      syncFnRef.current();
    };
    const onOffline = () => setOfflineSave(true);
    const onVis = () => {
      if (document.visibilityState === 'hidden' && activityRef.current?.id) {
        persistFnRef.current();
      }
      if (document.visibilityState === 'visible' && activityRef.current?.id) {
        syncFnRef.current();
      }
    };
    const onHide = () => {
      if (!activityRef.current?.id) return;
      persistFnRef.current();
      const metrics = buildMetricsFromMode({
        mode: modeRef.current,
        distanceMeters: distanceRef.current,
        laps: lapsRef.current,
        intervalState: intervalStateRef.current,
      });
      keepaliveMetricsCheckpoint(activityRef.current.id, metrics);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  useEffect(() => {
    if (mode !== TRACKING_MODES.INTERVALS || phase !== 'active' || clock.status !== ACTIVITY_STATUS.ACTIVE) {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      return undefined;
    }
    intervalTimerRef.current = setInterval(() => {
      setIntervalRemaining((prev) => {
        if (prev <= 1) {
          advanceInterval();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase, clock.status, intervalPhase, intervalRound]);

  useEffect(() => {
    if (!activity?.id || phase !== 'active') return;
    persistSnapshotNow();
  }, [
    activity,
    phase,
    clock.startedAt,
    clock.status,
    clock.pausedAt,
    clock.pausedSeconds,
    clock.movingSeconds,
    gpsPoints,
    laps,
    manualDistance,
    persistSnapshotNow,
    intervalRound,
    intervalPhase,
    intervalRemaining,
  ]);

  const advanceInterval = () => {
    const ic = config.interval_config || { work_seconds: 30, rest_seconds: 30, rounds: 8 };
    if (intervalPhase === 'work') {
      setIntervalPhase('rest');
      setIntervalRemaining(ic.rest_seconds || 30);
    } else {
      const next = intervalRound + 1;
      if (next > (ic.rounds || 8)) {
        setIntervalRemaining(0);
        return;
      }
      setIntervalRound(next);
      setIntervalPhase('work');
      setIntervalRemaining(ic.work_seconds || 30);
    }
    setTimeout(() => syncFnRef.current(), 0);
  };

  const startGps = async () => {
    if (locationTrackerRef.current) return;
    try {
      setGpsState(GPS_STATES.REQUESTING);
      const tracker = createLocationTracker();
      locationTrackerRef.current = tracker;
      tracker.subscribe((point) => {
        setGpsPoints((prev) => [...prev, point]);
        if (activityRef.current?.id) queuePoints(activityRef.current.id, [point]);
      });
      await tracker.start();
      setGpsState(GPS_STATES.TRACKING);
      if (!hasSeenGpsKeepOpenTip()) {
        setGpsKeepOpenTip(true);
        markGpsKeepOpenTipSeen();
      }
    } catch {
      setGpsState(GPS_STATES.ERROR);
      toast.error(t('activity:gps.permissionDenied', { defaultValue: 'Permission GPS refusée' }));
    }
  };

  const buildStartPayload = (extra = {}) => ({
    tracking_mode: mode,
    activity_kind: exercise.activity_kind || 'other',
    exercise_id: exercise.exercise_id,
    exercise_name_snapshot: exerciseName || exercise.name,
    exercise_name_i18n_snapshot: exercise.exercise_name_i18n_snapshot || {},
    pool_length_meters: config.pool_length_meters ?? (mode === TRACKING_MODES.LAPS ? 25 : null),
    interval_config: config.interval_config || null,
    visibility: 'private',
    scheduled_workout_id: scheduledWorkoutId,
    workout_exercise_index: exerciseIndex,
    workout_session_id: workoutSessionId,
    idempotency_key: buildStartIdempotencyKey({
      workoutSessionId,
      scheduledWorkoutId,
      exerciseIndex,
      presetId,
    }),
    force_discard_current: false,
    ...extra,
  });

  const activateFromStartData = (data, { restartClock = false } = {}) => {
    const { activity: started } = unwrapStartResponse(data);
    applyActivityToState(started, {
      setActivity,
      setPhase,
      startedRef,
      clock,
      setLaps,
      setManualDistance,
      mode,
      restartClock: restartClock || Boolean(data?.created),
    });
    if (mode === TRACKING_MODES.INTERVALS && data?.created) {
      const ic = config.interval_config || { work_seconds: 30, rest_seconds: 30, rounds: 8 };
      setIntervalRound(1);
      setIntervalPhase('work');
      setIntervalRemaining(ic.work_seconds || 30);
    }
  };

  const showStartErrorOnce = (message) => {
    if (toastShownRef.current) return;
    toastShownRef.current = true;
    toast.error(message);
    setTimeout(() => {
      toastShownRef.current = false;
    }, 1500);
  };

  const handleStart = async () => {
    if (startPendingRef.current || startedRef.current || recoveringRef.current) return;
    startPendingRef.current = true;
    setStartPending(true);
    toastShownRef.current = false;

    try {
      const { data } = await activitiesApi.start(buildStartPayload());
      const { activity: started } = unwrapStartResponse(data);
      // CAS B — backend a renvoyé l'activité d'un autre exercice de la séance
      if (
        started &&
        Number(started.workout_exercise_index) !== Number(exerciseIndex) &&
        redirectIfOtherExercise(started)
      ) {
        return;
      }
      activateFromStartData(data, { restartClock: Boolean(data?.created) });
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      // Filet de sécurité : résolution auto sans dialogue (backend ne doit plus 409 en parcours normal)
      if (status === 409) {
        const current = detail?.current_activity;
        const activityId = detail?.activity_id || current?.id;
        if (detail?.linked_to_current_exercise || (current && isLinkedCurrent(current))) {
          try {
            const { data } = await activitiesApi.getOne(activityId);
            activateFromStartData({ activity: data, created: false, resumed: true });
            return;
          } catch {
            /* fallthrough */
          }
        }
        if (current && redirectIfOtherExercise(current)) {
          return;
        }
        // Retry : le serveur pause l'orpheline et démarre
        try {
          const { data } = await activitiesApi.start(buildStartPayload());
          activateFromStartData(data, { restartClock: Boolean(data?.created) });
          return;
        } catch {
          /* fallthrough */
        }
      }
      showStartErrorOnce(
        formatApiError(error) ||
          t('player:tracked.errors.startFailed', {
            defaultValue: "Impossible de démarrer l'activité pour le moment.",
          }),
      );
    } finally {
      startPendingRef.current = false;
      setStartPending(false);
    }
  };

  const handlePause = useCallback(async () => {
    clock.pause();
    if (locationTrackerRef.current?.pause) {
      await locationTrackerRef.current.pause();
    }
    if (activity?.id) {
      try {
        await activitiesApi.pause(activity.id);
        await syncMetrics();
      } catch {
        setOfflineSave(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, clock]);

  const handleResume = async () => {
    clock.resume();
    if (locationTrackerRef.current?.resume) {
      await locationTrackerRef.current.resume();
    }
    if (activity?.id) {
      try {
        await activitiesApi.resume(activity.id);
        await syncMetrics();
      } catch {
        setOfflineSave(true);
      }
    }
  };

  const handleAddLaps = async (count) => {
    if (lapsPending) return;
    const next = Math.max(0, laps + count);
    setLapsPending(true);
    setLaps(next);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          /* ignore */
        }
      }
      if (activity?.id) {
        const clientEventId = `${Date.now()}:${count}:${Math.random().toString(36).slice(2, 8)}`;
        const idempotencyKey = buildLapIdempotencyKey(activity.id, clientEventId);
        if (!navigator.onLine) {
          await queueLaps(activity.id, [
            {
              action: count > 0 ? 'add' : 'undo',
              count: Math.abs(count),
              client_event_id: clientEventId,
              idempotency_key: idempotencyKey,
            },
          ]);
          setOfflineSave(true);
          persistSnapshotNow();
          return;
        }
        if (count > 0) {
          const { data } = await activitiesApi.addLaps(activity.id, {
            action: 'add',
            count,
            idempotency_key: idempotencyKey,
          });
          if (typeof data?.laps === 'number') setLaps(data.laps);
        } else if (count < 0) {
          const { data } = await activitiesApi.addLaps(activity.id, {
            action: 'undo',
            idempotency_key: idempotencyKey,
          });
          if (typeof data?.laps === 'number') setLaps(data.laps);
        }
        await syncMetrics();
      }
    } catch {
      if (activity?.id) {
        await queueLaps(activity.id, [
          {
            action: count > 0 ? 'add' : 'undo',
            count: Math.abs(count),
            client_event_id: `${Date.now()}`,
            idempotency_key: buildLapIdempotencyKey(activity.id, `${Date.now()}`),
          },
        ]);
        setOfflineSave(true);
      } else {
        setLaps((prev) => Math.max(0, prev - count));
      }
    } finally {
      window.setTimeout(() => setLapsPending(false), 280);
    }
  };

  const handleCompleteExercise = async () => {
    if (completing) return;
    setCompleting(true);
    setPhase('finishing');
    try {
      if (locationTrackerRef.current) {
        locationTrackerRef.current.stop();
        locationTrackerRef.current = null;
      }
      await syncMetrics();
      let summary = {
        activity_id: activity?.id,
        tracking_mode: mode,
        elapsed_seconds: clock.elapsedSeconds,
        moving_seconds: clock.movingSeconds,
        distance_meters: distanceMeters,
        laps: mode === TRACKING_MODES.LAPS ? laps : undefined,
        average_pace_seconds_per_km: paceSecPerKm,
        name: exerciseName || exercise.name,
        activity_kind: exercise.activity_kind,
      };
      if (activity?.id) {
        const completePayload = {};
        if (
          mode === TRACKING_MODES.MANUAL_DISTANCE ||
          mode === TRACKING_MODES.GPS ||
          mode === TRACKING_MODES.LAPS
        ) {
          completePayload.distance_meters = distanceMeters;
        }
        const { data } = await activitiesApi.complete(activity.id, completePayload);
        summary = {
          ...summary,
          ...data,
          activity_id: data.id || activity.id,
          name: exerciseName || exercise.name,
        };
      }
      await clearActiveActivity();
      onExerciseComplete?.(summary);
    } catch (error) {
      toast.error(formatApiError(error) || t('activity:errors.completeFailed', { defaultValue: 'Échec' }));
      setPhase('active');
    } finally {
      setCompleting(false);
    }
  };

  if (phase === 'ready') {
    return (
      <div className="w-full max-w-md space-y-4" data-testid="tracked-activity-ready">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-['Outfit'] break-words">
          {exerciseName}
        </h1>
        {mode === TRACKING_MODES.GPS ? (
          <p className="text-muted text-sm">
            {t('player:tracked.gpsHint', {
              defaultValue: 'Cette activité utilisera votre position pendant l’exercice.',
            })}
          </p>
        ) : (
          <p className="text-muted text-sm">
            {t('player:tracked.readyHint', {
              defaultValue: 'Appuyez sur Démarrer pour chronométrer cet exercice.',
            })}
          </p>
        )}
        <Button
          type="button"
          onClick={handleStart}
          disabled={startPending}
          data-testid="tracked-activity-start-btn"
          className="h-14 w-full rounded-2xl text-lg font-bold text-foreground btn-primary"
        >
          {startPending ? (
            <Loader2 size={22} className="mr-2 animate-spin" />
          ) : (
            <Play size={22} className="mr-2" fill="currentColor" />
          )}
          {startPending
            ? t('common:loading', { defaultValue: '…' })
            : t('player:tracked.start', { defaultValue: 'Démarrer' })}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-4" data-testid="tracked-activity-live">
      {restoredBanner ? (
        <p
          className="text-xs text-[var(--theme-primary)]"
          data-testid="tracked-activity-restored"
        >
          {t('player:tracked.restored', { defaultValue: 'Activité restaurée' })}
        </p>
      ) : null}
      {offlineSave ? (
        <p className="text-xs text-amber-400" data-testid="tracked-offline-save">
          {t('player:tracked.offlineSave', { defaultValue: 'Sauvegarde hors ligne' })}
        </p>
      ) : null}
      {gpsKeepOpenTip ? (
        <p className="text-xs text-muted" data-testid="tracked-gps-keep-open-tip">
          {t('player:tracked.gpsKeepOpen', {
            defaultValue:
              'Pour enregistrer tout le parcours, gardez FitGather ouvert et l’écran actif.',
          })}
        </p>
      ) : null}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-['Outfit'] break-words line-clamp-2">
        {exerciseName}
      </h1>

      {mode === TRACKING_MODES.INTERVALS ? (
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wider text-[var(--theme-primary)]">
            {intervalPhase === 'work'
              ? t('player:tracked.effort', { defaultValue: 'Effort' })
              : t('player:tracked.recovery', { defaultValue: 'Récupération' })}
          </p>
          <div
            className="text-6xl sm:text-7xl font-mono font-bold tabular-nums text-foreground"
            data-testid="tracked-activity-timer"
          >
            {formatElapsed(intervalRemaining, false)}
          </div>
          <p className="text-muted text-sm">
            {t('player:tracked.intervalRound', {
              current: intervalRound,
              total: config.interval_config?.rounds || 8,
              defaultValue: `Répétition ${intervalRound} / ${config.interval_config?.rounds || 8}`,
            })}
          </p>
        </div>
      ) : (
        <div
          className="text-6xl sm:text-7xl font-mono font-bold tabular-nums text-foreground"
          data-testid="tracked-activity-timer"
          style={{ textShadow: '0 0 30px var(--theme-primary-glow)' }}
        >
          {formatElapsed(clock.movingSeconds, true)}
        </div>
      )}

      {(mode === TRACKING_MODES.GPS || mode === TRACKING_MODES.MANUAL_DISTANCE) && (
        <div className="space-y-1" data-testid="tracked-activity-distance">
          <p className="text-2xl font-semibold text-foreground">
            {mode === TRACKING_MODES.MANUAL_DISTANCE && phase === 'active'
              ? `${manualDistance || '—'} km`
              : formatDistanceMeters(distanceMeters)}
          </p>
          {mode === TRACKING_MODES.GPS && paceMinPerKm != null && (
            <p className="text-muted text-sm">{formatPace(paceMinPerKm)}</p>
          )}
          {mode === TRACKING_MODES.GPS && gpsPoints.length > 1 && (
            <p className="text-xs text-subtle" data-testid="tracked-activity-route-hint">
              {t('player:tracked.routePoints', {
                count: gpsPoints.length,
                defaultValue: `${gpsPoints.length} points GPS`,
              })}
            </p>
          )}
          {mode === TRACKING_MODES.MANUAL_DISTANCE && (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={manualDistance}
              onChange={(e) => setManualDistance(e.target.value)}
              placeholder="km"
              className="mt-2 h-11 rounded-lg bg-surface-elevated border-border text-center text-foreground"
              data-testid="tracked-manual-distance-input"
            />
          )}
          {mode === TRACKING_MODES.GPS && gpsState === GPS_STATES.ERROR && (
            <p className="text-xs text-red-400">{t('activity:gps.permissionDenied')}</p>
          )}
        </div>
      )}

      {mode === TRACKING_MODES.LAPS && (
        <div className="w-full min-w-0 max-w-full space-y-2" data-testid="tracked-activity-laps">
          <p className="text-3xl font-bold text-foreground tabular-nums" data-testid="tracked-laps-count">
            {laps}{' '}
            <span className="text-base font-normal text-muted">
              {t('player:tracked.laps', { defaultValue: 'longueurs' })}
            </span>
          </p>
          <p className="text-muted text-sm" data-testid="tracked-laps-distance">
            {formatDistanceMeters(distanceMeters)}
          </p>
          <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAddLaps(1)}
              disabled={lapsPending}
              className="h-14 min-h-[56px] min-w-0 max-w-full border-border px-2 flex flex-col items-center justify-center gap-0.5"
              data-testid="tracked-lap-plus-1"
            >
              <span className="text-xl font-bold leading-none">+1</span>
              <span className="text-[11px] text-muted leading-tight">
                {t('player:tracked.lapUnit', { defaultValue: 'longueur' })}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAddLaps(2)}
              disabled={lapsPending}
              className="h-14 min-h-[56px] min-w-0 max-w-full border-border px-2 flex flex-col items-center justify-center gap-0.5"
              data-testid="tracked-lap-plus-2"
            >
              <span className="text-xl font-bold leading-none">+2</span>
              <span className="text-[11px] text-muted leading-tight">
                {t('player:tracked.roundTrip', { defaultValue: 'aller-retour' })}
              </span>
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleAddLaps(-1)}
            className="h-12 min-h-[48px] w-full min-w-0 max-w-full border-border"
            disabled={laps <= 0 || lapsPending}
            data-testid="tracked-lap-undo"
          >
            <Minus size={16} className="mr-1.5 shrink-0" />
            {t('player:tracked.undoLap', { defaultValue: 'Annuler la dernière' })}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => (clock.status === ACTIVITY_STATUS.PAUSED ? handleResume() : handlePause())}
          data-testid="tracked-activity-pause-btn"
          className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full text-foreground shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
          }}
          aria-label={clock.status === ACTIVITY_STATUS.PAUSED ? t('player:resume') : t('player:pause')}
        >
          {clock.status === ACTIVITY_STATUS.PAUSED ? (
            <Play size={22} fill="currentColor" />
          ) : (
            <Pause size={22} />
          )}
        </button>
      </div>

      <Button
        type="button"
        onClick={handleCompleteExercise}
        disabled={completing}
        data-testid="tracked-activity-finish-btn"
        className="h-12 sm:h-14 w-full max-w-md rounded-2xl text-base sm:text-lg font-bold text-foreground btn-primary"
      >
        {completing
          ? t('common:loading', { defaultValue: '…' })
          : t('player:tracked.finishExercise', { defaultValue: "Terminer l'exercice" })}
      </Button>
    </div>
  );
}
