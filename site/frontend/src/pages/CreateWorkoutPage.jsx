import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, exercisesApi, templatesApi, formatApiError } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Calendar } from '../components/ui/calendar';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Clock,
  Hash,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Search,
  CalendarDays,
  Repeat,
  Image as ImageIcon,
  Upload,
  Pencil,
} from 'lucide-react';
import { format, addDays, addWeeks, startOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const BLOCK_TYPES = [
  { value: 'warmup', label: 'Échauffement' },
  { value: 'main', label: 'Corps de séance' },
  { value: 'cooldown', label: 'Retour au calme' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Facile' },
  { value: 'medium', label: 'Moyen' },
  { value: 'hard', label: 'Difficile' },
  { value: 'intense', label: 'Intense' },
];

const WEEK_DAYS = [
  { value: 0, label: 'Lun' },
  { value: 1, label: 'Mar' },
  { value: 2, label: 'Mer' },
  { value: 3, label: 'Jeu' },
  { value: 4, label: 'Ven' },
  { value: 5, label: 'Sam' },
  { value: 6, label: 'Dim' },
];

const DEFAULT_NEW_EXERCISE = {
  name: '',
  description: '',
  category: 'general',
  exercise_type: 'reps',
  default_duration: '',
  default_reps: '',
  default_rest: 30,
  image_url: '',
};

/** Taille max d’un GIF importé en local (avant encodage base64 dans l’API). */
const MAX_GIF_FILE_BYTES = 2 * 1024 * 1024;

export function CreateWorkoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [forUserId, setForUserId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  
  // Scheduling state
  const [scheduleMode, setScheduleMode] = useState('single'); // single, multiple, weekly
  const [singleDate, setSingleDate] = useState(new Date());
  const [multipleDates, setMultipleDates] = useState([]);
  const [weekDays, setWeekDays] = useState([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addWeeks(new Date(), 4), 'yyyy-MM-dd'));
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  
  const [blocks, setBlocks] = useState([
    { block_type: 'warmup', exercises: [], expanded: true },
    { block_type: 'main', exercises: [], expanded: true },
    { block_type: 'cooldown', exercises: [], expanded: true },
  ]);
  
  const [exercises, setExercises] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templatePendingDelete, setTemplatePendingDelete] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [exerciseTab, setExerciseTab] = useState('library');
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState(null);
  const [newExercise, setNewExercise] = useState(DEFAULT_NEW_EXERCISE);
  const newExerciseGifInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [exercisesRes, templatesRes] = await Promise.all([
        exercisesApi.getAll(),
        templatesApi.getAll(),
      ]);
      setExercises(exercisesRes.data || []);
      setTemplates(templatesRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addExerciseToBlock = (exercise) => {
    if (currentBlockIndex === null) return;

    const newExercise = {
      exercise_id: exercise.id,
      name: exercise.name,
      description: exercise.description,
      exercise_type: exercise.exercise_type,
      duration: exercise.default_duration,
      reps: exercise.default_reps,
      rest_after: exercise.default_rest || 30,
      order: blocks[currentBlockIndex].exercises.length,
      tts_enabled: true,
      image_url: exercise.image_url,
    };

    setBlocks((prev) => {
      const updated = [...prev];
      updated[currentBlockIndex].exercises.push(newExercise);
      return updated;
    });

    setExerciseDialogOpen(false);
    setCurrentBlockIndex(null);
    setSearchQuery('');
    setExerciseTab('library');
  };

  const updateNewExerciseField = (field, value) => {
    setNewExercise((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNewExerciseGifFile = (event) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.type !== 'image/gif') {
      toast.error('Choisis un fichier au format GIF');
      return;
    }
    if (file.size > MAX_GIF_FILE_BYTES) {
      const maxMb = Math.round(MAX_GIF_FILE_BYTES / 1024 / 1024);
      toast.error(`GIF trop volumineux (maximum ${maxMb} Mo)`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        updateNewExerciseField('image_url', result);
        toast.success('GIF importé');
      }
    };
    reader.onerror = () => toast.error('Impossible de lire ce fichier');
    reader.readAsDataURL(file);
  };

  const resetExerciseDialogState = () => {
    setCurrentBlockIndex(null);
    setSearchQuery('');
    setExerciseTab('library');
    setCreatingExercise(false);
    setEditingExerciseId(null);
    setNewExercise(DEFAULT_NEW_EXERCISE);
  };

  const libraryExerciseToForm = (exercise) => ({
    name: exercise.name || '',
    description: exercise.description || '',
    category: exercise.category || 'general',
    exercise_type: exercise.exercise_type || 'reps',
    default_duration:
      exercise.default_duration != null ? String(exercise.default_duration) : '',
    default_reps: exercise.default_reps != null ? String(exercise.default_reps) : '',
    default_rest: exercise.default_rest != null ? exercise.default_rest : 30,
    image_url: exercise.image_url || '',
  });

  const startEditExercise = (exercise, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (exercise.is_system) return;
    setEditingExerciseId(exercise.id);
    setNewExercise(libraryExerciseToForm(exercise));
    setExerciseTab('create');
  };

  const applyUpdatedExerciseToBlocks = (exerciseId, lib) => {
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        exercises: block.exercises.map((ex) => {
          if (ex.exercise_id !== exerciseId) return ex;
          return {
            ...ex,
            name: lib.name,
            description: lib.description,
            exercise_type: lib.exercise_type,
            duration:
              lib.exercise_type === 'duration' ? lib.default_duration ?? 0 : null,
            reps: lib.exercise_type === 'reps' ? lib.default_reps ?? 0 : null,
            rest_after: lib.default_rest ?? ex.rest_after,
            image_url: lib.image_url,
          };
        }),
      }))
    );
  };

  const handleCreateExercise = async (event) => {
    event.preventDefault();

    if (!newExercise.name.trim()) {
      toast.error("Donne un nom à l'exercice");
      return;
    }

    if (newExercise.exercise_type === 'duration' && !newExercise.default_duration) {
      toast.error('Indique une durée par défaut');
      return;
    }

    if (newExercise.exercise_type === 'reps' && !newExercise.default_reps) {
      toast.error('Indique un nombre de répétitions par défaut');
      return;
    }

    setCreatingExercise(true);
    try {
      const payload = {
        name: newExercise.name.trim(),
        description: newExercise.description.trim() || null,
        category: newExercise.category.trim() || 'general',
        exercise_type: newExercise.exercise_type,
        default_duration:
          newExercise.exercise_type === 'duration'
            ? Number(newExercise.default_duration) || 0
            : null,
        default_reps:
          newExercise.exercise_type === 'reps'
            ? Number(newExercise.default_reps) || 0
            : null,
        default_rest: Number(newExercise.default_rest) || 30,
        image_url: newExercise.image_url.trim() || null,
      };

      if (editingExerciseId) {
        const { data } = await exercisesApi.update(editingExerciseId, payload);
        setExercises((prev) => prev.map((e) => (e.id === editingExerciseId ? data : e)));
        applyUpdatedExerciseToBlocks(editingExerciseId, data);
        setEditingExerciseId(null);
        setNewExercise(DEFAULT_NEW_EXERCISE);
        setExerciseTab('library');
        toast.success('Exercice mis à jour');
      } else {
        const { data } = await exercisesApi.create(payload);
        setExercises((prev) => [data, ...prev]);
        addExerciseToBlock(data);
        setNewExercise(DEFAULT_NEW_EXERCISE);
        toast.success('Exercice créé et ajouté à la séance');
      }
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setCreatingExercise(false);
    }
  };

  const removeExercise = (blockIndex, exerciseIndex) => {
    setBlocks((prev) => {
      const updated = [...prev];
      updated[blockIndex].exercises.splice(exerciseIndex, 1);
      updated[blockIndex].exercises = updated[blockIndex].exercises.map((e, i) => ({
        ...e,
        order: i,
      }));
      return updated;
    });
  };

  const updateExercise = (blockIndex, exerciseIndex, field, value) => {
    setBlocks((prev) => {
      const updated = [...prev];
      updated[blockIndex].exercises[exerciseIndex][field] = value;
      return updated;
    });
  };

  const moveExercise = (blockIndex, exerciseIndex, direction) => {
    const newIndex = exerciseIndex + direction;
    if (newIndex < 0 || newIndex >= blocks[blockIndex].exercises.length) return;

    setBlocks((prev) => {
      const updated = [...prev];
      const exercises = [...updated[blockIndex].exercises];
      [exercises[exerciseIndex], exercises[newIndex]] = [exercises[newIndex], exercises[exerciseIndex]];
      updated[blockIndex].exercises = exercises.map((e, i) => ({ ...e, order: i }));
      return updated;
    });
  };

  const toggleBlockExpanded = (blockIndex) => {
    setBlocks((prev) => {
      const updated = [...prev];
      updated[blockIndex].expanded = !updated[blockIndex].expanded;
      return updated;
    });
  };

  const loadFromTemplate = (template) => {
    setTitle(template.title);
    setDescription(template.description || '');
    setDifficulty(template.difficulty || 'medium');

    if (template.blocks) {
      setBlocks(
        template.blocks.map((b) => ({
          ...b,
          expanded: true,
          exercises: b.exercises || [],
        }))
      );
    }

    toast.success('Modèle chargé');
  };

  const confirmDeleteTemplate = async () => {
    if (!templatePendingDelete) return;
    setDeletingTemplate(true);
    try {
      await templatesApi.delete(templatePendingDelete.id);
      setTemplates((prev) => prev.filter((t) => t.id !== templatePendingDelete.id));
      toast.success('Modèle supprimé');
      setTemplatePendingDelete(null);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setDeletingTemplate(false);
    }
  };

  const toggleWeekDay = (day) => {
    setWeekDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleMultipleDate = (date) => {
    setMultipleDates((prev) => {
      const exists = prev.some((d) => isSameDay(d, date));
      if (exists) {
        return prev.filter((d) => !isSameDay(d, date));
      }
      return [...prev, date];
    });
  };

  const getScheduledDatesPreview = () => {
    if (scheduleMode === 'single') {
      return [format(singleDate, 'yyyy-MM-dd')];
    }
    
    if (scheduleMode === 'multiple') {
      return multipleDates.map((d) => format(d, 'yyyy-MM-dd')).sort();
    }
    
    if (scheduleMode === 'weekly' && weekDays.length > 0 && startDate) {
      const dates = [];
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : addWeeks(start, repeatWeeks);
      
      let current = start;
      while (current <= end) {
        if (weekDays.includes(current.getDay() === 0 ? 6 : current.getDay() - 1)) {
          dates.push(format(current, 'yyyy-MM-dd'));
        }
        current = addDays(current, 1);
      }
      return dates;
    }
    
    return [];
  };

  const previewDates = getScheduledDatesPreview();

  const handleSave = async (asDraft = false) => {
    if (!title.trim()) {
      toast.error('Donne un titre à ta séance');
      return;
    }

    if (previewDates.length === 0) {
      toast.error('Sélectionne au moins une date');
      return;
    }

    setSaving(true);
    try {
      if (scheduleMode === 'single') {
        // Single workout creation (original behavior)
        const workoutData = {
          title: title.trim(),
          description: description.trim(),
          for_user_id: forUserId || user.id,
          scheduled_date: format(singleDate, 'yyyy-MM-dd'),
          scheduled_time: scheduledTime || null,
          difficulty,
          blocks: blocks.filter((b) => b.exercises.length > 0).map((b) => ({
            block_type: b.block_type,
            exercises: b.exercises,
          })),
          is_draft: asDraft,
        };

        const { data } = await workoutsApi.create(workoutData);
        toast.success(asDraft ? 'Brouillon sauvegardé' : 'Séance créée !');
        
        if (!asDraft) {
          navigate('/workouts');
        }
      } else {
        // Multi-schedule creation
        const multiData = {
          title: title.trim(),
          description: description.trim(),
          for_user_id: forUserId || user.id,
          scheduled_time: scheduledTime || null,
          difficulty,
          blocks: blocks.filter((b) => b.exercises.length > 0).map((b) => ({
            block_type: b.block_type,
            exercises: b.exercises,
          })),
          schedule_mode: scheduleMode,
          dates: scheduleMode === 'multiple' ? multipleDates.map((d) => format(d, 'yyyy-MM-dd')) : [],
          week_days: scheduleMode === 'weekly' ? weekDays : [],
          start_date: scheduleMode === 'weekly' ? startDate : null,
          end_date: scheduleMode === 'weekly' ? endDate : null,
          repeat_weeks: scheduleMode === 'weekly' ? repeatWeeks : null,
        };

        const { data } = await workoutsApi.createMulti(multiData);
        toast.success(`${data.created} séances créées !`);
        navigate('/workouts');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!title.trim()) {
      toast.error('Donne un titre à ta séance');
      return;
    }

    try {
      await templatesApi.create({
        title: title.trim(),
        description: description.trim(),
        difficulty,
        blocks: blocks.filter((b) => b.exercises.length > 0).map((b) => ({
          block_type: b.block_type,
          exercises: b.exercises,
        })),
      });
      toast.success('Modèle sauvegardé !');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde du modèle');
    }
  };

  const filteredExercises = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTotalDuration = () => {
    let total = 0;
    blocks.forEach((block) => {
      block.exercises.forEach((ex) => {
        total += (ex.duration || 0) + (ex.rest_after || 0);
      });
    });
    return Math.ceil(total / 60);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  return (
    <div data-testid="create-workout-page" className="pb-8 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft size={22} className="text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white">Créer une séance</h1>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="text-white border-white/10"
            >
              <Save size={16} />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-5 space-y-6">
        {/* Modèles — liste + actions claires */}
        <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
          <Label className="mb-3 block text-sm font-medium text-zinc-300">Modèles enregistrés</Label>
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aucun modèle pour l’instant. Remplis ta séance puis touche « Modèle » en bas pour en
              enregistrer un.
            </p>
          ) : (
            <ul className="space-y-2">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#0A0A0A] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-white">{template.title}</p>
                      {template.is_system && (
                        <span className="shrink-0 rounded-md bg-[var(--theme-primary)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-primary)]">
                          Anthea
                        </span>
                      )}
                    </div>
                    {template.difficulty && (
                      <p className="text-xs capitalize text-zinc-500">{template.difficulty}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => loadFromTemplate(template)}
                    className="shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10"
                  >
                    Charger
                  </Button>
                  {!template.is_system && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Supprimer ce modèle"
                      className="h-9 w-9 shrink-0 text-zinc-500 hover:bg-red-500/15 hover:text-red-400"
                      onClick={() => setTemplatePendingDelete(template)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-zinc-400 text-sm">
              Titre *
            </Label>
            <Input
              id="title"
              data-testid="workout-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Full Body Intense"
              className="mt-2 h-14 rounded-xl bg-[#141414] border-white/10 text-white"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-zinc-400 text-sm">
              Description (optionnel)
            </Label>
            <Textarea
              id="description"
              data-testid="workout-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes sur cette séance..."
              className="mt-2 rounded-xl bg-[#141414] border-white/10 text-white min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-400 text-sm">Pour qui</Label>
              <Select value={forUserId || user?.id} onValueChange={setForUserId}>
                <SelectTrigger className="mt-2 h-14 rounded-xl bg-[#141414] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  <SelectItem value={user?.id} className="text-white">Moi</SelectItem>
                  {user?.partner_id && (
                    <SelectItem value={user.partner_id} className="text-white">
                      {user.partner_username}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400 text-sm">Difficulté</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="mt-2 h-14 rounded-xl bg-[#141414] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value} className="text-white">
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-zinc-400 text-sm">Heure (optionnel)</Label>
            <Input
              type="time"
              data-testid="workout-time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="mt-2 h-14 rounded-xl bg-[#141414] border-white/10 text-white"
            />
          </div>
        </div>

        {/* SCHEDULING SECTION */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="text-[var(--theme-primary)]" size={20} />
            <h3 className="text-white font-semibold">Planification</h3>
          </div>

          {/* Schedule Mode Tabs */}
          <div className="flex gap-2">
            {[
              { value: 'single', label: 'Date unique' },
              { value: 'multiple', label: 'Plusieurs dates' },
              { value: 'weekly', label: 'Répétition' },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => setScheduleMode(mode.value)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  scheduleMode === mode.value
                    ? 'bg-[var(--theme-primary)] text-white'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Single Date */}
          {scheduleMode === 'single' && (
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={singleDate}
                onSelect={(date) => date && setSingleDate(date)}
                locale={fr}
                className="rounded-xl bg-white/5 p-3"
              />
            </div>
          )}

          {/* Multiple Dates */}
          {scheduleMode === 'multiple' && (
            <div>
              <Calendar
                mode="multiple"
                selected={multipleDates}
                onSelect={(dates) => dates && setMultipleDates(dates)}
                locale={fr}
                className="rounded-xl bg-white/5 p-3"
              />
              {multipleDates.length > 0 && (
                <p className="text-zinc-400 text-sm mt-3 text-center">
                  {multipleDates.length} date(s) sélectionnée(s)
                </p>
              )}
            </div>
          )}

          {/* Weekly Repeat */}
          {scheduleMode === 'weekly' && (
            <div className="space-y-4">
              {/* Week days selector */}
              <div>
                <Label className="text-zinc-400 text-sm mb-2 block">Jours de la semaine</Label>
                <div className="flex gap-2">
                  {WEEK_DAYS.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => toggleWeekDay(day.value)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        weekDays.includes(day.value)
                          ? 'bg-[var(--theme-primary)] text-white'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-400 text-sm">Date de début</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-sm">Date de fin</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                  />
                </div>
              </div>

              {/* Quick duration buttons */}
              <div>
                <Label className="text-zinc-400 text-sm mb-2 block">Durée rapide</Label>
                <div className="flex gap-2">
                  {[
                    { weeks: 2, label: '2 sem' },
                    { weeks: 4, label: '1 mois' },
                    { weeks: 8, label: '2 mois' },
                  ].map((opt) => (
                    <button
                      key={opt.weeks}
                      onClick={() => {
                        setRepeatWeeks(opt.weeks);
                        setEndDate(format(addWeeks(new Date(startDate), opt.weeks), 'yyyy-MM-dd'));
                      }}
                      className="flex-1 py-2 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 text-sm transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewDates.length > 0 && (
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={() => setShowSchedulePreview(!showSchedulePreview)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-[var(--theme-primary)] text-sm font-medium">
                  {previewDates.length} séance(s) à créer
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 transition-transform ${showSchedulePreview ? 'rotate-180' : ''}`}
                />
              </button>
              {showSchedulePreview && (
                <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                  {previewDates.map((date) => (
                    <div key={date} className="text-zinc-400 text-sm py-1">
                      {format(new Date(date), 'EEEE d MMMM yyyy', { locale: fr })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Blocks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white font-['Outfit']">Exercices</h2>
            <span className="text-sm text-zinc-500">~{getTotalDuration()} min</span>
          </div>

          {blocks.map((block, blockIndex) => (
            <div
              key={block.block_type}
              className="card overflow-hidden"
            >
              <button
                onClick={() => toggleBlockExpanded(blockIndex)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">
                    {BLOCK_TYPES.find((b) => b.value === block.block_type)?.label}
                  </span>
                  <span className="text-zinc-500 text-sm">
                    {block.exercises.length} exercice(s)
                  </span>
                </div>
                {block.expanded ? (
                  <ChevronUp size={18} className="text-zinc-400" />
                ) : (
                  <ChevronDown size={18} className="text-zinc-400" />
                )}
              </button>

              {block.expanded && (
                <div className="border-t border-white/5 p-4 space-y-3">
                  {block.exercises.map((exercise, exerciseIndex) => (
                    <div
                      key={exerciseIndex}
                      className="p-3 bg-white/5 rounded-xl space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveExercise(blockIndex, exerciseIndex, -1)}
                            disabled={exerciseIndex === 0}
                            className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                          >
                            <ChevronUp size={14} className="text-zinc-400" />
                          </button>
                          <button
                            onClick={() => moveExercise(blockIndex, exerciseIndex, 1)}
                            disabled={exerciseIndex === block.exercises.length - 1}
                            className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                          >
                            <ChevronDown size={14} className="text-zinc-400" />
                          </button>
                        </div>
                        {exercise.image_url && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                            <img
                              src={exercise.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => e.target.parentElement.style.display = 'none'}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-white font-medium">{exercise.name}</p>
                          {exercise.description && (
                            <p className="text-zinc-500 text-xs truncate">{exercise.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeExercise(blockIndex, exerciseIndex)}
                          className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {exercise.exercise_type === 'duration' ? (
                          <div>
                            <Label className="text-[10px] text-zinc-500 uppercase">Durée (s)</Label>
                            <Input
                              type="number"
                              value={exercise.duration || ''}
                              onChange={(e) =>
                                updateExercise(blockIndex, exerciseIndex, 'duration', parseInt(e.target.value) || 0)
                              }
                              className="h-10 mt-1 rounded-lg bg-[#141414] border-white/10 text-white text-center"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label className="text-[10px] text-zinc-500 uppercase">Répétitions</Label>
                            <Input
                              type="number"
                              value={exercise.reps || ''}
                              onChange={(e) =>
                                updateExercise(blockIndex, exerciseIndex, 'reps', parseInt(e.target.value) || 0)
                              }
                              className="h-10 mt-1 rounded-lg bg-[#141414] border-white/10 text-white text-center"
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-[10px] text-zinc-500 uppercase">Repos (s)</Label>
                          <Input
                            type="number"
                            value={exercise.rest_after || ''}
                            onChange={(e) =>
                              updateExercise(blockIndex, exerciseIndex, 'rest_after', parseInt(e.target.value) || 0)
                            }
                            className="h-10 mt-1 rounded-lg bg-[#141414] border-white/10 text-white text-center"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() =>
                              updateExercise(blockIndex, exerciseIndex, 'tts_enabled', !exercise.tts_enabled)
                            }
                            className={`w-full h-10 rounded-lg text-sm transition-colors ${
                              exercise.tts_enabled
                                ? 'bg-[var(--theme-primary)] text-white'
                                : 'bg-white/5 text-zinc-500'
                            }`}
                          >
                            🔊
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Dialog open={exerciseDialogOpen && currentBlockIndex === blockIndex} onOpenChange={(open) => {
                    setExerciseDialogOpen(open);
                    if (!open) resetExerciseDialogState();
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCurrentBlockIndex(blockIndex);
                          setExerciseDialogOpen(true);
                        }}
                        className="w-full border-dashed border-white/20 text-zinc-400 hover:text-white hover:border-white/40"
                      >
                        <Plus size={18} className="mr-2" /> Ajouter un exercice
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.25rem)] flex-col gap-0 overflow-hidden border-white/10 bg-[#141414] p-0 sm:max-w-lg left-[50%] top-[max(0.75rem,3vh)] translate-x-[-50%] translate-y-0 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]">
                      <div className="shrink-0 space-y-3 border-b border-white/10 px-5 pb-4 pt-5 pr-12">
                        <DialogHeader className="space-y-1 text-left">
                          <DialogTitle className="text-white">
                            {exerciseTab === 'create'
                              ? editingExerciseId
                                ? 'Modifier l’exercice'
                                : 'Créer un exercice'
                              : 'Choisir un exercice'}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#0A0A0A] p-1">
                          <button
                            type="button"
                            onClick={() => setExerciseTab('library')}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              exerciseTab === 'library'
                                ? 'bg-[var(--theme-primary)] text-white'
                                : 'text-zinc-400 hover:bg-white/5'
                            }`}
                          >
                            Bibliothèque
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExerciseId(null);
                              setNewExercise(DEFAULT_NEW_EXERCISE);
                              setExerciseTab('create');
                            }}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              exerciseTab === 'create'
                                ? 'bg-[var(--theme-primary)] text-white'
                                : 'text-zinc-400 hover:bg-white/5'
                            }`}
                          >
                            Nouvel exercice
                          </button>
                        </div>
                      </div>

                      {exerciseTab === 'library' ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
                          <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <Input
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Rechercher..."
                              className="pl-10 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                            />
                          </div>
                          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                              {filteredExercises.map((exercise) => (
                                <div
                                  key={exercise.id}
                                  className="flex items-stretch gap-1 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                  <button
                                    type="button"
                                    onClick={() => addExerciseToBlock(exercise)}
                                    className="flex-1 min-w-0 p-3 text-left flex items-center gap-3 rounded-xl"
                                  >
                                    {exercise.image_url ? (
                                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                                        <img
                                          src={exercise.image_url}
                                          alt=""
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-zinc-600"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>';
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                        <ImageIcon size={20} className="text-zinc-600" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white font-medium">{exercise.name}</p>
                                      <p className="text-zinc-500 text-sm flex items-center gap-2">
                                        <span className="capitalize">{exercise.category}</span>
                                        <span>•</span>
                                        {exercise.exercise_type === 'duration' ? (
                                          <span className="flex items-center gap-1">
                                            <Clock size={12} /> {exercise.default_duration}s
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-1">
                                            <Hash size={12} /> {exercise.default_reps} reps
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </button>
                                  {!exercise.is_system && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Modifier"
                                      className="shrink-0 self-center mr-1 h-10 w-10 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                                      onClick={(e) => startEditExercise(exercise, e)}
                                    >
                                      <Pencil size={18} />
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {filteredExercises.length === 0 && (
                                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
                                  Aucun exercice trouvé.
                                </div>
                              )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-h-0 flex-1 flex-col">
                          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                            <form
                              id="create-exercise-form"
                              onSubmit={handleCreateExercise}
                              className="space-y-3"
                            >
                            <div>
                              <Label className="text-zinc-400 text-sm">Nom *</Label>
                              <Input
                                value={newExercise.name}
                                onChange={(e) => updateNewExerciseField('name', e.target.value)}
                                placeholder="Ex : Jumping jacks"
                                className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-zinc-400 text-sm">Description</Label>
                              <Textarea
                                value={newExercise.description}
                                onChange={(e) => updateNewExerciseField('description', e.target.value)}
                                placeholder="Consignes rapides..."
                                className="mt-2 rounded-xl bg-[#0A0A0A] border-white/10 text-white min-h-[72px]"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-zinc-400 text-sm">Catégorie</Label>
                                <Input
                                  value={newExercise.category}
                                  onChange={(e) => updateNewExerciseField('category', e.target.value)}
                                  placeholder="cardio"
                                  className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                                />
                              </div>
                              <div>
                                <Label className="text-zinc-400 text-sm">Type</Label>
                                <Select
                                  value={newExercise.exercise_type}
                                  onValueChange={(value) => updateNewExerciseField('exercise_type', value)}
                                >
                                  <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#141414] border-white/10">
                                    <SelectItem value="reps" className="text-white">Répétitions</SelectItem>
                                    <SelectItem value="duration" className="text-white">Durée</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {newExercise.exercise_type === 'duration' ? (
                                <div>
                                  <Label className="text-zinc-400 text-sm">Durée par défaut (s) *</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={newExercise.default_duration}
                                    onChange={(e) => updateNewExerciseField('default_duration', e.target.value)}
                                    className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <Label className="text-zinc-400 text-sm">Répétitions par défaut *</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={newExercise.default_reps}
                                    onChange={(e) => updateNewExerciseField('default_reps', e.target.value)}
                                    className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                                  />
                                </div>
                              )}
                              <div>
                                <Label className="text-zinc-400 text-sm">Repos (s)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={newExercise.default_rest}
                                  onChange={(e) => updateNewExerciseField('default_rest', e.target.value)}
                                  className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
                                />
                              </div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                              <Label className="text-zinc-300 text-sm font-medium">Média (optionnel)</Label>
                              <input
                                ref={newExerciseGifInputRef}
                                type="file"
                                accept="image/gif,.gif"
                                className="sr-only"
                                onChange={handleNewExerciseGifFile}
                              />
                              {newExercise.image_url.startsWith('data:') ? (
                                <div className="mt-3 flex gap-3">
                                  <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black">
                                    <img
                                      src={newExercise.image_url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                                    <p className="text-xs text-zinc-400 leading-snug">
                                      GIF intégré (fichier local, max{' '}
                                      {Math.round(MAX_GIF_FILE_BYTES / 1024 / 1024)} Mo).
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => newExerciseGifInputRef.current?.click()}
                                        className="h-9 shrink-0 rounded-lg border-white/15 bg-white/5 px-3 text-white hover:bg-white/10"
                                      >
                                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                                        Remplacer
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => updateNewExerciseField('image_url', '')}
                                        className="h-9 shrink-0 rounded-lg border-white/15 bg-transparent px-3 text-zinc-400 hover:bg-white/5 hover:text-white"
                                      >
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                        Retirer
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  <Input
                                    value={newExercise.image_url}
                                    onChange={(e) => updateNewExerciseField('image_url', e.target.value)}
                                    placeholder="URL https://… (GIF ou image)"
                                    className="h-11 rounded-lg bg-[#141414] border-white/10 text-white text-sm"
                                  />
                                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-600">
                                    <span className="h-px flex-1 bg-white/10" />
                                    ou fichier
                                    <span className="h-px flex-1 bg-white/10" />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => newExerciseGifInputRef.current?.click()}
                                    className="h-10 w-full rounded-lg border-white/15 bg-white/5 text-sm text-white hover:bg-white/10"
                                  >
                                    <Upload className="mr-2 h-4 w-4 shrink-0" />
                                    Choisir un GIF sur l&apos;appareil
                                  </Button>
                                </div>
                              )}
                              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                                URL externe ou GIF importé sans hébergement.
                              </p>
                            </div>
                            </form>
                          </div>
                          <div className="shrink-0 space-y-2 border-t border-white/10 bg-[#101010] px-5 py-4">
                            {editingExerciseId && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setEditingExerciseId(null);
                                  setNewExercise(DEFAULT_NEW_EXERCISE);
                                  setExerciseTab('library');
                                }}
                                className="h-11 w-full rounded-xl border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                              >
                                Annuler la modification
                              </Button>
                            )}
                            <Button
                              type="submit"
                              form="create-exercise-form"
                              disabled={creatingExercise}
                              className="h-12 w-full rounded-xl text-white btn-primary"
                            >
                              {creatingExercise ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : editingExerciseId ? (
                                'Enregistrer'
                              ) : (
                                'Créer et ajouter'
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={() => handleSave(false)}
            disabled={saving || previewDates.length === 0}
            data-testid="save-workout-btn"
            className="w-full h-14 rounded-xl font-bold text-white btn-primary"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Planifier {previewDates.length > 1 ? `${previewDates.length} séances` : 'la séance'}
              </>
            )}
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-white/5 border-white/10 text-white"
            >
              <Save size={18} className="mr-2" /> Brouillon
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAsTemplate}
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-white/5 border-white/10 text-white"
            >
              <Copy size={18} className="mr-2" /> Modèle
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!templatePendingDelete}
        onOpenChange={(open) => {
          if (!open) setTemplatePendingDelete(null);
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#141414] text-white sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {templatePendingDelete
                ? `« ${templatePendingDelete.title} » sera définitivement supprimé.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteTemplate();
              }}
              disabled={deletingTemplate}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {deletingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
