import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, sessionsApi, streakApi, partnerApi, postsApi } from '../lib/api';
import { invalidateHomeWeekCache } from '../lib/homeCache';
import { invalidateBadgesForUser } from '../lib/badgesCache';
import { heroPlayerKind, heroSnapshot } from '../lib/heroChallenges';
import { HeroAmrapPlayer } from '../components/hero/HeroAmrapPlayer';
import { HeroRoundsPlayer } from '../components/hero/HeroRoundsPlayer';
import { HeroResultScreen } from '../components/hero/HeroResultScreen';
import { resolveExerciseMediaUrl } from '../lib/exerciseMedia';
import { getLocalizedExerciseField } from '../lib/exerciseLocale';
import { useWakeLock } from '../hooks/useWakeLock';
import { estimateCalories, formatCalories } from '../lib/calories';
import { playShortBeep, vibrateShort } from '../lib/workoutFeedback';
import { LiveWorkoutReactions } from '../components/LiveWorkoutReactions';
import { ShareWorkoutDialog } from '../components/social/ShareWorkoutDialog';
import { TrackedActivityInPlayer } from '../components/player/TrackedActivityInPlayer';
import {
  isTrackedActivityExercise,
  getActivityTrackingMode,
} from '../lib/activities/workoutActivityExercise';
import {
  getKeepScreenAwakePref,
  setKeepScreenAwakePref,
} from '../lib/activities/activityStore';
import { formatElapsed, formatDistanceMeters, formatPace } from '../lib/activities/formatActivity';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Slider } from '../components/ui/slider';
import { Textarea } from '../components/ui/textarea';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Play,
  Pause,
  Plus,
  X,
  Volume2,
  VolumeX,
  StopCircle,
  RotateCcw,
  Trophy,
  Loader2,
  Save,
  Music,
  Radio,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

export function WorkoutPlayerPage() {
  const { t, i18n } = useTranslation(['player', 'common', 'workouts']);
  const { workoutId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('preparation'); // preparation, countdown, exercise, rest, finished
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [totalTime, setTotalTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
  const [exercisesCompleted, setExercisesCompleted] = useState(0);
  // Par exercice: 'completed' | 'skipped' (absence = non fait / pas atteint)
  const [exerciseOutcomes, setExerciseOutcomes] = useState({});
  // Résumés d'activités trackées par index d'exercice
  const [activitySummaries, setActivitySummaries] = useState({});
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [musicMode, setMusicMode] = useState(false);
  const [partnerLive, setPartnerLive] = useState(null);
  const [duoLive, setDuoLive] = useState(false);
  const [partnerProgress, setPartnerProgress] = useState(null);
  const [partnerReconnecting, setPartnerReconnecting] = useState(false);
  const lastKnownPartnerProgressRef = useRef(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [createdSession, setCreatedSession] = useState(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [heroOutcome, setHeroOutcome] = useState(null);
  const [heroPublishing, setHeroPublishing] = useState(false);
  const { supported: wakeLockSupported, active: wakeLockActive, error: wakeLockError, requestWakeLock, releaseWakeLock } = useWakeLock();
  const [showStopModal, setShowStopModal] = useState(false);
  const [savedProgress, setSavedProgress] = useState(null);

  // Feedback state
  const [fatigueBefore, setFatigueBefore] = useState(5);
  const [fatigueAfter, setFatigueAfter] = useState(5);
  const [difficultyFelt, setDifficultyFelt] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [canAdjustTime, setCanAdjustTime] = useState(false);
  const [showTimeAdjust, setShowTimeAdjust] = useState(false);
  const [adjustTotalMin, setAdjustTotalMin] = useState('0');
  const [adjustTotalSec, setAdjustTotalSec] = useState('0');
  const [adjustPauseMin, setAdjustPauseMin] = useState('0');
  const [adjustPauseSec, setAdjustPauseSec] = useState('0');

  const timerRef = useRef(null);
  const totalTimeRef = useRef(null);
  const pauseTimeRef = useRef(null);
  const pauseStartRef = useRef(null);
  const longPressTimerRef = useRef(null);

  // Flatten exercises
  const getAllExercises = useCallback(() => {
    if (!workout) return [];
    return workout.blocks.flatMap((block) => 
      (block.exercises || []).map((ex) => ({ ...ex, blockType: block.block_type }))
    );
  }, [workout]);

  const allExercises = getAllExercises();
  const currentExercise = allExercises[currentExerciseIndex];
  const localizedCurrentName = currentExercise
    ? getLocalizedExerciseField(currentExercise, 'name', i18n.language)
    : '';
  const totalExercises = allExercises.length;
  const progress = totalExercises > 0 ? ((exercisesCompleted / totalExercises) * 100) : 0;
  const completedCount = Object.values(exerciseOutcomes).filter((v) => v === 'completed').length;
  const skippedCount = Object.values(exerciseOutcomes).filter((v) => v === 'skipped').length;

  const isLongMessage = (text) => (text || '').length > 12 || (text || '').includes(' ');

  const speechLangMap = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };
  const speechLang = speechLangMap[i18n.language?.split('-')[0]] || 'fr-FR';

  // TTS / feedback — mode musique : bips courts, pas de longues annonces
  const speak = useCallback((text, { forceShort = false } = {}) => {
    const useMusicFeedback = musicMode || !ttsEnabled;

    if (useMusicFeedback) {
      if (forceShort || !isLongMessage(text)) {
        playShortBeep(880, 60);
        vibrateShort(30);
      } else {
        vibrateShort(50);
      }
      return;
    }

    if (!('speechSynthesis' in window)) return;

    // Ne pas appeler cancel() systématiquement — évite de couper Spotify hors mode TTS long
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang;
    utterance.rate = 1;
    utterance.volume = 0.85;
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled, musicMode, speechLang]);

  // Load workout and check for saved progress
  useEffect(() => {
    loadWorkout();
  }, [workoutId]);

  useEffect(() => {
    streakApi.getCoachStatus()
      .then((res) => setCanAdjustTime(!!res.data?.can_moderate))
      .catch(() => setCanAdjustTime(false));
  }, []);

  const loadWorkout = async () => {
    try {
      const [workoutRes, progressRes] = await Promise.all([
        workoutsApi.getOne(workoutId),
        workoutsApi.getProgress(workoutId).catch(() => ({ data: null }))
      ]);
      
      setWorkout(workoutRes.data);
      setTtsEnabled(user?.tts_enabled !== false);
      setMusicMode(!!user?.music_mode);
      // Reset état du player quand on charge une nouvelle séance
      setPhase('preparation');
      setCurrentBlockIndex(0);
      setCurrentExerciseIndex(0);
      setTimeRemaining(5);
      setIsPaused(false);
      setTotalTime(0);
      setPauseTime(0);
      setExercisesCompleted(0);
      setExerciseOutcomes({});
      setActivitySummaries({});
      
      if (progressRes.data) {
        setSavedProgress(progressRes.data);
      }
    } catch (error) {
      toast.error(t('player:toast.loadError'));
      navigate('/workouts');
    } finally {
      setLoading(false);
    }
  };

  const resumeFromProgress = () => {
    if (!savedProgress) return;
    
    setCurrentExerciseIndex(savedProgress.current_exercise_index);
    setCurrentBlockIndex(savedProgress.current_block_index);
    setTotalTime(savedProgress.time_elapsed);
    setPauseTime(savedProgress.pause_time);
    setExercisesCompleted(savedProgress.exercises_completed);
    setSavedProgress(null);
    
    setPhase('countdown');
    setTimeRemaining(3);
    speak(t('player:tts.resumeSession'));
  };

  const startFresh = async () => {
    // Clear saved progress
    try {
      await workoutsApi.clearProgress(workoutId);
    } catch (e) {
      // Ignore
    }
    setSavedProgress(null);
    startWorkout();
  };

  // Total time tracker
  useEffect(() => {
    totalTimeRef.current = setInterval(() => {
      if (!isPaused && phase !== 'preparation' && phase !== 'finished') {
        setTotalTime((prev) => prev + 1);
      }
    }, 1000);

    return () => {
      if (totalTimeRef.current) clearInterval(totalTimeRef.current);
    };
  }, [isPaused, phase]);

  // Pause time tracker
  useEffect(() => {
    if (isPaused && phase !== 'finished') {
      pauseStartRef.current = Date.now();
      pauseTimeRef.current = setInterval(() => {
        setPauseTime((prev) => prev + 1);
      }, 1000);
    } else if (pauseTimeRef.current) {
      clearInterval(pauseTimeRef.current);
    }

    return () => {
      if (pauseTimeRef.current) clearInterval(pauseTimeRef.current);
    };
  }, [isPaused, phase]);

  const isDurationExercise =
    phase === 'exercise' &&
    currentExercise?.exercise_type === 'duration' &&
    !isTrackedActivityExercise(currentExercise);

  const isCurrentTracked = isTrackedActivityExercise(currentExercise);

  // Main timer (repos + exercices en durée uniquement — pas de chrono pour les séries en reps)
  useEffect(() => {
    if (isPaused || phase === 'preparation' || phase === 'finished') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (phase === 'exercise' && !isDurationExercise) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleTimerComplete();
          return 0;
        }
        
        // Announce countdown
        if (prev <= 4 && prev > 1) {
          speak(String(prev - 1));
        }
        
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, phase, currentExerciseIndex, isDurationExercise]);

  const finishExercisePhase = () => {
    if (currentExercise?.rest_after > 0) {
      setPhase('rest');
      setTimeRemaining(currentExercise.rest_after);
      speak(t('player:tts.rest'));
    } else {
      moveToNextExercise();
    }
  };

  const markOutcome = (index, outcome) => {
    setExerciseOutcomes((prev) => ({ ...prev, [index]: outcome }));
  };

  const completeCurrentExercise = () => {
    if (phase !== 'exercise' || !currentExercise) return;
    if (isTrackedActivityExercise(currentExercise)) return;
    markOutcome(currentExerciseIndex, 'completed');
    finishExercisePhase();
  };

  const completeTrackedActivity = (summary) => {
    if (phase !== 'exercise' || !currentExercise) return;
    markOutcome(currentExerciseIndex, 'completed');
    setActivitySummaries((prev) => ({
      ...prev,
      [currentExerciseIndex]: summary,
    }));
    finishExercisePhase();
  };

  const skipCurrentExercise = () => {
    if (!currentExercise) return;
    if (phase !== 'exercise' && phase !== 'countdown') return;
    markOutcome(currentExerciseIndex, 'skipped');
    skipExercise();
  };

  const skipRest = () => {
    if (phase !== 'rest') return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeRemaining(0);
    moveToNextExercise();
  };

  const handleTimerComplete = () => {
    if (phase === 'countdown') {
      startExercise();
    } else if (phase === 'exercise' && currentExercise?.exercise_type === 'duration') {
      completeCurrentExercise();
    } else if (phase === 'rest') {
      moveToNextExercise();
    }
  };

  const startWorkout = () => {
    setPhase('countdown');
    setTimeRemaining(3);
    speak(t('player:tts.getReady'));
  };

  const startExercise = () => {
    if (!currentExercise) {
      finishWorkout('completed');
      return;
    }

    setPhase('exercise');

    if (isTrackedActivityExercise(currentExercise)) {
      setTimeRemaining(0);
    } else if (currentExercise.exercise_type === 'duration') {
      setTimeRemaining(currentExercise.duration || 30);
    } else {
      setTimeRemaining(0);
    }

    if (currentExercise.tts_enabled) {
      speak(localizedCurrentName || currentExercise.name);
    }
  };

  const moveToNextExercise = () => {
    setExercisesCompleted((prev) => prev + 1);

    if (currentExerciseIndex >= allExercises.length - 1) {
      finishWorkout('completed');
      return;
    }

    setCurrentExerciseIndex((prev) => prev + 1);
    setPhase('countdown');
    setTimeRemaining(3);
    
    const nextExercise = allExercises[currentExerciseIndex + 1];
    if (nextExercise) {
      speak(t('player:tts.nextExercise', { name: nextExercise.name }));
    }
  };

  const skipExercise = () => {
    setExercisesCompleted((prev) => prev + 1);
    
    if (currentExerciseIndex >= allExercises.length - 1) {
      finishWorkout('completed');
      return;
    }

    setCurrentExerciseIndex((prev) => prev + 1);
    setPhase('countdown');
    setTimeRemaining(3);
  };

  const addTime = (seconds) => {
    setTimeRemaining((prev) => prev + seconds);
    toast.success(t('player:toast.addedSeconds', { seconds }));
  };

  const finishWorkout = (status = 'completed') => {
    setPhase('finished');
    setShowFeedback(true);
    releaseWakeLock();
    setPartnerLive(null);
    setDuoLive(false);
    workoutsApi.clearProgress(workoutId).catch(() => {});
    if (status === 'completed') {
      speak(t('player:tts.workoutComplete'));
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (totalTimeRef.current) clearInterval(totalTimeRef.current);
  };

  // STOP MODAL HANDLERS
  const handleStopClick = () => {
    setIsPaused(true);
    setShowStopModal(true);
  };

  const persistProgress = useCallback(async () => {
    if (!workout || phase === 'preparation' || phase === 'finished') return;
    try {
      await workoutsApi.saveProgress(workoutId, {
        workout_id: workoutId,
        current_exercise_index: currentExerciseIndex,
        current_block_index: currentBlockIndex,
        time_elapsed: totalTime,
        pause_time: pauseTime,
        exercises_completed: exercisesCompleted,
        exercises_total: totalExercises,
        workout_title: workout.title,
        phase: isPaused ? 'paused' : phase,
      });
    } catch {
      /* sauvegarde silencieuse */
    }
  }, [
    workout,
    phase,
    workoutId,
    currentExerciseIndex,
    currentBlockIndex,
    totalTime,
    pauseTime,
    exercisesCompleted,
    totalExercises,
    isPaused,
  ]);

  const sessionIsActive = phase !== 'preparation' && phase !== 'finished' && !isPaused;
  const [keepScreenAwake, setKeepScreenAwake] = useState(() => getKeepScreenAwakePref());

  useEffect(() => {
    if (sessionIsActive && keepScreenAwake) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [sessionIsActive, keepScreenAwake, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (phase === 'finished' || phase === 'preparation' || !user?.partner_id) {
      if (phase === 'finished') {
        setPartnerLive(null);
        setDuoLive(false);
        setPartnerReconnecting(false);
      }
      return undefined;
    }

    const pollPartner = async () => {
      try {
        const { data } = await partnerApi.getLiveSession();
        if (data?.active) {
          setPartnerLive(data);
          setDuoLive(!!data.duo_live);
          setPartnerReconnecting(data.connection_status === 'degraded');
          if (typeof data.progress_percent === 'number') {
            lastKnownPartnerProgressRef.current = data.progress_percent;
            setPartnerProgress(data.progress_percent);
          } else if (lastKnownPartnerProgressRef.current != null) {
            setPartnerProgress(lastKnownPartnerProgressRef.current);
          }
        } else {
          setPartnerLive(null);
          setDuoLive(false);
          setPartnerReconnecting(false);
        }
      } catch {
        setPartnerReconnecting(true);
      }
    };

    pollPartner();
    const id = setInterval(pollPartner, 12000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') pollPartner();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', pollPartner);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', pollPartner);
    };
  }, [phase, user?.partner_id]);

  useEffect(() => {
    const interval = setInterval(persistProgress, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [persistProgress]);

  // Heartbeat connexion (60s) — met à jour last_seen_at sans recréer de séance
  useEffect(() => {
    if (!sessionIsActive) return undefined;
    const heartbeat = setInterval(persistProgress, 60000);
    return () => clearInterval(heartbeat);
  }, [sessionIsActive, persistProgress]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') persistProgress();
    };
    const onUnload = () => persistProgress();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [persistProgress]);

  useEffect(() => {
    if (phase !== 'preparation' && phase !== 'finished') {
      persistProgress();
    }
  }, [currentExerciseIndex, currentBlockIndex, isPaused, phase]);

  const handleResumeLater = async () => {
    try {
      await persistProgress();
      releaseWakeLock();
      toast.success(t('player:toast.progressSaved'));
      navigate('/workouts');
    } catch (error) {
      toast.error(t('player:toast.saveError'));
    }
  };

  const handleAbandon = () => {
    setShowStopModal(false);
    finishWorkout('abandoned');
  };

  const handleCancelStop = () => {
    setShowStopModal(false);
    setIsPaused(false);
  };

  const saveFeedback = async (status) => {
    setSaving(true);
    try {
      // Clear any saved progress
      await workoutsApi.clearProgress(workoutId).catch(() => {});
      
      const exerciseLog = allExercises.map((ex, idx) => {
        const outcome = exerciseOutcomes[idx];
        const derived =
          outcome || (idx < exercisesCompleted ? 'completed' : 'not_done');
        const activitySummary = activitySummaries[idx];
        return {
          name: ex.name,
          exercise_type: ex.exercise_type,
          reps: ex.reps,
          duration: ex.duration,
          block_type: ex.blockType,
          status: derived, // 'completed' | 'skipped' | 'not_done'
          completed: derived === 'completed',
          skipped: derived === 'skipped',
          source: ex.source || null,
          preset_id: ex.preset_id || null,
          activity_tracking_mode: getActivityTrackingMode(ex),
          activity_summary: activitySummary || null,
        };
      });

      const { data: session } = await sessionsApi.create({
        workout_id: workoutId,
        total_time: totalTime,
        pause_time: pauseTime,
        exercises_completed: completedCount,
        exercises_total: totalExercises,
        status,
        fatigue_before: fatigueBefore,
        fatigue_after: fatigueAfter,
        difficulty_felt: difficultyFelt,
        notes: notes.trim() || null,
        exercise_log: exerciseLog,
        hero_result: workout?.source_type === 'hero_challenge'
          ? {
              rounds: 0,
              duration_seconds: totalTime,
              blocks_complete: skippedCount === 0 && status === 'completed',
              has_skips: skippedCount > 0,
              coda_complete: skippedCount === 0 && status === 'completed',
            }
          : undefined,
      });
      toast.success(t('player:toast.sessionSaved'));
      invalidateHomeWeekCache(user?.id);
      invalidateBadgesForUser(user?.id);
      setCreatedSession({
        ...session,
        workout_title: session.workout_title || workout?.title,
      });
      if (session.hero_result) {
        setHeroOutcome({ result: session.hero_result, snapshot: heroSnapshot(workout) });
        return;
      }
      setShareDialogOpen(true);
    } catch (error) {
      toast.error(t('player:toast.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const openTimeAdjust = () => {
    setAdjustTotalMin(String(Math.floor(totalTime / 60)));
    setAdjustTotalSec(String(totalTime % 60));
    setAdjustPauseMin(String(Math.floor(pauseTime / 60)));
    setAdjustPauseSec(String(pauseTime % 60));
    setShowTimeAdjust(true);
  };

  const startLongPress = () => {
    if (!canAdjustTime) return;
    longPressTimerRef.current = setTimeout(openTimeAdjust, 700);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const applyTimeAdjust = () => {
    const totalSec =
      (parseInt(adjustTotalMin, 10) || 0) * 60 + (parseInt(adjustTotalSec, 10) || 0);
    const pauseSec =
      (parseInt(adjustPauseMin, 10) || 0) * 60 + (parseInt(adjustPauseSec, 10) || 0);
    if (totalSec < 0 || pauseSec < 0) {
      toast.error(t('player:toast.invalidValue'));
      return;
    }
    setTotalTime(totalSec);
    setPauseTime(pauseSec);
    setShowTimeAdjust(false);
    toast.success(t('player:toast.timeAdjusted'));
  };

  const secretTimeProps = canAdjustTime
    ? {
        onPointerDown: startLongPress,
        onPointerUp: cancelLongPress,
        onPointerLeave: cancelLongPress,
        onContextMenu: (e) => e.preventDefault(),
        className: 'select-none touch-manipulation',
        title: '',
      }
    : {};

  const timeAdjustDialog = (
    <Dialog open={showTimeAdjust} onOpenChange={setShowTimeAdjust}>
      <DialogContent className="bg-surface-elevated border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">{t('player:timeAdjust.title')}</DialogTitle>
          <DialogDescription className="text-subtle text-sm">
            {t('player:timeAdjust.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-muted text-xs mb-2">{t('player:timeAdjust.totalTime')}</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={adjustTotalMin}
                onChange={(e) => setAdjustTotalMin(e.target.value)}
                className="bg-background border-border text-foreground"
                placeholder={t('player:timeAdjust.min')}
              />
              <Input
                type="number"
                min={0}
                max={59}
                value={adjustTotalSec}
                onChange={(e) => setAdjustTotalSec(e.target.value)}
                className="bg-background border-border text-foreground"
                placeholder={t('player:timeAdjust.sec')}
              />
            </div>
          </div>
          <div>
            <p className="text-muted text-xs mb-2">{t('player:timeAdjust.pauseTime')}</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={adjustPauseMin}
                onChange={(e) => setAdjustPauseMin(e.target.value)}
                className="bg-background border-border text-foreground"
                placeholder={t('player:timeAdjust.min')}
              />
              <Input
                type="number"
                min={0}
                max={59}
                value={adjustPauseSec}
                onChange={(e) => setAdjustPauseSec(e.target.value)}
                className="bg-background border-border text-foreground"
                placeholder={t('player:timeAdjust.sec')}
              />
            </div>
          </div>
          <Button onClick={applyTimeAdjust} className="w-full btn-primary text-foreground">
            {t('player:timeAdjust.apply')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const getNextExercise = () => {
    if (currentExerciseIndex >= allExercises.length - 1) return null;
    return allExercises[currentExerciseIndex + 1];
  };

  const nextExercise = getNextExercise();

  const getPhaseLabel = () => {
    if (phase === 'countdown') return t('player:phase.getReady');
    if (phase === 'rest') return t('player:rest');
    if (phase === 'exercise' && currentExercise) {
      if (currentExercise.blockType === 'warmup') return t('player:phase.warmup');
      if (currentExercise.blockType === 'cooldown') return t('player:phase.cooldown');
      if (currentExercise.exercise_type === 'duration') return t('player:phase.timer');
      return t('player:phase.set');
    }
    return null;
  };

  const phaseLabel = getPhaseLabel();
  const showAddTime =
    phase === 'rest' ||
    (phase === 'exercise' && currentExercise?.exercise_type === 'duration');

  const saveHeroSpecial = async (payload) => {
    setSaving(true);
    try {
      await workoutsApi.clearProgress(workoutId).catch(() => {});
      const { data: session } = await sessionsApi.create({
        workout_id: workoutId,
        total_time: payload.duration_seconds || 0,
        pause_time: 0,
        exercises_completed: payload.rounds || 0,
        exercises_total: payload.rounds || 0,
        status: payload.status || 'completed',
        hero_result: payload,
      });
      invalidateHomeWeekCache(user?.id);
      invalidateBadgesForUser(user?.id);
      setCreatedSession(session);
      setHeroOutcome({ result: session.hero_result || payload, snapshot: heroSnapshot(workout) });
    } catch (error) {
      toast.error(t('player:toast.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  if (heroOutcome) {
    return (
      <HeroResultScreen
        result={heroOutcome.result}
        snapshot={heroOutcome.snapshot}
        publishing={heroPublishing}
        onClose={() => navigate('/workouts')}
        onPublish={async () => {
          if (!createdSession?.id) return;
          setHeroPublishing(true);
          try {
            await postsApi.create({
              type: 'hero_challenge',
              workout_session_id: createdSession.id,
              visibility: 'public',
            });
            toast.success(t('player:toast.sessionSaved'));
            navigate('/');
          } catch (error) {
            toast.error(t('player:toast.saveError'));
          } finally {
            setHeroPublishing(false);
          }
        }}
      />
    );
  }

  const snap = heroSnapshot(workout);
  const kind = heroPlayerKind(workout);
  if (kind === 'amrap' && snap) {
    return (
      <HeroAmrapPlayer
        workout={workout}
        snapshot={snap}
        onComplete={saveHeroSpecial}
        onAbandon={() => saveHeroSpecial({ status: 'abandoned', rounds: 0, duration_seconds: 0 })}
      />
    );
  }
  if (kind === 'rounds' && snap) {
    return (
      <HeroRoundsPlayer
        snapshot={snap}
        onComplete={saveHeroSpecial}
        onAbandon={() => saveHeroSpecial({ status: 'abandoned', rounds: 0, duration_seconds: 0, coda_complete: false })}
      />
    );
  }

  // Feedback screen
  if (showFeedback) {
    return (
      <div className="min-h-screen bg-background p-5 animate-fade-in">
        <div className="max-w-md mx-auto space-y-6">
          {/* Summary */}
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-[var(--theme-surface-active)] flex items-center justify-center mb-4">
              <Trophy className="text-[var(--theme-primary)]" size={36} />
            </div>
            <h1 className="text-2xl font-bold text-foreground font-['Outfit']">
              {exercisesCompleted >= totalExercises ? t('player:feedback.congrats') : t('player:feedback.completed')}
            </h1>
            <p className="text-subtle mt-2">{workout?.title}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4 text-center" {...secretTimeProps}>
              <p className="text-2xl font-bold text-foreground font-mono">{formatTime(totalTime)}</p>
              <p className="text-subtle text-xs mt-1">{t('player:totalTimeLabel')}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{completedCount}</p>
              <p className="text-subtle text-xs mt-1">
                {skippedCount > 0
                  ? t('player:feedback.exercisesDoneWithSkipped', { skipped: skippedCount })
                  : t('player:feedback.exercisesDone')}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-foreground font-mono">{formatTime(pauseTime)}</p>
              <p className="text-subtle text-xs mt-1">{t('player:pauses')}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">
                {formatCalories(estimateCalories(totalTime, difficultyFelt))}
              </p>
              <p className="text-subtle text-xs mt-1">{t('player:feedback.caloriesApprox')}</p>
            </div>
          </div>

          {/* Détail exercices (séance mixte : activités + classiques) */}
          {allExercises.length > 0 && (
            <div className="card p-4 space-y-2" data-testid="workout-mixed-summary">
              <p className="text-subtle text-xs uppercase tracking-wider mb-2">
                {t('player:feedback.exerciseBreakdown', { defaultValue: 'Détail' })}
              </p>
              {allExercises.map((ex, idx) => {
                const outcome = exerciseOutcomes[idx];
                const summary = activitySummaries[idx];
                const name = ex.name;
                let detail = '';
                if (summary) {
                  const parts = [];
                  if (summary.distance_meters > 0) {
                    parts.push(formatDistanceMeters(summary.distance_meters));
                  }
                  if (summary.moving_seconds || summary.elapsed_seconds) {
                    parts.push(formatElapsed(summary.moving_seconds || summary.elapsed_seconds, true));
                  }
                  if (summary.average_pace_seconds_per_km) {
                    parts.push(formatPace(summary.average_pace_seconds_per_km / 60));
                  } else if (summary.laps) {
                    parts.push(`${summary.laps} ${t('player:tracked.laps', { defaultValue: 'longueurs' })}`);
                  }
                  detail = parts.join(' · ');
                } else if (isTrackedActivityExercise(ex)) {
                  detail = outcome === 'completed' ? t('player:feedback.done', { defaultValue: 'Terminé' }) : '';
                } else if (ex.exercise_type === 'duration') {
                  detail = ex.duration ? formatElapsed(ex.duration) : '';
                } else if (ex.reps) {
                  detail = t('player:repsCount', { count: ex.reps });
                }
                return (
                  <div
                    key={`${ex.exercise_id}-${idx}`}
                    className="flex items-start justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-foreground font-medium min-w-0 truncate">
                      {ex.icon ? <span className="mr-1" aria-hidden>{ex.icon}</span> : null}
                      {name}
                    </span>
                    <span className="text-muted text-right shrink-0 tabular-nums">{detail}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Feedback form */}
          <div className="card p-5 space-y-6">
            <div>
              <label className="text-muted text-sm block mb-3">
                {t('player:feedback.fatigueBefore', { value: fatigueBefore })}
              </label>
              <Slider
                value={[fatigueBefore]}
                onValueChange={([v]) => setFatigueBefore(v)}
                max={10}
                step={1}
                className="py-2"
              />
            </div>

            <div>
              <label className="text-muted text-sm block mb-3">
                {t('player:feedback.fatigueAfter', { value: fatigueAfter })}
              </label>
              <Slider
                value={[fatigueAfter]}
                onValueChange={([v]) => setFatigueAfter(v)}
                max={10}
                step={1}
                className="py-2"
              />
            </div>

            <div>
              <label className="text-muted text-sm block mb-3">
                {t('player:feedback.difficultyFelt', { value: difficultyFelt })}
              </label>
              <Slider
                value={[difficultyFelt]}
                onValueChange={([v]) => setDifficultyFelt(v)}
                max={10}
                step={1}
                className="py-2"
              />
            </div>

            <div>
              <label className="text-muted text-sm block mb-2">{t('player:feedback.notesOptional')}</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('player:feedback.notesPlaceholder')}
                className="rounded-xl bg-background border-border text-foreground"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => saveFeedback(exercisesCompleted >= totalExercises ? 'completed' : 'abandoned')}
              disabled={saving}
              data-testid="save-session-btn"
              className="w-full h-14 rounded-xl font-bold text-foreground btn-primary"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t('player:save')}
            </Button>
            <Button
              onClick={async () => {
                await workoutsApi.clearProgress(workoutId).catch(() => {});
                releaseWakeLock();
                navigate('/workouts');
              }}
              variant="outline"
              className="w-full h-12 rounded-xl bg-hover border-border text-foreground"
            >
              {t('player:feedback.exitWithoutSaving')}
            </Button>
          </div>
        </div>
        {timeAdjustDialog}
        <ShareWorkoutDialog
          open={shareDialogOpen}
          onOpenChange={(open) => {
            setShareDialogOpen(open);
            if (!open && createdSession) navigate('/duo');
          }}
          session={createdSession}
          onShared={() => navigate('/duo')}
          onSkip={() => navigate('/duo')}
        />
      </div>
    );
  }

  // Preparation screen with resume option
  if (phase === 'preparation') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground font-['Outfit'] mb-2">{workout?.title}</h1>
          <p className="text-subtle">{t('player:exerciseCount', { count: totalExercises })}</p>
        </div>

        {/* Resume from saved progress */}
        {savedProgress && (
          <div className="card p-5 w-full max-w-sm mb-6 border-[var(--theme-primary)]/30">
            <div className="flex items-center gap-3 mb-3">
              <RotateCcw className="text-[var(--theme-primary)]" size={20} />
              <span className="text-foreground font-medium">{t('player:prep.savedProgress')}</span>
            </div>
            <p className="text-muted text-sm mb-4">
              {savedProgress.exercises_completed}/{totalExercises} exercices • {formatTime(savedProgress.time_elapsed)}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={resumeFromProgress}
                className="flex-1 bg-[var(--theme-primary)] text-foreground"
              >
                {t('player:resume')}
              </Button>
              <Button
                onClick={startFresh}
                variant="outline"
                className="flex-1 border-border text-foreground"
              >
                {t('player:restart')}
              </Button>
            </div>
          </div>
        )}

        {/* First exercise preview */}
        {currentExercise && !savedProgress && (
          <div className="card p-6 w-full max-w-sm mb-8">
            {(currentExercise.image_url || currentExercise.media_snapshot) && (
              <div className="w-full h-32 rounded-xl overflow-hidden mb-4 bg-hover">
                <img 
                  src={resolveExerciseMediaUrl(currentExercise.image_url || currentExercise.media_snapshot)} 
                  alt={localizedCurrentName}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    if (e.currentTarget.dataset.fallbackApplied === '1') return;
                    e.currentTarget.dataset.fallbackApplied = '1';
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <p className="text-subtle text-sm uppercase tracking-wider mb-2">{t('player:firstExercise')}</p>
            <h2 className="text-xl font-bold text-foreground">{localizedCurrentName}</h2>
            {currentExercise.description && (
              <p className="text-muted text-sm mt-1">{currentExercise.description}</p>
            )}
            {currentExercise.exercise_type === 'duration' ? (
              <p className="text-muted mt-2">{currentExercise.duration}s</p>
            ) : isTrackedActivityExercise(currentExercise) ? (
              <p className="text-muted mt-2 text-xs uppercase tracking-wide">
                {t(`workouts:create.activityMode.${getActivityTrackingMode(currentExercise)}`, {
                  defaultValue: getActivityTrackingMode(currentExercise),
                })}
              </p>
            ) : (
              <p className="text-muted mt-2">{t('player:repsCount', { count: currentExercise.reps })}</p>
            )}
          </div>
        )}

        {!savedProgress && (
          <Button
            onClick={startWorkout}
            data-testid="start-session-btn"
            className="w-full max-w-sm h-16 rounded-xl font-bold text-xl text-foreground btn-primary"
          >
            <Play size={24} className="mr-2" fill="currentColor" />
            {t('player:start')}
          </Button>
        )}

        <button
          onClick={() => navigate(-1)}
          className="mt-6 text-subtle hover:text-foreground transition-colors"
        >
          {t('player:cancel')}
        </button>
      </div>
    );
  }

  const partnerName = partnerLive?.display_name || partnerLive?.username;
  const clampProgress = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    return Math.max(0, Math.min(100, value));
  };
  const myProgressPercent = clampProgress(
    totalExercises > 0 ? Math.round((exercisesCompleted / totalExercises) * 100) : null
  );
  const partnerProgressPercent = clampProgress(
    typeof partnerProgress === 'number'
      ? partnerProgress
      : typeof partnerLive?.progress_percent === 'number'
        ? partnerLive.progress_percent
        : lastKnownPartnerProgressRef.current
  );
  const topBarWidth = duoLive
    ? (partnerProgressPercent != null ? partnerProgressPercent : 0)
    : progress;
  const topBarColor = duoLive ? 'bg-amber-400' : 'bg-[var(--theme-primary)]';
  const myBarWidth = myProgressPercent != null ? myProgressPercent : progress;

  const playerSidebar = (
    <div className="space-y-4">
      {nextExercise && (
        <div className="card p-4">
          <p className="text-subtle text-xs uppercase tracking-wider mb-2">{t('player:next')}</p>
          <p className="text-foreground font-semibold">{nextExercise.name}</p>
        </div>
      )}
    </div>
  );

  // Main player UI
  return (
    <div
      className={`min-h-[100dvh] bg-background flex flex-col transition-shadow ${
        duoLive ? 'ring-2 ring-amber-400/60 ring-inset duo-live-glow' : ''
      }`}
    >
      <Dialog open={showStopModal} onOpenChange={setShowStopModal}>
        <DialogContent className="bg-surface-elevated border-border max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-foreground text-center">{t('player:stopConfirm.title')}</DialogTitle>
            <DialogDescription className="text-muted text-center pt-2">
              {skippedCount > 0
                ? t('player:stopConfirm.descriptionWithSkipped', {
                    completed: completedCount,
                    total: totalExercises,
                    skipped: skippedCount,
                    time: formatTime(totalTime),
                  })
                : t('player:stopConfirm.description', {
                    completed: completedCount,
                    total: totalExercises,
                    time: formatTime(totalTime),
                  })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleResumeLater}
              className="w-full h-14 rounded-xl bg-[var(--theme-primary)] text-foreground font-medium"
            >
              <Save size={18} className="mr-2" />
              {t('player:resumeLater')}
            </Button>
            <Button
              onClick={handleAbandon}
              variant="outline"
              className="w-full h-12 rounded-xl bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              {t('player:stopConfirm.abandon')}
            </Button>
            <Button
              onClick={handleCancelStop}
              variant="outline"
              className="w-full h-12 rounded-xl bg-hover border-border text-foreground"
            >
              {t('player:cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-1 bg-surface-elevated shrink-0" data-testid="partner-progress-bar">
        <div
          className={`h-full transition-[width] duration-300 ${topBarColor}`}
          style={{ width: `${topBarWidth}%` }}
        />
      </div>

      {duoLive && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-center shrink-0">
          <p className="text-amber-300 text-xs font-medium flex items-center justify-center gap-1.5">
            <Radio size={12} className={partnerReconnecting ? '' : 'animate-pulse'} />
            {partnerReconnecting
              ? t('player:reconnecting')
              : t('player:liveSessionWith', { name: partnerName })}
          </p>
        </div>
      )}

      {duoLive && (
        <div className="h-1 bg-surface-elevated shrink-0" data-testid="my-progress-bar">
          <div
            className="h-full bg-[var(--theme-primary)] transition-[width] duration-300"
            style={{ width: `${myBarWidth}%` }}
          />
        </div>
      )}

      <header className="relative flex h-16 shrink-0 items-center justify-center border-b border-border px-4">
        <button
          type="button"
          onClick={handleStopClick}
          data-testid="stop-workout-btn"
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-active"
          aria-label={t('player:aria.stopSession')}
        >
          <X size={22} />
        </button>

        <div className="min-w-0 max-w-[55%] text-center">
          <p className="truncate text-sm text-muted">{workout?.title}</p>
          <p className="text-xs text-subtle tabular-nums">
            {Math.min(currentExerciseIndex + 1, totalExercises)}/{totalExercises}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute right-4 flex h-10 items-center gap-1.5 rounded-full border border-border bg-hover px-3 text-xs font-medium text-muted transition-colors hover:bg-active hover:text-foreground"
            >
              <MoreHorizontal size={16} />
              <span className="hidden sm:inline">{t('player:options')}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-surface-elevated border-border w-52">
            <DropdownMenuItem
              onClick={() => setMusicMode(!musicMode)}
              className="text-foreground focus:bg-active cursor-pointer"
            >
              <Music size={16} className="mr-2" />
              {musicMode ? t('player:musicMode.disable') : t('player:musicMode.enable')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className="text-foreground focus:bg-active cursor-pointer"
            >
              {ttsEnabled && !musicMode ? (
                <Volume2 size={16} className="mr-2" />
              ) : (
                <VolumeX size={16} className="mr-2" />
              )}
              {ttsEnabled ? t('player:announcements.disable') : t('player:announcements.enable')}
            </DropdownMenuItem>
            {wakeLockSupported && (
              <>
                <DropdownMenuSeparator className="bg-active" />
                <DropdownMenuItem
                  onClick={() => {
                    const next = !keepScreenAwake;
                    setKeepScreenAwake(next);
                    setKeepScreenAwakePref(next);
                  }}
                  className="text-foreground focus:bg-active cursor-pointer"
                  data-testid="player-keep-screen-awake"
                >
                  {t('player:wakeLock.toggle', {
                    defaultValue: 'Garder l’écran actif',
                  })}
                  {keepScreenAwake && wakeLockActive ? ' ✓' : keepScreenAwake ? '' : ' (off)'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="relative flex flex-1 flex-col w-full max-w-full min-w-0 overflow-hidden min-h-0">
        <div className="flex flex-1 w-full max-w-full min-w-0 items-center justify-center px-3 py-3 sm:px-4 sm:py-4 md:px-8 md:py-8">
          <div
            className="flex w-full max-w-full min-w-0 mx-auto md:max-w-2xl flex-col items-center gap-4 sm:gap-6 text-center overflow-hidden"
            data-testid="player-exercise-stage"
          >
              {(currentExercise?.image_url || currentExercise?.media_snapshot) &&
                phase === 'exercise' &&
                !isCurrentTracked && (
                <div
                  className="w-auto max-w-[200px] max-h-[200px] md:max-w-sm md:max-h-none mx-auto overflow-hidden rounded-2xl bg-hover md:w-full md:aspect-video"
                  data-testid="player-exercise-gif"
                >
                  <img
                    src={resolveExerciseMediaUrl(currentExercise.image_url || currentExercise.media_snapshot)}
                    alt={localizedCurrentName}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="mx-auto h-auto max-h-[200px] w-auto max-w-[200px] object-contain md:h-full md:max-h-none md:w-full md:max-w-none"
                    onError={(e) => {
                      if (e.currentTarget.dataset.fallbackApplied === '1') return;
                      e.currentTarget.dataset.fallbackApplied = '1';
                      if (e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.style.display = 'none';
                      }
                    }}
                  />
                </div>
              )}

              {phase === 'exercise' && isCurrentTracked && currentExercise ? (
                <TrackedActivityInPlayer
                  exercise={currentExercise}
                  exerciseIndex={currentExerciseIndex}
                  scheduledWorkoutId={workoutId}
                  exerciseName={localizedCurrentName || currentExercise.name}
                  onExerciseComplete={completeTrackedActivity}
                  onRedirectToExercise={(idx) => {
                    if (Number.isFinite(Number(idx))) {
                      setCurrentExerciseIndex(Number(idx));
                    }
                  }}
                  globalPaused={isPaused}
                />
              ) : (
              <>
              <div className="w-full max-w-full min-w-0 space-y-2 overflow-hidden">
                {phaseLabel && (
                  <p className="inline-flex rounded-full bg-[var(--theme-surface-active)] px-4 py-1 text-sm uppercase tracking-wider text-[var(--theme-primary)]">
                    {phaseLabel}
                  </p>
                )}
                {phase === 'exercise' && currentExercise && (
                  <>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-['Outfit'] md:text-5xl break-words [overflow-wrap:anywhere] line-clamp-3">
                      {localizedCurrentName}
                    </h1>
                    {currentExercise.description && (
                      <p className="text-muted text-sm sm:text-base line-clamp-2 break-words [overflow-wrap:anywhere] max-w-full">
                        {getLocalizedExerciseField(currentExercise, 'description', i18n.language) ||
                          currentExercise.description}
                      </p>
                    )}
                  </>
                )}
                {phase === 'countdown' && currentExercise && (
                  <h1 className="text-2xl font-bold text-foreground font-['Outfit'] md:text-3xl break-words [overflow-wrap:anywhere] line-clamp-2">
                    {localizedCurrentName}
                  </h1>
                )}
              </div>

              <div className="flex w-full max-w-full min-w-0 flex-col items-center">
                {phase === 'countdown' && (
                  <div className="animate-pulse text-7xl font-mono font-bold leading-none tracking-tighter text-yellow-500 sm:text-8xl md:text-9xl">
                    {timeRemaining}
                  </div>
                )}
                {phase === 'rest' && (
                  <div
                    className="text-7xl font-mono font-bold leading-none tracking-tighter text-foreground sm:text-8xl md:text-9xl"
                    style={{ textShadow: '0 0 30px var(--theme-primary-glow)' }}
                  >
                    {formatTime(timeRemaining)}
                  </div>
                )}
                {phase === 'exercise' && currentExercise?.exercise_type === 'duration' && (
                  <div
                    className="text-7xl font-mono font-bold leading-none tracking-tighter text-foreground sm:text-8xl md:text-9xl"
                    style={{ textShadow: '0 0 30px var(--theme-primary-glow)' }}
                  >
                    {formatTime(timeRemaining)}
                  </div>
                )}
                {phase === 'exercise' && currentExercise?.exercise_type !== 'duration' && (
                  <>
                    <div
                      className="text-7xl font-bold leading-none text-foreground font-['Outfit'] sm:text-8xl md:text-9xl"
                      style={{ textShadow: '0 0 28px var(--theme-primary-glow)' }}
                    >
                      {currentExercise?.reps ?? '—'}
                    </div>
                    <p className="mt-3 text-lg text-muted">{t('player:repsToDo')}</p>
                  </>
                )}
              </div>

              {phase === 'exercise' && currentExercise && (
                <Button
                  type="button"
                  onClick={completeCurrentExercise}
                  className="h-12 sm:h-16 w-full max-w-md rounded-2xl text-base sm:text-lg font-bold text-foreground btn-primary"
                >
                  {t('player:exerciseDone')}
                </Button>
              )}
              </>
              )}

              {!(phase === 'exercise' && isCurrentTracked) && (
              <div
                className="flex w-full max-w-md min-w-0 flex-col items-center gap-2 sm:gap-3 overflow-hidden"
                data-testid="player-controls"
              >
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full max-w-full min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsPaused(!isPaused)}
                    className="min-h-10 min-w-10 h-10 sm:h-12 rounded-full border border-border bg-hover px-3 sm:px-4 text-xs sm:text-sm font-medium text-muted transition-colors hover:bg-active hover:text-foreground shrink-0"
                  >
                    {isPaused ? t('player:resume') : t('player:pause')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPaused(!isPaused)}
                    data-testid="pause-btn"
                    className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full text-foreground animate-pulse-glow shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
                    }}
                    aria-label={isPaused ? t('player:resume') : t('player:pause')}
                  >
                    {isPaused ? <Play size={22} fill="currentColor" /> : <Pause size={22} />}
                  </button>

                  <button
                    type="button"
                    onClick={phase === 'rest' ? skipRest : skipCurrentExercise}
                    data-testid={phase === 'rest' ? 'skip-rest-btn' : 'skip-exercise-btn'}
                    className="min-h-10 min-w-10 h-10 sm:h-12 rounded-full border border-border-strong bg-surface-subtle px-3 sm:px-4 text-xs sm:text-sm font-semibold text-foreground transition-colors hover:bg-active hover:border-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none shrink-0"
                  >
                    {phase === 'rest' ? t('player:skipRest') : t('player:skipExercise')}
                  </button>
                </div>

                {showAddTime && (
                  <button
                    type="button"
                    onClick={() => addTime(15)}
                    className="flex min-h-10 items-center gap-1.5 px-2 text-sm text-subtle transition-colors hover:text-muted"
                  >
                    <Plus size={14} />
                    {t('player:add15')}
                  </button>
                )}
              </div>
              )}

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleStopClick}
                  data-testid="stop-btn"
                  className="flex items-center gap-2 rounded-full bg-red-500/10 px-4 py-2 text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <StopCircle size={16} />
                  <span className="text-sm font-medium">{t('player:stopSession')}</span>
                </button>

                <p className="text-sm text-subtle tabular-nums" {...secretTimeProps}>
                  {t('player:totalTimeWithPause', {
                    total: formatTime(totalTime),
                    pause:
                      pauseTime > 0
                        ? t('player:pauseSegment', { time: formatTime(pauseTime) })
                        : '',
                  })}
                </p>
              </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md shrink-0 px-4 pb-6 2xl:hidden">
          {playerSidebar}
        </div>

        <aside className="pointer-events-none absolute right-8 top-24 z-10 hidden w-80 2xl:block">
          <div className="pointer-events-auto space-y-4">
            {playerSidebar}
          </div>
        </aside>
      </main>

      {duoLive && phase !== 'finished' ? (
        <LiveWorkoutReactions
          sessionId={partnerLive?.live_session_id || workoutId}
          enabled
        />
      ) : null}

      {timeAdjustDialog}
    </div>
  );
}
