import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, sessionsApi, streakApi, partnerApi } from '../lib/api';
import { useWakeLock } from '../hooks/useWakeLock';
import { estimateCalories, formatCalories } from '../lib/calories';
import { playShortBeep, vibrateShort, openSpotify } from '../lib/workoutFeedback';
import { LiveWorkoutChat } from '../components/LiveWorkoutChat';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Slider } from '../components/ui/slider';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Play,
  Pause,
  SkipForward,
  Plus,
  X,
  Volume2,
  VolumeX,
  StopCircle,
  RotateCcw,
  Trophy,
  Loader2,
  ChevronRight,
  Clock,
  Save,
  Music,
  Sun,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';

export function WorkoutPlayerPage() {
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
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [musicMode, setMusicMode] = useState(false);
  const [partnerLive, setPartnerLive] = useState(null);
  const [duoLive, setDuoLive] = useState(false);
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
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
  const totalExercises = allExercises.length;
  const progress = totalExercises > 0 ? ((exercisesCompleted / totalExercises) * 100) : 0;

  const isLongMessage = (text) => (text || '').length > 12 || (text || '').includes(' ');

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
    utterance.lang = 'fr-FR';
    utterance.rate = 1;
    utterance.volume = 0.85;
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled, musicMode]);

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
      
      if (progressRes.data) {
        setSavedProgress(progressRes.data);
      }
    } catch (error) {
      toast.error('Impossible de charger la séance');
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
    speak('Reprise de la séance');
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
    phase === 'exercise' && currentExercise?.exercise_type === 'duration';

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
      speak('Repos');
    } else {
      moveToNextExercise();
    }
  };

  const handleTimerComplete = () => {
    if (phase === 'countdown') {
      startExercise();
    } else if (phase === 'exercise' && currentExercise?.exercise_type === 'duration') {
      finishExercisePhase();
    } else if (phase === 'rest') {
      moveToNextExercise();
    }
  };

  const completeRepExercise = () => {
    if (phase !== 'exercise') return;
    if (currentExercise?.exercise_type === 'duration') return;
    finishExercisePhase();
  };

  const startWorkout = () => {
    setPhase('countdown');
    setTimeRemaining(3);
    speak('Prépare-toi');
  };

  const startExercise = () => {
    if (!currentExercise) {
      finishWorkout('completed');
      return;
    }

    setPhase('exercise');

    if (currentExercise.exercise_type === 'duration') {
      setTimeRemaining(currentExercise.duration || 30);
    } else {
      setTimeRemaining(0);
    }

    if (currentExercise.tts_enabled) {
      speak(currentExercise.name);
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
      speak(`Prochain exercice: ${nextExercise.name}`);
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
    toast.success(`+${seconds}s`);
  };

  const finishWorkout = (status = 'completed') => {
    setPhase('finished');
    setShowFeedback(true);
    releaseWakeLock();
    setPartnerLive(null);
    setDuoLive(false);
    workoutsApi.clearProgress(workoutId).catch(() => {});
    if (status === 'completed') {
      speak('Séance terminée. Bravo !');
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (totalTimeRef.current) clearInterval(totalTimeRef.current);
  };

  const handleOpenMusic = () => {
    openSpotify(user?.spotify_playlist_url);
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
    isPaused,
  ]);

  const sessionIsActive = phase !== 'preparation' && phase !== 'finished' && !isPaused;

  useEffect(() => {
    if (sessionIsActive) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [sessionIsActive, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (phase === 'finished' || phase === 'preparation' || !user?.partner_id) return undefined;

    const pollPartner = async () => {
      try {
        const { data } = await partnerApi.getLiveSession();
        if (data?.active) {
          setPartnerLive(data);
          setDuoLive(!!data.duo_live);
        } else {
          setPartnerLive(null);
          setDuoLive(false);
        }
      } catch {
        setPartnerLive(null);
        setDuoLive(false);
      }
    };

    pollPartner();
    const id = setInterval(pollPartner, 12000);
    return () => clearInterval(id);
  }, [phase, user?.partner_id]);

  useEffect(() => {
    const interval = setInterval(persistProgress, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [persistProgress]);

  // Heartbeat pour statut « en direct » partenaire (saved_at récent)
  useEffect(() => {
    if (!sessionIsActive) return undefined;
    const heartbeat = setInterval(persistProgress, 30000);
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
      toast.success('Progression sauvegardée');
      navigate('/workouts');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
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
      
      const exerciseLog = allExercises.slice(0, exercisesCompleted).map((ex) => ({
        name: ex.name,
        exercise_type: ex.exercise_type,
        reps: ex.reps,
        duration: ex.duration,
        block_type: ex.blockType,
        completed: true,
      }));

      await sessionsApi.create({
        workout_id: workoutId,
        total_time: totalTime,
        pause_time: pauseTime,
        exercises_completed: exercisesCompleted,
        exercises_total: totalExercises,
        status,
        fatigue_before: fatigueBefore,
        fatigue_after: fatigueAfter,
        difficulty_felt: difficultyFelt,
        notes: notes.trim() || null,
        exercise_log: exerciseLog,
      });
      toast.success('Séance enregistrée !');
      navigate('/duo');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
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
      toast.error('Valeur invalide');
      return;
    }
    setTotalTime(totalSec);
    setPauseTime(pauseSec);
    setShowTimeAdjust(false);
    toast.success('Temps ajusté');
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
      <DialogContent className="bg-[#141414] border-white/10 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Ajuster le temps</DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            Réservé coach / admin — maintenir le temps affiché pour ouvrir ce menu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-zinc-400 text-xs mb-2">Temps total</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={adjustTotalMin}
                onChange={(e) => setAdjustTotalMin(e.target.value)}
                className="bg-[#0A0A0A] border-white/10 text-white"
                placeholder="min"
              />
              <Input
                type="number"
                min={0}
                max={59}
                value={adjustTotalSec}
                onChange={(e) => setAdjustTotalSec(e.target.value)}
                className="bg-[#0A0A0A] border-white/10 text-white"
                placeholder="sec"
              />
            </div>
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-2">Temps de pause</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={adjustPauseMin}
                onChange={(e) => setAdjustPauseMin(e.target.value)}
                className="bg-[#0A0A0A] border-white/10 text-white"
                placeholder="min"
              />
              <Input
                type="number"
                min={0}
                max={59}
                value={adjustPauseSec}
                onChange={(e) => setAdjustPauseSec(e.target.value)}
                className="bg-[#0A0A0A] border-white/10 text-white"
                placeholder="sec"
              />
            </div>
          </div>
          <Button onClick={applyTimeAdjust} className="w-full btn-primary text-white">
            Appliquer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const getNextExercise = () => {
    if (currentExerciseIndex >= allExercises.length - 1) return null;
    return allExercises[currentExerciseIndex + 1];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  // Feedback screen
  if (showFeedback) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-5 animate-fade-in">
        <div className="max-w-md mx-auto space-y-6">
          {/* Summary */}
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-[var(--theme-surface-active)] flex items-center justify-center mb-4">
              <Trophy className="text-[var(--theme-primary)]" size={36} />
            </div>
            <h1 className="text-2xl font-bold text-white font-['Outfit']">
              {exercisesCompleted >= totalExercises ? 'Bravo !' : 'Séance terminée'}
            </h1>
            <p className="text-zinc-500 mt-2">{workout?.title}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4 text-center" {...secretTimeProps}>
              <p className="text-2xl font-bold text-white font-mono">{formatTime(totalTime)}</p>
              <p className="text-zinc-500 text-xs mt-1">Temps total</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-white">{exercisesCompleted}</p>
              <p className="text-zinc-500 text-xs mt-1">Exercices</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-white font-mono">{formatTime(pauseTime)}</p>
              <p className="text-zinc-500 text-xs mt-1">Pauses</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">
                {formatCalories(estimateCalories(totalTime, difficultyFelt))}
              </p>
              <p className="text-zinc-500 text-xs mt-1">Estimation approx.</p>
            </div>
          </div>

          {/* Feedback form */}
          <div className="card p-5 space-y-6">
            <div>
              <label className="text-zinc-400 text-sm block mb-3">
                Fatigue avant séance: {fatigueBefore}/10
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
              <label className="text-zinc-400 text-sm block mb-3">
                Fatigue après séance: {fatigueAfter}/10
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
              <label className="text-zinc-400 text-sm block mb-3">
                Difficulté ressentie: {difficultyFelt}/10
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
              <label className="text-zinc-400 text-sm block mb-2">Notes (optionnel)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comment s'est passée cette séance ?"
                className="rounded-xl bg-[#0A0A0A] border-white/10 text-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => saveFeedback(exercisesCompleted >= totalExercises ? 'completed' : 'abandoned')}
              disabled={saving}
              data-testid="save-session-btn"
              className="w-full h-14 rounded-xl font-bold text-white btn-primary"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
            </Button>
            <Button
              onClick={async () => {
                await workoutsApi.clearProgress(workoutId).catch(() => {});
                releaseWakeLock();
                navigate('/workouts');
              }}
              variant="outline"
              className="w-full h-12 rounded-xl bg-white/5 border-white/10 text-white"
            >
              Quitter sans enregistrer
            </Button>
          </div>
        </div>
        {timeAdjustDialog}
      </div>
    );
  }

  // Preparation screen with resume option
  if (phase === 'preparation') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-5 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">{workout?.title}</h1>
          <p className="text-zinc-500">{totalExercises} exercices</p>
        </div>

        {/* Resume from saved progress */}
        {savedProgress && (
          <div className="card p-5 w-full max-w-sm mb-6 border-[var(--theme-primary)]/30">
            <div className="flex items-center gap-3 mb-3">
              <RotateCcw className="text-[var(--theme-primary)]" size={20} />
              <span className="text-white font-medium">Progression sauvegardée</span>
            </div>
            <p className="text-zinc-400 text-sm mb-4">
              {savedProgress.exercises_completed}/{totalExercises} exercices • {formatTime(savedProgress.time_elapsed)}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={resumeFromProgress}
                className="flex-1 bg-[var(--theme-primary)] text-white"
              >
                Reprendre
              </Button>
              <Button
                onClick={startFresh}
                variant="outline"
                className="flex-1 border-white/10 text-white"
              >
                Recommencer
              </Button>
            </div>
          </div>
        )}

        {/* First exercise preview */}
        {currentExercise && !savedProgress && (
          <div className="card p-6 w-full max-w-sm mb-8">
            {currentExercise.image_url && (
              <div className="w-full h-32 rounded-xl overflow-hidden mb-4 bg-white/5">
                <img 
                  src={currentExercise.image_url} 
                  alt={currentExercise.name}
                  className="w-full h-full object-cover"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}
            <p className="text-zinc-500 text-sm uppercase tracking-wider mb-2">Premier exercice</p>
            <h2 className="text-xl font-bold text-white">{currentExercise.name}</h2>
            {currentExercise.description && (
              <p className="text-zinc-400 text-sm mt-1">{currentExercise.description}</p>
            )}
            {currentExercise.exercise_type === 'duration' ? (
              <p className="text-zinc-400 mt-2">{currentExercise.duration}s</p>
            ) : (
              <p className="text-zinc-400 mt-2">{currentExercise.reps} répétitions</p>
            )}
          </div>
        )}

        {!savedProgress && (
          <Button
            onClick={startWorkout}
            data-testid="start-session-btn"
            className="w-full max-w-sm h-16 rounded-xl font-bold text-xl text-white btn-primary"
          >
            <Play size={24} className="mr-2" fill="currentColor" />
            Commencer
          </Button>
        )}

        <button
          onClick={() => navigate(-1)}
          className="mt-6 text-zinc-500 hover:text-white transition-colors"
        >
          Annuler
        </button>
      </div>
    );
  }

  const partnerName = partnerLive?.display_name || partnerLive?.username;

  // Main player UI
  return (
    <div
      className={`min-h-screen bg-[#0A0A0A] flex flex-col transition-shadow ${
        duoLive ? 'ring-2 ring-amber-400/60 ring-inset duo-live-glow' : ''
      }`}
    >
      {/* Stop Modal */}
      <Dialog open={showStopModal} onOpenChange={setShowStopModal}>
        <DialogContent className="bg-[#141414] border-white/10 max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-white text-center">Arrêter la séance ?</DialogTitle>
            <DialogDescription className="text-zinc-400 text-center pt-2">
              Tu as complété {exercisesCompleted}/{totalExercises} exercices ({formatTime(totalTime)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleResumeLater}
              className="w-full h-14 rounded-xl bg-[var(--theme-primary)] text-white font-medium"
            >
              <Save size={18} className="mr-2" />
              Reprendre plus tard
            </Button>
            <Button
              onClick={handleAbandon}
              variant="outline"
              className="w-full h-12 rounded-xl bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              Arrêter et marquer comme abandonnée
            </Button>
            <Button
              onClick={handleCancelStop}
              variant="outline"
              className="w-full h-12 rounded-xl bg-white/5 border-white/10 text-white"
            >
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress bar */}
      <div className="h-1 bg-[#141414]">
        <div
          className={`h-full transition-all duration-300 ${duoLive ? 'bg-amber-400' : 'bg-[var(--theme-primary)]'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {duoLive && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-center">
          <p className="text-amber-300 text-xs font-medium flex items-center justify-center gap-1.5">
            <Radio size={12} className="animate-pulse" />
            Séance en direct avec {partnerName}
          </p>
          <p className="text-amber-400/70 text-[10px] mt-0.5">
            Votre partenaire a lancé une séance en même temps que toi
          </p>
        </div>
      )}

      {/* Header */}
      <div className="p-4 flex items-center justify-between gap-2">
        <button
          onClick={handleStopClick}
          data-testid="stop-workout-btn"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
        >
          <X size={24} className="text-white" />
        </button>
        <div className="text-center flex-1 min-w-0">
          <p className="text-zinc-500 text-sm truncate">{workout?.title}</p>
          <p className="text-white text-xs">
            {exercisesCompleted + 1}/{totalExercises}
          </p>
          {wakeLockSupported && wakeLockActive && (
            <p className="text-[10px] text-zinc-500 flex items-center justify-center gap-1 mt-0.5">
              <Sun size={10} className="text-yellow-500/80" /> Écran gardé allumé
            </p>
          )}
          {wakeLockSupported && wakeLockError && !wakeLockActive && sessionIsActive && (
            <p className="text-[10px] text-zinc-600 mt-0.5">Veille non bloquée</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleOpenMusic}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Ouvrir Spotify"
          >
            <Music size={22} className={musicMode ? 'text-green-400' : 'text-white'} />
          </button>
          <button
            type="button"
            onClick={() => setMusicMode(!musicMode)}
            className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
              musicMode ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-zinc-400'
            }`}
          >
            {musicMode ? 'Musique' : 'TTS'}
          </button>
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {ttsEnabled && !musicMode ? (
              <Volume2 size={22} className="text-white" />
            ) : (
              <VolumeX size={22} className="text-zinc-500" />
            )}
          </button>
        </div>
      </div>

      {duoLive && (
        <div className="px-4 pb-2">
          <LiveWorkoutChat
            partnerName={partnerName}
            open={liveChatOpen}
            onOpenChange={setLiveChatOpen}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-5">
        {/* Exercise image/GIF */}
        {currentExercise?.image_url && phase === 'exercise' && (
          <div className="w-full max-w-xs h-40 rounded-2xl overflow-hidden mb-6 bg-white/5">
            <img
              src={currentExercise.image_url}
              alt={currentExercise.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.parentElement.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Phase indicator */}
        <div className="mb-4">
          {phase === 'countdown' && (
            <span className="px-4 py-1 rounded-full bg-yellow-500/20 text-yellow-500 text-sm">
              Prépare-toi
            </span>
          )}
          {phase === 'exercise' && (
            <span className="px-4 py-1 rounded-full bg-[var(--theme-surface-active)] text-[var(--theme-primary)] text-sm uppercase tracking-wider">
              {currentExercise?.blockType === 'warmup'
                ? 'Échauffement'
                : currentExercise?.blockType === 'cooldown'
                  ? 'Récupération'
                  : currentExercise?.exercise_type === 'duration'
                    ? 'Chrono'
                    : 'Série'}
            </span>
          )}
          {phase === 'rest' && (
            <span className="px-4 py-1 rounded-full bg-green-500/20 text-green-500 text-sm">
              Repos
            </span>
          )}
        </div>

        {phase === 'exercise' && currentExercise && (
          <div className="mb-3 max-w-md px-2 text-center">
            <h2 className="text-2xl font-bold text-white font-['Outfit']">{currentExercise.name}</h2>
            {currentExercise.description && (
              <p className="mt-1 text-sm text-zinc-500">{currentExercise.description}</p>
            )}
          </div>
        )}

        {/* Chrono (durée / repos) ou objectif reps sans chrono */}
        {phase === 'countdown' && (
          <div
            className="mb-4 text-8xl font-mono font-bold tracking-tighter animate-pulse text-yellow-500"
            style={{ textShadow: undefined }}
          >
            {timeRemaining}
          </div>
        )}
        {phase === 'rest' && (
          <div
            className="mb-4 text-8xl font-mono font-bold tracking-tighter text-white"
            style={{ textShadow: '0 0 30px var(--theme-primary-glow)' }}
          >
            {formatTime(timeRemaining)}
          </div>
        )}
        {phase === 'exercise' && currentExercise?.exercise_type === 'duration' && (
          <div
            className="mb-4 text-8xl font-mono font-bold tracking-tighter text-white"
            style={{ textShadow: '0 0 30px var(--theme-primary-glow)' }}
          >
            {formatTime(timeRemaining)}
          </div>
        )}
        {phase === 'exercise' && currentExercise?.exercise_type !== 'duration' && (
          <div className="mb-2 text-center">
            <div
              className="text-8xl font-bold leading-none text-white font-['Outfit']"
              style={{ textShadow: '0 0 28px var(--theme-primary-glow)' }}
            >
              {currentExercise.reps ?? '—'}
            </div>
            <p className="mt-3 text-lg text-zinc-400">répétitions à faire</p>
          </div>
        )}

        {/* Next exercise preview */}
        {getNextExercise() && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <span>Suivant:</span>
            <span className="text-white">{getNextExercise().name}</span>
            <ChevronRight size={16} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-5 space-y-4">
        {phase === 'exercise' && currentExercise?.exercise_type !== 'duration' && (
          <Button
            type="button"
            onClick={completeRepExercise}
            className="mx-auto block h-14 w-full max-w-sm rounded-xl text-base font-bold text-white btn-primary"
          >
            J&apos;ai terminé la série
          </Button>
        )}

        {/* Main controls — grille 3 colonnes pour garder Pause centré */}
        <div className="mx-auto grid w-full max-w-sm grid-cols-3 place-items-center gap-1">
          <div className="flex h-[4.5rem] items-center justify-center">
            {phase === 'rest' ||
            (phase === 'exercise' && currentExercise?.exercise_type === 'duration') ? (
              <button
                type="button"
                onClick={() => addTime(15)}
                className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10"
              >
                <Plus size={20} className="text-white" />
                <span className="absolute -bottom-5 whitespace-nowrap text-[10px] text-zinc-400">
                  +15s
                </span>
              </button>
            ) : (
              <span className="inline-block h-14 w-14" aria-hidden />
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            data-testid="pause-btn"
            className="flex h-20 w-20 items-center justify-center rounded-full text-white animate-pulse-glow"
            style={{
              background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
            }}
          >
            {isPaused ? <Play size={32} fill="currentColor" /> : <Pause size={32} />}
          </button>

          <div className="flex h-[4.5rem] items-center justify-center">
            <button
              type="button"
              onClick={skipExercise}
              className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10"
            >
              <SkipForward size={20} className="text-white" />
              <span className="absolute -bottom-5 text-[10px] text-zinc-400">Passer</span>
            </button>
          </div>
        </div>

        {/* Stop button */}
        <div className="flex justify-center pt-2">
          <button
            onClick={handleStopClick}
            data-testid="stop-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <StopCircle size={18} />
            <span className="text-sm font-medium">Arrêter la séance</span>
          </button>
        </div>

        {/* Total time — appui long (coach/admin) pour ajuster */}
        <div className="text-center text-zinc-500 text-sm" {...secretTimeProps}>
          Temps total: {formatTime(totalTime)}
          {pauseTime > 0 && ` • Pause: ${formatTime(pauseTime)}`}
        </div>
        {timeAdjustDialog}
      </div>
    </div>
  );
}
