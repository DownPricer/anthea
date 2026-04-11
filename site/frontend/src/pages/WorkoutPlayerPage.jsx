import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, sessionsApi } from '../lib/api';
import { Button } from '../components/ui/button';
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [savedProgress, setSavedProgress] = useState(null);

  // Feedback state
  const [fatigueBefore, setFatigueBefore] = useState(5);
  const [fatigueAfter, setFatigueAfter] = useState(5);
  const [difficultyFelt, setDifficultyFelt] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const timerRef = useRef(null);
  const totalTimeRef = useRef(null);
  const pauseTimeRef = useRef(null);
  const pauseStartRef = useRef(null);

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

  // TTS function
  const speak = useCallback((text) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  // Load workout and check for saved progress
  useEffect(() => {
    loadWorkout();
  }, [workoutId]);

  const loadWorkout = async () => {
    try {
      const [workoutRes, progressRes] = await Promise.all([
        workoutsApi.getOne(workoutId),
        workoutsApi.getProgress(workoutId).catch(() => ({ data: null }))
      ]);
      
      setWorkout(workoutRes.data);
      setTtsEnabled(user?.tts_enabled !== false);
      
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

  // Main timer
  useEffect(() => {
    if (isPaused || phase === 'preparation' || phase === 'finished') {
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
  }, [isPaused, phase, currentExerciseIndex]);

  const handleTimerComplete = () => {
    if (phase === 'countdown') {
      startExercise();
    } else if (phase === 'exercise') {
      if (currentExercise?.rest_after > 0) {
        setPhase('rest');
        setTimeRemaining(currentExercise.rest_after);
        speak('Repos');
      } else {
        moveToNextExercise();
      }
    } else if (phase === 'rest') {
      moveToNextExercise();
    }
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
      // For reps, give them time to complete
      setTimeRemaining(60);
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
    if (status === 'completed') {
      speak('Séance terminée. Bravo !');
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (totalTimeRef.current) clearInterval(totalTimeRef.current);
  };

  // STOP MODAL HANDLERS
  const handleStopClick = () => {
    setIsPaused(true);
    setShowStopModal(true);
  };

  const handleResumeLater = async () => {
    try {
      await workoutsApi.saveProgress(workoutId, {
        workout_id: workoutId,
        current_exercise_index: currentExerciseIndex,
        current_block_index: currentBlockIndex,
        time_elapsed: totalTime,
        pause_time: pauseTime,
        exercises_completed: exercisesCompleted,
      });
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
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
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
              onClick={() => navigate('/workouts')}
              variant="outline"
              className="w-full h-12 rounded-xl bg-white/5 border-white/10 text-white"
            >
              Quitter sans enregistrer
            </Button>
          </div>
        </div>
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

  // Main player UI
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
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
          className="h-full bg-[var(--theme-primary)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={handleStopClick}
          data-testid="stop-workout-btn"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={24} className="text-white" />
        </button>
        <div className="text-center">
          <p className="text-zinc-500 text-sm">{workout?.title}</p>
          <p className="text-white text-xs">
            {exercisesCompleted + 1}/{totalExercises}
          </p>
        </div>
        <button
          onClick={() => setTtsEnabled(!ttsEnabled)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {ttsEnabled ? (
            <Volume2 size={24} className="text-white" />
          ) : (
            <VolumeX size={24} className="text-zinc-500" />
          )}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-5">
        {/* Exercise image/GIF */}
        {currentExercise?.image_url && phase === 'exercise' && (
          <div className="w-full max-w-xs h-40 rounded-2xl overflow-hidden mb-6 bg-white/5">
            <img 
              src={currentExercise.image_url} 
              alt={currentExercise.name}
              className="w-full h-full object-cover"
              onError={(e) => e.target.parentElement.style.display = 'none'}
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
              {currentExercise?.blockType === 'warmup' ? 'Échauffement' : 
               currentExercise?.blockType === 'cooldown' ? 'Récupération' : 'Exercice'}
            </span>
          )}
          {phase === 'rest' && (
            <span className="px-4 py-1 rounded-full bg-green-500/20 text-green-500 text-sm">
              Repos
            </span>
          )}
        </div>

        {/* Timer */}
        <div
          className={`text-8xl font-mono font-bold tracking-tighter mb-4 ${
            phase === 'countdown' ? 'animate-pulse text-yellow-500' : 'text-white'
          }`}
          style={{
            textShadow: phase !== 'countdown' ? '0 0 30px var(--theme-primary-glow)' : undefined,
          }}
        >
          {phase === 'countdown' ? timeRemaining : formatTime(timeRemaining)}
        </div>

        {/* Current exercise */}
        {currentExercise && phase !== 'countdown' && (
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white font-['Outfit']">
              {phase === 'rest' ? 'Repos' : currentExercise.name}
            </h2>
            {phase === 'exercise' && currentExercise.description && (
              <p className="text-zinc-500 text-sm mt-1">{currentExercise.description}</p>
            )}
            {phase === 'exercise' && currentExercise.exercise_type === 'reps' && (
              <p className="text-zinc-400 mt-2 text-lg">{currentExercise.reps} répétitions</p>
            )}
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
        {/* Main controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => addTime(15)}
            className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors relative"
          >
            <Plus size={20} className="text-white" />
            <span className="text-[10px] text-zinc-400 absolute -bottom-5">+15s</span>
          </button>

          <button
            onClick={() => setIsPaused(!isPaused)}
            data-testid="pause-btn"
            className="w-20 h-20 rounded-full flex items-center justify-center text-white animate-pulse-glow"
            style={{
              background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
            }}
          >
            {isPaused ? <Play size={32} fill="currentColor" /> : <Pause size={32} />}
          </button>

          <button
            onClick={skipExercise}
            className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors relative"
          >
            <SkipForward size={20} className="text-white" />
            <span className="text-[10px] text-zinc-400 absolute -bottom-5">Skip</span>
          </button>
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

        {/* Total time */}
        <div className="text-center text-zinc-500 text-sm">
          Temps total: {formatTime(totalTime)}
          {pauseTime > 0 && ` • Pause: ${formatTime(pauseTime)}`}
        </div>
      </div>
    </div>
  );
}
