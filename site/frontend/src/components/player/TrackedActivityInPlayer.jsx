/**
 * Variante d'exercice tracké intégrée dans WorkoutPlayerPage.
 * Ne remplace ni le header ni la navigation du Player.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, Plus, Minus, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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
  saveActiveActivity,
  getActiveActivity,
  clearActiveActivity,
  queuePoints,
  drainPoints,
} from '../../lib/activities/activityStore';
import { activitiesApi, formatApiError } from '../../lib/api';
import {
  getActivityTrackingMode,
  buildStartIdempotencyKey,
} from '../../lib/activities/workoutActivityExercise';
import { toast } from 'sonner';

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
  globalPaused = false,
}) {
  const { t } = useTranslation(['player', 'activity', 'common']);
  const navigate = useNavigate();
  const mode = getActivityTrackingMode(exercise) || TRACKING_MODES.TIMER;
  const config = exercise?.activity_config || {};
  const presetId = exercise?.preset_id || (exercise?.exercise_id || '').replace(/^activity:/, '');

  const [phase, setPhase] = useState('ready'); // ready | active | finishing
  const [activity, setActivity] = useState(null);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [gpsState, setGpsState] = useState(GPS_STATES.IDLE);
  const [manualDistance, setManualDistance] = useState('');
  const [laps, setLaps] = useState(0);
  const [intervalRound, setIntervalRound] = useState(1);
  const [intervalPhase, setIntervalPhase] = useState('work');
  const [intervalRemaining, setIntervalRemaining] = useState(0);
  const [startPending, setStartPending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [conflictActivity, setConflictActivity] = useState(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);

  const clock = useActivityClock();
  const locationTrackerRef = useRef(null);
  const syncRef = useRef(null);
  const intervalTimerRef = useRef(null);
  const startedRef = useRef(false);
  const startPendingRef = useRef(false);
  const toastShownRef = useRef(false);
  const recoveringRef = useRef(false);

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

  const isLinkedCurrent = useCallback((current) => {
    if (!current) return false;
    if (!['active', 'paused'].includes(current.status)) return false;
    const idx = current.workout_exercise_index;
    if (Number(idx) !== Number(exerciseIndex)) return false;
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
  }, [exerciseIndex, scheduledWorkoutId, workoutSessionId]);

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
    syncRef.current = setInterval(() => syncMetrics(), 20000);
    return () => clearInterval(syncRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, activity?.id, gpsPoints, laps, manualDistance]);

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
    saveActiveActivity({
      id: activity.id,
      name: exerciseName,
      tracking_mode: mode,
      scheduled_workout_id: scheduledWorkoutId,
      workout_exercise_index: exerciseIndex,
      workout_session_id: workoutSessionId,
      clock: {
        startedAt: clock.startedAt,
        status: clock.status,
        pausedAt: clock.pausedAt,
        pausedSeconds: clock.pausedSeconds,
        endedAt: clock.endedAt,
      },
      gpsPoints,
      laps,
      manualDistance: parseFloat(manualDistance) || 0,
    }).catch(() => {});
  }, [
    activity,
    phase,
    clock,
    gpsPoints,
    laps,
    manualDistance,
    exerciseName,
    mode,
    scheduledWorkoutId,
    exerciseIndex,
    workoutSessionId,
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
  };

  const startGps = async () => {
    if (locationTrackerRef.current) return;
    try {
      setGpsState(GPS_STATES.REQUESTING);
      const tracker = createLocationTracker();
      locationTrackerRef.current = tracker;
      tracker.subscribe((point) => {
        setGpsPoints((prev) => [...prev, point]);
        if (activity?.id) queuePoints(activity.id, [point]);
      });
      await tracker.start();
      setGpsState(GPS_STATES.TRACKING);
    } catch {
      setGpsState(GPS_STATES.ERROR);
      toast.error(t('activity:gps.permissionDenied', { defaultValue: 'Permission GPS refusée' }));
    }
  };

  const syncMetrics = async () => {
    if (!activity?.id) return;
    try {
      if (mode === TRACKING_MODES.MANUAL_DISTANCE) {
        await activitiesApi.updateMetrics(activity.id, {
          distance_meters: (parseFloat(manualDistance) || 0) * 1000,
        });
      }
      if (mode === TRACKING_MODES.GPS) {
        const pending = await drainPoints(activity.id);
        if (pending.length > 0) {
          await activitiesApi.addPoints(activity.id, {
            points: pending.map((p) => ({
              longitude: p.lon ?? p.longitude,
              latitude: p.lat ?? p.latitude,
              timestamp: p.timestamp,
              accuracy: p.accuracy,
              altitude: p.altitude,
              speed: p.speed,
              idempotency_key: p.idempotency_key || `${p.timestamp}-${p.lat}-${p.lon}`,
              after_pause: p.segment === 'new_segment',
              new_segment: p.segment === 'new_segment',
            })),
          });
        }
      }
      if (mode === TRACKING_MODES.LAPS) {
        await activitiesApi.updateMetrics(activity.id, {
          distance_meters: distanceMeters,
        });
      }
    } catch {
      /* sync silencieuse */
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
      activateFromStartData(data, { restartClock: Boolean(data?.created) });
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (status === 409) {
        const current = detail?.current_activity;
        const activityId = detail?.activity_id || current?.id;
        // Même activité liée déjà en cours — récupérer sans erreur
        if (detail?.linked_to_current_exercise || (current && isLinkedCurrent(current))) {
          try {
            const { data } = await activitiesApi.getOne(activityId);
            activateFromStartData({ activity: data, created: false, resumed: true });
            return;
          } catch {
            /* fallthrough */
          }
        }
        if (current || activityId) {
          setConflictActivity(current || { id: activityId });
          setConflictOpen(true);
          return;
        }
        showStartErrorOnce(
          t('player:tracked.errors.anotherActive', {
            defaultValue: 'Une autre activité est déjà en cours.',
          }),
        );
        return;
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

  const handleConflictResume = () => {
    const other = conflictActivity;
    setConflictOpen(false);
    if (!other) return;
    if (other.scheduled_workout_id) {
      navigate(`/player/${other.scheduled_workout_id}`);
      return;
    }
    if (other.id) {
      navigate(`/activity/${other.id}/live`);
    }
  };

  const handleConflictDiscardAndStart = async () => {
    if (conflictBusy || startPendingRef.current) return;
    setConflictBusy(true);
    startPendingRef.current = true;
    setStartPending(true);
    try {
      const otherId = conflictActivity?.id;
      if (otherId) {
        await activitiesApi.discard(otherId);
        await clearActiveActivity();
      }
      setConflictOpen(false);
      setConflictActivity(null);
      const { data } = await activitiesApi.start(
        buildStartPayload({ force_discard_current: true }),
      );
      activateFromStartData(data, { restartClock: true });
    } catch (error) {
      showStartErrorOnce(
        formatApiError(error) ||
          t('player:tracked.errors.startFailed', {
            defaultValue: "Impossible de démarrer l'activité pour le moment.",
          }),
      );
    } finally {
      setConflictBusy(false);
      startPendingRef.current = false;
      setStartPending(false);
    }
  };

  const handleConflictCancel = () => {
    setConflictOpen(false);
    setConflictActivity(null);
  };

  const handlePause = useCallback(async () => {
    clock.pause();
    if (locationTrackerRef.current?.pause) {
      await locationTrackerRef.current.pause();
    }
    if (activity?.id) {
      try {
        await activitiesApi.pause(activity.id);
      } catch {
        /* ignore */
      }
    }
  }, [activity, clock]);

  const handleResume = async () => {
    clock.resume();
    if (locationTrackerRef.current?.resume) {
      await locationTrackerRef.current.resume();
    }
    if (activity?.id) {
      try {
        await activitiesApi.resume(activity.id);
      } catch {
        /* ignore */
      }
    }
  };

  const handleAddLaps = async (count) => {
    const next = Math.max(0, laps + count);
    setLaps(next);
    if (activity?.id) {
      try {
        if (count > 0) {
          await activitiesApi.addLaps(activity.id, { action: 'add', count });
        } else if (count < 0) {
          await activitiesApi.addLaps(activity.id, { action: 'undo' });
        }
      } catch {
        /* ignore */
      }
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

        <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
          <DialogContent className="bg-surface-elevated border-border max-w-sm mx-4">
            <DialogHeader>
              <DialogTitle className="text-foreground text-center">
                {t('player:tracked.conflict.title', {
                  defaultValue: 'Une autre activité est déjà en cours',
                })}
              </DialogTitle>
              <DialogDescription className="text-muted text-center pt-2">
                {t('player:tracked.conflict.description', {
                  defaultValue:
                    'Choisissez de reprendre, d’abandonner ou de conserver l’activité actuellement en cours.',
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Button
                type="button"
                onClick={handleConflictResume}
                disabled={conflictBusy}
                data-testid="tracked-conflict-resume"
                className="w-full h-12 rounded-xl btn-primary text-foreground"
              >
                {t('player:tracked.conflict.resume', {
                  defaultValue: 'Reprendre l’activité existante',
                })}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleConflictDiscardAndStart}
                disabled={conflictBusy}
                data-testid="tracked-conflict-discard-start"
                className="w-full h-12 rounded-xl border-border text-foreground"
              >
                {conflictBusy ? (
                  <Loader2 size={18} className="mr-2 animate-spin" />
                ) : null}
                {t('player:tracked.conflict.discardAndStart', {
                  defaultValue: 'Abandonner et démarrer celle-ci',
                })}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleConflictCancel}
                disabled={conflictBusy}
                data-testid="tracked-conflict-cancel"
                className="w-full h-11 rounded-xl border-border text-muted"
              >
                {t('player:tracked.conflict.cancel', { defaultValue: 'Annuler' })}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-4" data-testid="tracked-activity-live">
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
        <div className="space-y-3" data-testid="tracked-activity-laps">
          <p className="text-3xl font-bold text-foreground">
            {laps}{' '}
            <span className="text-base font-normal text-muted">
              {t('player:tracked.laps', { defaultValue: 'longueurs' })}
            </span>
          </p>
          <p className="text-muted">{formatDistanceMeters(distanceMeters)}</p>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddLaps(1)}
              className="border-border"
              data-testid="tracked-lap-plus-1"
            >
              <Plus size={14} className="mr-1" /> +1
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddLaps(2)}
              className="border-border"
            >
              <Plus size={14} className="mr-1" /> +2
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddLaps(-1)}
              className="border-border"
              disabled={laps <= 0}
            >
              <Minus size={14} className="mr-1" />
              {t('player:tracked.undoLap', { defaultValue: 'Annuler' })}
            </Button>
          </div>
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
