/**
 * Page de suivi d'activité en direct
 * Mobile-first, compact, sync auto toutes les 20s
 * Gère tous les modes : timer, manual_distance, laps, intervals, gps
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Pause, 
  Play, 
  Check, 
  X, 
  Plus, 
  Minus,
  WifiOff,
  Navigation,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useActivityClock } from '../hooks/useActivityClock';
import { useWakeLock } from '../hooks/useWakeLock';
import { createLocationTracker } from '../lib/activities/locationTracker';
import { TRACKING_MODES, ACTIVITY_STATUS, GPS_STATES } from '../lib/activities/constants';
import { 
  formatElapsed, 
  formatDistanceMeters, 
  formatPace,
  formatSpeedKmh,
} from '../lib/activities/formatActivity';
import { calculateMovingDistance, calculateAveragePace } from '../lib/activities/geo';
import { 
  saveActiveActivity, 
  getActiveActivity, 
  queuePoints, 
  drainPoints,
  queueLaps,
  drainLaps,
} from '../lib/activities/activityStore';
import { activitiesApi, formatApiError } from '../lib/api';
import { toast } from 'sonner';

export function ActivityLivePage() {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['activity', 'common']);

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [gpsPoints, setGpsPoints] = useState([]);
  const [gpsState, setGpsState] = useState(GPS_STATES.IDLE);
  const [currentAccuracy, setCurrentAccuracy] = useState(null);
  const [manualDistance, setManualDistance] = useState(0);
  const [laps, setLaps] = useState([]);
  const [currentInterval, setCurrentInterval] = useState(0);

  const clock = useActivityClock();
  const wakeLock = useWakeLock();
  const locationTrackerRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const lastSyncRef = useRef(Date.now());

  // Charge l'activité
  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  // Sync automatique toutes les 12s + flush au retour réseau
  useEffect(() => {
    if (clock.status === ACTIVITY_STATUS.ACTIVE || clock.status === ACTIVITY_STATUS.PAUSED) {
      syncIntervalRef.current = setInterval(() => {
        syncMetrics();
      }, 12000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.status]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncMetrics();
    };
    const handleOffline = () => setIsOnline(false);
    const onVis = () => {
      if (document.visibilityState === 'visible') syncMetrics();
    };
    const onHide = () => {
      saveLocalState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gère le wake lock
  useEffect(() => {
    if (clock.status === ACTIVITY_STATUS.ACTIVE && wakeLock.supported) {
      wakeLock.requestWakeLock();
    } else {
      wakeLock.releaseWakeLock();
    }

    return () => wakeLock.releaseWakeLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.status, wakeLock.supported]);

  // Gère le GPS
  useEffect(() => {
    if (activity?.tracking_mode === TRACKING_MODES.GPS && clock.status === ACTIVITY_STATUS.ACTIVE) {
      startGpsTracking();
    }

    return () => {
      if (locationTrackerRef.current) {
        locationTrackerRef.current.stop();
        locationTrackerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.tracking_mode, clock.status]);

  // Sauvegarde locale continue
  useEffect(() => {
    if (activity) {
      saveLocalState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, clock, gpsPoints, laps, manualDistance]);

  const loadActivity = async () => {
    try {
      // Essaie de charger depuis le serveur
      const { data } = await activitiesApi.getOne(activityId);
      setActivity(data);

      // Restaure l'horloge
      clock.restore({
        startedAt: data.started_at,
        status: data.status,
        pausedAt: data.paused_at,
        pausedSeconds: data.paused_seconds || 0,
        endedAt: data.ended_at,
      });

      // Restaure les données
      if (data.gps_points) setGpsPoints(data.gps_points);
      if (data.laps) setLaps(data.laps);
      if (data.distance_meters) setManualDistance(data.distance_meters);

    } catch (error) {
      // Fallback : charge depuis IndexedDB
      const local = await getActiveActivity();
      if (local && local.id === activityId) {
        setActivity(local);
        clock.restore(local.clock || {});
        if (local.gpsPoints) setGpsPoints(local.gpsPoints);
        if (local.laps) setLaps(local.laps);
        if (local.manualDistance) setManualDistance(local.manualDistance);
      } else {
        toast.error(t('activity:errors.notFound'));
        navigate('/activity/start');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveLocalState = async () => {
    if (!activity) return;

    try {
      await saveActiveActivity({
        id: activity.id,
        name: activity.name,
        tracking_mode: activity.tracking_mode,
        kind: activity.kind,
        clock: {
          startedAt: clock.startedAt,
          status: clock.status,
          pausedAt: clock.pausedAt,
          pausedSeconds: clock.pausedSeconds,
          endedAt: clock.endedAt,
        },
        gpsPoints,
        laps,
        manualDistance,
      });
    } catch (error) {
      console.error('Failed to save local state:', error);
    }
  };

  const startGpsTracking = async () => {
    if (locationTrackerRef.current) return;

    try {
      setGpsState(GPS_STATES.REQUESTING);
      
      const tracker = createLocationTracker();
      locationTrackerRef.current = tracker;

      // S'abonne aux points
      tracker.subscribe((point) => {
        setGpsPoints((prev) => [...prev, point]);
        setCurrentAccuracy(point.accuracy);
        
        // Queue pour sync
        queuePoints(activityId, [point]);
      });

      await tracker.start();
      setGpsState(GPS_STATES.TRACKING);

    } catch (error) {
      setGpsState(GPS_STATES.ERROR);
      toast.error(t('activity:gps.permissionDenied'));
    }
  };

  const syncMetrics = async () => {
    if (!isOnline || syncing || !activity) return;

    setSyncing(true);
    try {
      if (activity.tracking_mode === TRACKING_MODES.MANUAL_DISTANCE) {
        await activitiesApi.updateMetrics(activityId, { distance_meters: manualDistance });
      }

      if (activity.tracking_mode === TRACKING_MODES.GPS) {
        const pendingPoints = await drainPoints(activityId);
        if (pendingPoints.length > 0) {
          await activitiesApi.addPoints(activityId, {
            points: pendingPoints.map((p) => ({
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

      lastSyncRef.current = Date.now();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handlePause = async () => {
    clock.pause();
    if (locationTrackerRef.current) {
      await locationTrackerRef.current.pause();
    }
    try {
      await activitiesApi.pause(activityId);
    } catch (error) {
      console.error('Pause sync failed:', error);
    }
  };

  const handleResume = async () => {
    clock.resume();
    if (locationTrackerRef.current) {
      await locationTrackerRef.current.resume();
    }
    try {
      await activitiesApi.resume(activityId);
    } catch (error) {
      console.error('Resume sync failed:', error);
    }
  };

  const handleComplete = async () => {
    clock.complete();
    if (locationTrackerRef.current) {
      await locationTrackerRef.current.stop();
      locationTrackerRef.current = null;
    }
    await syncMetrics();
    try {
      const payload = {};
      if (activity.tracking_mode === TRACKING_MODES.MANUAL_DISTANCE) {
        payload.distance_meters = manualDistance;
      }
      if (activity.tracking_mode === TRACKING_MODES.INTERVALS) {
        payload.interval_results = activity.interval_results || [];
      }
      await activitiesApi.complete(activityId, payload);
    } catch (error) {
      toast.error(formatApiError(error));
      return;
    }
    navigate(`/activity/${activityId}/summary`);
  };

  const handleDiscard = async () => {
    if (!window.confirm(t('activity:live.confirmDiscard'))) return;

    try {
      await activitiesApi.discard(activityId);
      toast.success(t('activity:live.discarded'));
      navigate('/workouts');
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const handleAddLap = async (count = 1) => {
    try {
      const idem = `${Date.now()}-${count}`;
      const { data } = await activitiesApi.addLaps(activityId, {
        action: 'add',
        count,
        idempotency_key: idem,
      });
      setActivity(data);
      setLaps(Array(data.laps || 0).fill(null));
      toast.success(t('activity:live.lapAdded', { count }));
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const handleUndoLap = async () => {
    try {
      const { data } = await activitiesApi.addLaps(activityId, { action: 'undo' });
      setActivity(data);
      setLaps(Array(data.laps || 0).fill(null));
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const handleDistanceChange = (delta) => {
    setManualDistance((prev) => Math.max(0, prev + delta));
  };

  // Calcule les métriques
  const distance = activity?.tracking_mode === TRACKING_MODES.GPS
    ? calculateMovingDistance(gpsPoints)
    : manualDistance;

  const pace = distance > 0 && clock.movingSeconds > 0
    ? calculateAveragePace(distance, clock.movingSeconds)
    : Infinity;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header compact */}
      <div className="bg-surface border-b border-border p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-active rounded-full transition-colors"
          >
            <ArrowLeft className="text-foreground" size={20} />
          </button>
          <h1 className="text-lg font-medium text-foreground truncate flex-1 mx-3">
            {activity?.name}
          </h1>
          {!isOnline && (
            <div className="flex items-center gap-1 text-amber-400 text-xs">
              <WifiOff size={14} />
              {t('activity:live.offline')}
            </div>
          )}
        </div>
      </div>

      {/* Chronomètre principal */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <div className="text-6xl font-bold text-foreground mb-2 tabular-nums">
            {formatElapsed(clock.elapsedSeconds, true)}
          </div>
          <div className="text-sm text-muted">
            {t(`activity:status.${clock.status}`, { defaultValue: clock.status })}
          </div>
        </div>

        {/* Métriques selon le mode */}
        <div className="w-full max-w-md space-y-4">
          {activity?.tracking_mode === TRACKING_MODES.GPS && (
            <GPSMetrics
              distance={distance}
              pace={pace}
              accuracy={currentAccuracy}
              gpsState={gpsState}
              t={t}
            />
          )}

          {activity?.tracking_mode === TRACKING_MODES.MANUAL_DISTANCE && (
            <ManualDistanceControls
              distance={distance}
              onDistanceChange={handleDistanceChange}
              t={t}
            />
          )}

          {activity?.tracking_mode === TRACKING_MODES.LAPS && (
            <LapsControls
              laps={laps}
              onAddLap={handleAddLap}
              onUndoLap={handleUndoLap}
              t={t}
            />
          )}

          {activity?.tracking_mode === TRACKING_MODES.INTERVALS && (
            <IntervalsDisplay
              intervals={activity.intervals || []}
              currentInterval={currentInterval}
              elapsedSeconds={clock.elapsedSeconds}
              t={t}
            />
          )}
        </div>
      </div>

      {/* Contrôles */}
      <div className="bg-surface border-t border-border p-4 space-y-3">
        {clock.status === ACTIVITY_STATUS.ACTIVE && (
          <Button
            onClick={handlePause}
            size="lg"
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Pause size={20} className="mr-2" />
            {t('activity:live.pause')}
          </Button>
        )}

        {clock.status === ACTIVITY_STATUS.PAUSED && (
          <Button
            onClick={handleResume}
            size="lg"
            className="w-full bg-[var(--theme-primary)] text-foreground"
          >
            <Play size={20} className="mr-2" fill="currentColor" />
            {t('activity:live.resume')}
          </Button>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleComplete}
            size="lg"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check size={20} className="mr-2" />
            {t('activity:live.complete')}
          </Button>
          <Button
            onClick={handleDiscard}
            size="lg"
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <X size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function GPSMetrics({ distance, pace, accuracy, gpsState, t }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricCard label={t('activity:metrics.distance')} value={formatDistanceMeters(distance)} />
      <MetricCard label={t('activity:metrics.pace')} value={formatPace(pace)} />
      <MetricCard
        label={t('activity:metrics.accuracy')}
        value={accuracy ? `${Math.round(accuracy)}m` : '--'}
      />
      <MetricCard
        label={t('activity:gps.status')}
        value={t(`activity:gps.states.${gpsState}`, { defaultValue: gpsState })}
        icon={<Navigation size={16} />}
      />
    </div>
  );
}

function ManualDistanceControls({ distance, onDistanceChange, t }) {
  return (
    <div className="space-y-4">
      <MetricCard label={t('activity:metrics.distance')} value={formatDistanceMeters(distance)} large />
      <div className="flex gap-3">
        <Button onClick={() => onDistanceChange(-100)} variant="outline" className="flex-1">
          <Minus size={18} className="mr-1" />
          100m
        </Button>
        <Button onClick={() => onDistanceChange(100)} variant="outline" className="flex-1">
          <Plus size={18} className="mr-1" />
          100m
        </Button>
      </div>
    </div>
  );
}

function LapsControls({ laps, onAddLap, onUndoLap, t }) {
  return (
    <div className="space-y-4">
      <MetricCard label={t('activity:metrics.laps')} value={laps.length.toString()} large />
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => onAddLap(1)} className="bg-[var(--theme-primary)] text-foreground">
          +1
        </Button>
        <Button onClick={() => onAddLap(2)} className="bg-[var(--theme-primary)] text-foreground">
          +2
        </Button>
        <Button onClick={onUndoLap} variant="outline" disabled={laps.length === 0}>
          {t('activity:live.undo')}
        </Button>
      </div>
    </div>
  );
}

function IntervalsDisplay({ intervals, currentInterval, elapsedSeconds, t }) {
  const current = intervals[currentInterval];
  
  return (
    <div className="space-y-4">
      <MetricCard
        label={t('activity:live.currentPhase')}
        value={current ? t(`activity:intervals.${current.type}`) : '--'}
        large
      />
      <div className="text-center">
        <p className="text-muted text-sm">
          {t('activity:live.round', { current: currentInterval + 1, total: intervals.length })}
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, large = false }) {
  return (
    <div className="bg-hover rounded-xl p-4 text-center">
      <p className="text-subtle text-xs mb-1">{label}</p>
      <p className={`text-foreground font-bold flex items-center justify-center gap-1 ${large ? 'text-3xl' : 'text-xl'}`}>
        {icon}
        {value}
      </p>
    </div>
  );
}
