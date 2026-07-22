import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, exercisesApi, templatesApi, formatApiError } from '../lib/api';
import { sanitizeExerciseForApi, handleExerciseImageError } from '../lib/exerciseMedia';
import { resolveExerciseMediaUrl } from '../lib/exerciseMedia';
import {
  createExerciseSearchController,
  EXERCISE_FILTER_PRESETS,
} from '../lib/exerciseSearch';
import {
  ExerciseMediaThumb,
  exerciseSecondaryLabel,
} from '../components/exercises/ExerciseMediaThumb';
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
  DialogDescription,
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
import { format, addDays, addWeeks, startOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLocaleFormat } from '../hooks/useLocaleFormat';

const BLOCK_TYPE_VALUES = ['warmup', 'main', 'cooldown'];
const DIFFICULTY_VALUES = ['easy', 'medium', 'hard', 'intense'];
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
  const { t, i18n } = useTranslation(['workouts', 'common']);
  const { dateFnsLocale, formatShortDate, formatDate } = useLocaleFormat();
  const blockTypes = useMemo(
    () =>
      BLOCK_TYPE_VALUES.map((value) => ({
        value,
        label: t(`workouts:create.blockTypes.${value}`),
      })),
    [t]
  );
  const difficulties = useMemo(
    () =>
      DIFFICULTY_VALUES.map((value) => ({
        value,
        label: t(`workouts:create.difficulties.${value}`),
      })),
    [t]
  );
  const weekDaysOptions = useMemo(
    () =>
      WEEKDAY_KEYS.map((key, value) => ({
        value,
        label: t(`workouts:create.weekdays.${key}`),
      })),
    [t]
  );
  const scheduleModes = useMemo(
    () => [
      { value: 'single', label: t('workouts:create.scheduling.single') },
      { value: 'multiple', label: t('workouts:create.scheduling.multiple') },
      { value: 'weekly', label: t('workouts:create.scheduling.weekly') },
    ],
    [t]
  );
  const quickDurationOptions = useMemo(
    () => [
      { weeks: 2, label: t('workouts:create.scheduling.weeks2') },
      { weeks: 4, label: t('workouts:create.scheduling.month1') },
      { weeks: 8, label: t('workouts:create.scheduling.months2') },
    ],
    [t]
  );
  const maxGifMb = Math.round(MAX_GIF_FILE_BYTES / 1024 / 1024);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { workoutId: editWorkoutId } = useParams();
  const isEditMode = Boolean(editWorkoutId);
  const [drafts, setDrafts] = useState([]);
  const [editingDraft, setEditingDraft] = useState(false);
  const [abandonDialogOpen, setAbandonDialogOpen] = useState(false);
  const [deleteDraftDialogOpen, setDeleteDraftDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const draftDeletedRef = useRef(false);
  
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
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatePendingDelete, setTemplatePendingDelete] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [exerciseLibraryLoading, setExerciseLibraryLoading] = useState(false);
  const [exerciseLibraryLoaded, setExerciseLibraryLoaded] = useState(false);
  const [exercisePage, setExercisePage] = useState(1);
  const [exerciseHasMore, setExerciseHasMore] = useState(false);
  const [exerciseTotal, setExerciseTotal] = useState(0);
  const [exerciseLoadingMore, setExerciseLoadingMore] = useState(false);
  const [sportFilter, setSportFilter] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('');
  const [customCreationEnabled, setCustomCreationEnabled] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [exerciseTab, setExerciseTab] = useState('library');
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState(null);
  const [newExercise, setNewExercise] = useState(DEFAULT_NEW_EXERCISE);
  const newExerciseGifInputRef = useRef(null);
  const templateCacheRef = useRef(new Map());
  const exerciseSearchRef = useRef(null);
  const exerciseListRef = useRef(null);

  if (!exerciseSearchRef.current) {
    exerciseSearchRef.current = createExerciseSearchController({ api: exercisesApi, limit: 30 });
  }

  useEffect(() => {
    draftDeletedRef.current = false;
    loadData();
  }, [editWorkoutId]);

  const refreshDrafts = async () => {
    if (isEditMode) return;
    try {
      const res = await workoutsApi.getDrafts();
      setDrafts(res.data || []);
    } catch {
      setDrafts([]);
    }
  };

  useEffect(() => {
    if (isEditMode) return;
    refreshDrafts();
  }, [isEditMode]);

  const clearLocalDraftStorage = () => {
    try {
      sessionStorage.removeItem('workout_draft');
      sessionStorage.removeItem('create_workout_draft');
      localStorage.removeItem('workout_draft');
      localStorage.removeItem('create_workout_draft');
    } catch {
      /* ignore */
    }
  };

  const resetFormState = () => {
    setTitle('');
    setDescription('');
    setForUserId(user?.id || '');
    setScheduledTime('');
    setDifficulty('medium');
    setScheduleMode('single');
    setSingleDate(new Date());
    setMultipleDates([]);
    setWeekDays([]);
    setBlocks([
      { block_type: 'warmup', exercises: [], expanded: true },
      { block_type: 'main', exercises: [], expanded: true },
      { block_type: 'cooldown', exercises: [], expanded: true },
    ]);
    setEditingDraft(false);
  };

  const handleDeleteDraft = async (draftId) => {
    if (!draftId) return;
    setDeletingDraft(true);
    draftDeletedRef.current = true;
    try {
      await workoutsApi.delete(draftId);
      clearLocalDraftStorage();
      resetFormState();
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success(t('workouts:create.toast.draftDeleted'));
      if (isEditMode && editWorkoutId === draftId) {
        navigate('/create');
      }
    } catch (error) {
      draftDeletedRef.current = false;
      toast.error(formatApiError(error));
    } finally {
      setDeletingDraft(false);
      setDeleteDraftDialogOpen(false);
      setDraftToDelete(null);
      await refreshDrafts();
    }
  };

  const handleAbandonSaveDraft = async () => {
    setAbandonDialogOpen(false);
    await handleSave(true);
    if (!isEditMode) {
      navigate('/create');
    } else {
      navigate('/create');
    }
  };

  const handleAbandonDelete = async () => {
    setAbandonDialogOpen(false);
    draftDeletedRef.current = true;
    clearLocalDraftStorage();
    resetFormState();
    if (isEditMode && editWorkoutId) {
      try {
        await workoutsApi.delete(editWorkoutId);
      } catch {
        /* peut déjà être absent */
      }
    }
    await refreshDrafts();
    navigate('/create');
  };

  const loadData = async () => {
    try {
      const tasks = [templatesApi.getAll({ summary: true })];
      if (isEditMode) {
        tasks.push(workoutsApi.getOne(editWorkoutId, { allow_draft: true }));
      }
      const results = await Promise.all(tasks);
      setTemplates(results[0].data || []);

      if (isEditMode && results[1]?.data) {
        const w = results[1].data;
        setEditingDraft(!!w.is_draft);
        setTitle(w.title || '');
        setDescription(w.description || '');
        setForUserId(w.for_user_id || user?.id || '');
        setScheduledTime(w.scheduled_time || '');
        setDifficulty(w.difficulty || 'medium');
        setScheduleMode('single');
        if (w.scheduled_date) {
          setSingleDate(parseISO(w.scheduled_date));
        }
        if (w.blocks?.length) {
          setBlocks(
            w.blocks.map((b) => ({
              block_type: b.block_type,
              exercises: b.exercises || [],
              expanded: true,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      if (isEditMode) {
        toast.error(t('workouts:create.toast.workoutNotFound'));
        navigate('/workouts');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadExerciseLibrary = async ({ page = 1, append = false } = {}) => {
    if (append) {
      if (exerciseLoadingMore || !exerciseHasMore) return;
      setExerciseLoadingMore(true);
    } else {
      setExerciseLibraryLoading(true);
    }
    try {
      const locale = (i18n?.language || 'fr').split('-')[0];
      const params = {
        q: debouncedQuery || undefined,
        sport: sportFilter || undefined,
        equipment: equipmentFilter || undefined,
        muscle: muscleFilter || undefined,
        page,
        limit: 30,
        locale,
      };
      const data = await exerciseSearchRef.current.search(params, {
        debounceMs: 0,
      });
      if (!data) return;
      const items = data.items || [];
      setExercises((prev) => (append ? [...prev, ...items] : items));
      setExercisePage(data.page || page);
      setExerciseHasMore(Boolean(data.has_more));
      setExerciseTotal(data.total || items.length);
      setCustomCreationEnabled(Boolean(data.custom_creation_enabled));
      setExerciseLibraryLoaded(true);
      if (!data.custom_creation_enabled) {
        setExerciseTab('library');
      }
    } catch (error) {
      toast.error(t('workouts:create.toast.libraryLoadError'));
    } finally {
      setExerciseLibraryLoading(false);
      setExerciseLoadingMore(false);
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
      exercise_name_snapshot: exercise.name,
      media_snapshot: exercise.image_url || null,
      tracking_type_snapshot: exercise.tracking_type || exercise.exercise_type || 'reps',
    };

    setBlocks((prev) => {
      const updated = [...prev];
      updated[currentBlockIndex].exercises.push(newExercise);
      return updated;
    });

    if (exerciseListRef.current) {
      exerciseSearchRef.current.saveScroll(exerciseListRef.current.scrollTop);
    }
    setExerciseDialogOpen(false);
    setCurrentBlockIndex(null);
    setSearchQuery('');
    setDebouncedQuery('');
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
      toast.error(t('workouts:create.toast.gifFormatError'));
      return;
    }
    if (file.size > MAX_GIF_FILE_BYTES) {
      toast.error(t('workouts:create.toast.gifTooLarge', { maxMb: maxGifMb }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        updateNewExerciseField('image_url', result);
        toast.success(t('workouts:create.toast.gifImported'));
      }
    };
    reader.onerror = () => toast.error(t('workouts:create.toast.fileReadError'));
    reader.readAsDataURL(file);
  };

  const resetExerciseDialogState = () => {
    setCurrentBlockIndex(null);
    setSearchQuery('');
    setDebouncedQuery('');
    setExerciseTab('library');
    setCreatingExercise(false);
    setEditingExerciseId(null);
    setNewExercise(DEFAULT_NEW_EXERCISE);
    setSportFilter('');
    setEquipmentFilter('');
    setMuscleFilter('');
    setFiltersOpen(false);
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
    if (!customCreationEnabled && !editingExerciseId) {
      toast.error(t('workouts:create.toast.customCreationDisabled'));
      return;
    }

    if (!newExercise.name.trim()) {
      toast.error(t('workouts:create.toast.exerciseNameRequired'));
      return;
    }

    if (newExercise.exercise_type === 'duration' && !newExercise.default_duration) {
      toast.error(t('workouts:create.toast.defaultDurationRequired'));
      return;
    }

    if (newExercise.exercise_type === 'reps' && !newExercise.default_reps) {
      toast.error(t('workouts:create.toast.defaultRepsRequired'));
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
        toast.success(t('workouts:create.toast.exerciseUpdated'));
      } else {
        const { data } = await exercisesApi.create(payload);
        setExercises((prev) => [data, ...prev]);
        addExerciseToBlock(data);
        setNewExercise(DEFAULT_NEW_EXERCISE);
        toast.success(t('workouts:create.toast.exerciseCreatedAdded'));
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

  const loadFromTemplate = async (template) => {
    try {
      let templateData = template;
      if (!templateData.blocks) {
        if (templateCacheRef.current.has(template.id)) {
          templateData = templateCacheRef.current.get(template.id);
        } else {
          const { data } = await templatesApi.getOne(template.id);
          templateData = data;
          templateCacheRef.current.set(template.id, data);
        }
      }

      setTitle(templateData.title);
      setDescription(templateData.description || '');
      setDifficulty(templateData.difficulty || 'medium');

      if (templateData.blocks) {
        setBlocks(
          templateData.blocks.map((b) => ({
            ...b,
            expanded: true,
            exercises: b.exercises || [],
          }))
        );
      }

      toast.success(t('workouts:create.toast.templateLoaded'));
    } catch (error) {
      toast.error(t('workouts:create.toast.templateLoadError'));
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!templatePendingDelete) return;
    setDeletingTemplate(true);
    try {
      await templatesApi.delete(templatePendingDelete.id);
      setTemplates((prev) => prev.filter((t) => t.id !== templatePendingDelete.id));
      toast.success(t('workouts:create.toast.templateDeleted'));
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
    const exerciseCount = blocks.reduce((n, b) => n + b.exercises.length, 0);
    const validationErrors = [];

    if (!title.trim()) validationErrors.push(t('workouts:create.validation.titleRequired'));
    if (exerciseCount === 0) validationErrors.push(t('workouts:create.validation.exerciseRequired'));
    if (previewDates.length === 0) {
      if (scheduleMode === 'weekly' && weekDays.length === 0) {
        validationErrors.push(t('workouts:create.validation.weekDayRequired'));
      } else {
        validationErrors.push(t('workouts:create.validation.dateRequired'));
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('[Workout Plan Click]', {
        title,
        exerciseCount,
        selectedDates: previewDates,
        startTime: scheduledTime,
        recurrence: scheduleMode,
        status: asDraft ? 'draft' : 'scheduled',
        isSaving: saving,
        validationErrors,
        draftDeleted: draftDeletedRef.current,
      });
    }

    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }

    if (draftDeletedRef.current) {
      toast.error(t('workouts:create.validation.draftDeleted'));
      return;
    }

    setSaving(true);
    try {
      const blocksPayload = blocks
        .filter((b) => b.exercises.length > 0)
        .map((b) => ({
          block_type: b.block_type,
          exercises: b.exercises.map(sanitizeExerciseForApi),
        }));

      if (isEditMode) {
        const workoutData = {
          title: title.trim(),
          description: description.trim(),
          for_user_id: forUserId || user.id,
          scheduled_date: format(singleDate, 'yyyy-MM-dd'),
          scheduled_time: scheduledTime || null,
          difficulty,
          blocks: blocksPayload,
          is_draft: asDraft,
        };
        const endpoint = `/workouts/${editWorkoutId}`;
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Workout Plan Request]', { endpoint, method: 'PUT', payload: workoutData });
        }
        const response = await workoutsApi.update(editWorkoutId, workoutData);
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Workout Plan Response]', response.data);
        }
        if (!asDraft) {
          clearLocalDraftStorage();
          draftDeletedRef.current = false;
        }
        toast.success(asDraft ? t('workouts:create.toast.draftSaved') : t('workouts:create.toast.workoutScheduled'));
        navigate(asDraft ? '/create' : '/workouts');
        return;
      }

      if (scheduleMode === 'single') {
        const workoutData = {
          title: title.trim(),
          description: description.trim(),
          for_user_id: forUserId || user.id,
          scheduled_date: format(singleDate, 'yyyy-MM-dd'),
          scheduled_time: scheduledTime || null,
          difficulty,
          blocks: blocksPayload,
          is_draft: asDraft,
        };
        const endpoint = '/workouts';
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Workout Plan Request]', { endpoint, method: 'POST', payload: workoutData });
        }
        const response = await workoutsApi.create(workoutData);
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Workout Plan Response]', response.data);
        }
        if (!asDraft) {
          clearLocalDraftStorage();
          draftDeletedRef.current = false;
        }
        toast.success(asDraft ? t('workouts:create.toast.draftSaved') : t('workouts:create.toast.workoutScheduled'));
        navigate(asDraft ? '/create' : '/workouts');
      } else {
        const multiData = {
          title: title.trim(),
          description: description.trim(),
          for_user_id: forUserId || user.id,
          scheduled_time: scheduledTime || null,
          difficulty,
          blocks: blocksPayload,
          schedule_mode:
            scheduleMode === 'multiple'
              ? 'multiple_dates'
              : scheduleMode === 'weekly'
                ? 'weekly_repeat'
                : 'multiple_dates',
          dates: scheduleMode === 'multiple' ? multipleDates.map((d) => format(d, 'yyyy-MM-dd')) : [],
          week_days: scheduleMode === 'weekly' ? weekDays : [],
          start_date: scheduleMode === 'weekly' ? startDate : null,
          end_date: scheduleMode === 'weekly' ? endDate : null,
          repeat_weeks: scheduleMode === 'weekly' ? repeatWeeks : null,
        };
        const endpoint = '/workouts/multi-schedule';
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Workout Plan Request]', { endpoint, method: 'POST', payload: multiData });
        }
        const response = await workoutsApi.createMulti(multiData);
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Workout Plan Response]', response.data);
        }
        clearLocalDraftStorage();
        draftDeletedRef.current = false;
        toast.success(t('workouts:create.toast.multiScheduled', { count: response.data.created }));
        navigate('/workouts');
      }
    } catch (error) {
      console.error('[Workout Plan Error]', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!title.trim()) {
      toast.error(t('workouts:create.validation.sessionTitleRequired'));
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
      toast.success(t('workouts:create.toast.templateSaved'));
    } catch (error) {
      toast.error(t('workouts:create.toast.templateSaveError'));
    }
  };

  const filteredExercises = exercises;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (!exerciseDialogOpen) return;
    exerciseSearchRef.current.clearCache();
    loadExerciseLibrary({ page: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseDialogOpen, debouncedQuery, sportFilter, equipmentFilter, muscleFilter, i18n.language]);

  useEffect(() => {
    return () => exerciseSearchRef.current?.cancel();
  }, []);

  const onExerciseListScroll = (event) => {
    const el = event.currentTarget;
    if (!exerciseHasMore || exerciseLoadingMore || exerciseLibraryLoading) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      loadExerciseLibrary({ page: exercisePage + 1, append: true });
    }
  };

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
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            {isEditMode ? t('workouts:create.editTitle') : t('workouts:create.title')}
          </h1>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="text-foreground border-border"
              title={t('workouts:create.saveDraftTitle')}
            >
              <Save size={16} />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-5">
        {!isEditMode && drafts.length > 0 ? (
          <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-amber-200 font-medium">{t('workouts:create.draftSection.title')}</p>
            <p className="text-amber-200/70 text-sm mt-1">
              {t('workouts:create.draftSection.hint')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-amber-500/30 text-amber-100 hover:bg-amber-500/10"
                onClick={() => navigate(`/workouts/${drafts[0].id}`)}
              >
                {t('workouts:create.draftSection.open')}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="delete-draft-btn"
                className="rounded-xl border-red-500/30 text-red-200 hover:bg-red-500/10"
                onClick={() => {
                  setDraftToDelete(drafts[0]);
                  setDeleteDraftDialogOpen(true);
                }}
              >
                {t('workouts:create.draftSection.delete')}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 order-1 lg:order-2 lg:col-span-4 lg:sticky lg:top-24 h-fit">
            {/* Modèles — liste + actions claires */}
            <div className="rounded-xl border border-border bg-surface-elevated p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Label className="block text-sm font-medium text-muted">{t('workouts:create.templates.saved')}</Label>
            {templates.length > 0 && (
              <button
                type="button"
                onClick={() => setTemplatesOpen((v) => !v)}
                className="text-xs font-medium text-[var(--theme-primary)] hover:opacity-90 flex items-center gap-1"
              >
                {templatesOpen ? t('workouts:create.templates.hide') : t('workouts:create.templates.show')} ({templates.length})
                {templatesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
          {templates.length > 0 && (
            <Select
              onValueChange={(id) => {
                const t = templates.find((x) => x.id === id);
                if (t) loadFromTemplate(t);
              }}
            >
              <SelectTrigger className="mb-3 h-12 w-full rounded-xl bg-background border-border text-foreground">
                <SelectValue placeholder={t('workouts:create.templates.loadPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="bg-surface-elevated border-border max-h-64">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-foreground">
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {templates.length === 0 ? (
            <p className="text-sm text-subtle">
              {t('workouts:create.templates.empty')}
            </p>
          ) : templatesOpen ? (
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">{template.title}</p>
                      {template.is_system && (
                        <span className="shrink-0 rounded-full bg-[var(--theme-primary)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-primary)]">
                          Anthea
                        </span>
                      )}
                    </div>
                    {template.difficulty && (
                      <p className="text-xs capitalize text-subtle">
                        {t(`workouts:create.difficulties.${template.difficulty}`, {
                          defaultValue: template.difficulty,
                        })}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => loadFromTemplate(template)}
                    className="shrink-0 border-border bg-hover text-foreground hover:bg-active"
                  >
                    {t('workouts:create.loadTemplate')}
                  </Button>
                  {!template.is_system && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title={t('workouts:create.deleteTemplateTitle')}
                      className="h-9 w-9 shrink-0 text-subtle hover:bg-red-500/15 hover:text-red-400"
                      onClick={() => setTemplatePendingDelete(template)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
            </div>
          </div>

          <div className="space-y-6 order-2 lg:order-1 lg:col-span-8">
            {/* Basic Info */}
            <div className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-muted text-sm">
              {t('workouts:create.titleLabel')} *
            </Label>
            <Input
              id="title"
              data-testid="workout-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('workouts:create.titlePlaceholder')}
              className="mt-2 h-14 rounded-xl bg-surface-elevated border-border text-foreground"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-muted text-sm">
              {t('workouts:create.descriptionOptional')}
            </Label>
            <Textarea
              id="description"
              data-testid="workout-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('workouts:create.descriptionPlaceholder')}
              className="mt-2 rounded-xl bg-surface-elevated border-border text-foreground min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted text-sm">{t('workouts:create.forWho')}</Label>
              <Select value={forUserId || user?.id} onValueChange={setForUserId}>
                <SelectTrigger className="mt-2 h-14 rounded-xl bg-surface-elevated border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  <SelectItem value={user?.id} className="text-foreground">{t('workouts:create.me')}</SelectItem>
                  {user?.partner_id && (
                    <SelectItem value={user.partner_id} className="text-foreground">
                      {user.partner_username}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted text-sm">{t('workouts:create.difficultyLabel')}</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="mt-2 h-14 rounded-xl bg-surface-elevated border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-elevated border-border">
                  {difficulties.map((d) => (
                    <SelectItem key={d.value} value={d.value} className="text-foreground">
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-muted text-sm">{t('workouts:create.timeOptional')}</Label>
            <Input
              type="time"
              data-testid="workout-time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="mt-2 h-14 rounded-xl bg-surface-elevated border-border text-foreground"
            />
          </div>
            </div>

            {/* SCHEDULING SECTION */}
            <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="text-[var(--theme-primary)]" size={20} />
            <h3 className="text-foreground font-semibold">{t('workouts:create.scheduling.title')}</h3>
          </div>

          {/* Schedule Mode Tabs — masqués en édition */}
          {!isEditMode && (
          <div className="flex gap-2">
            {scheduleModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setScheduleMode(mode.value)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  scheduleMode === mode.value
                    ? 'bg-[var(--theme-primary)] text-foreground'
                    : 'bg-hover text-muted hover:bg-active'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          )}

          {/* Single Date */}
          {(isEditMode || scheduleMode === 'single') && (
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={singleDate}
                onSelect={(date) => date && setSingleDate(date)}
                locale={dateFnsLocale}
                className="rounded-xl bg-hover p-3"
              />
            </div>
          )}

          {/* Multiple Dates */}
          {!isEditMode && scheduleMode === 'multiple' && (
            <div className="space-y-4">
              <div className="flex justify-center overflow-x-auto -mx-1 px-1">
                <Calendar
                  mode="multiple"
                  selected={multipleDates}
                  onSelect={(dates) => dates && setMultipleDates(dates)}
                  locale={dateFnsLocale}
                  className="rounded-xl bg-hover p-3 shrink-0"
                />
              </div>
              {multipleDates.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-muted text-sm text-center">
                    {t('workouts:create.scheduling.datesSelected', { count: multipleDates.length })}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-h-32 overflow-y-auto px-1">
                    {[...multipleDates]
                      .sort((a, b) => a - b)
                      .map((date) => (
                        <button
                          key={date.toISOString()}
                          type="button"
                          onClick={() => toggleMultipleDate(date)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-hover border border-border px-3 py-1.5 text-xs text-foreground hover:bg-active transition-colors max-w-full"
                        >
                          <span className="truncate">{formatShortDate(date)}</span>
                          <span className="text-subtle shrink-0">×</span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <p className="text-subtle text-sm text-center">
                  {t('workouts:create.scheduling.selectDatesHint')}
                </p>
              )}
            </div>
          )}

          {/* Weekly Repeat */}
          {!isEditMode && scheduleMode === 'weekly' && (
            <div className="space-y-4">
              {/* Week days selector */}
              <div>
                <Label className="text-muted text-sm mb-2 block">{t('workouts:create.scheduling.weekDays')}</Label>
                <div className="flex gap-2">
                  {weekDaysOptions.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => toggleWeekDay(day.value)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        weekDays.includes(day.value)
                          ? 'bg-[var(--theme-primary)] text-foreground'
                          : 'bg-hover text-muted hover:bg-active'
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
                  <Label className="text-muted text-sm">{t('workouts:create.scheduling.startDate')}</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-2 h-12 rounded-xl bg-background border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted text-sm">{t('workouts:create.scheduling.endDate')}</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-2 h-12 rounded-xl bg-background border-border text-foreground"
                  />
                </div>
              </div>

              {/* Quick duration buttons */}
              <div>
                <Label className="text-muted text-sm mb-2 block">{t('workouts:create.scheduling.quickDuration')}</Label>
                <div className="flex gap-2">
                  {quickDurationOptions.map((opt) => (
                    <button
                      key={opt.weeks}
                      onClick={() => {
                        setRepeatWeeks(opt.weeks);
                        setEndDate(format(addWeeks(new Date(startDate), opt.weeks), 'yyyy-MM-dd'));
                      }}
                      className="flex-1 py-2 rounded-lg bg-hover text-muted hover:bg-active text-sm transition-colors"
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
            <div className="pt-4 border-t border-border">
              <button
                onClick={() => setShowSchedulePreview(!showSchedulePreview)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-[var(--theme-primary)] text-sm font-medium">
                  {t('workouts:create.scheduling.sessionsToCreate', { count: previewDates.length })}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-muted transition-transform ${showSchedulePreview ? 'rotate-180' : ''}`}
                />
              </button>
              {showSchedulePreview && (
                <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                  {previewDates.map((date) => (
                    <div key={date} className="text-muted text-sm py-1">
                      {formatDate(new Date(date))}
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
            <h2 className="text-lg font-semibold text-foreground font-['Outfit']">{t('workouts:create.exercisesSection')}</h2>
            <span className="text-sm text-subtle">{t('workouts:create.durationApprox', { count: getTotalDuration() })}</span>
          </div>

          {blocks.map((block, blockIndex) => (
            <div
              key={block.block_type}
              className="card overflow-hidden"
            >
              <button
                onClick={() => toggleBlockExpanded(blockIndex)}
                className="w-full p-4 flex items-center justify-between hover:bg-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-foreground font-medium">
                    {blockTypes.find((b) => b.value === block.block_type)?.label}
                  </span>
                  <span className="text-subtle text-sm">
                    {t('workouts:create.exerciseCount', { count: block.exercises.length })}
                  </span>
                </div>
                {block.expanded ? (
                  <ChevronUp size={18} className="text-muted" />
                ) : (
                  <ChevronDown size={18} className="text-muted" />
                )}
              </button>

              {block.expanded && (
                <div className="border-t border-border p-4 space-y-3">
                  {block.exercises.map((exercise, exerciseIndex) => (
                    <div
                      key={exerciseIndex}
                      className="p-3 bg-hover rounded-xl space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveExercise(blockIndex, exerciseIndex, -1)}
                            disabled={exerciseIndex === 0}
                            className="p-1 hover:bg-active rounded disabled:opacity-30"
                          >
                            <ChevronUp size={14} className="text-muted" />
                          </button>
                          <button
                            onClick={() => moveExercise(blockIndex, exerciseIndex, 1)}
                            disabled={exerciseIndex === block.exercises.length - 1}
                            className="p-1 hover:bg-active rounded disabled:opacity-30"
                          >
                            <ChevronDown size={14} className="text-muted" />
                          </button>
                        </div>
                        {exercise.image_url && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-active flex-shrink-0">
                            <img
                              src={resolveExerciseMediaUrl(exercise.image_url) || exercise.image_url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                              onError={handleExerciseImageError}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-foreground font-medium">{exercise.name}</p>
                          {exercise.description && (
                            <p className="text-subtle text-xs truncate">{exercise.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeExercise(blockIndex, exerciseIndex)}
                          className="p-2 hover:bg-active rounded-lg text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {exercise.exercise_type === 'duration' ? (
                          <div>
                            <Label className="text-[10px] text-subtle uppercase">{t('workouts:create.durationSeconds')}</Label>
                            <Input
                              type="number"
                              value={exercise.duration || ''}
                              onChange={(e) =>
                                updateExercise(blockIndex, exerciseIndex, 'duration', parseInt(e.target.value) || 0)
                              }
                              className="h-10 mt-1 rounded-lg bg-surface-elevated border-border text-foreground text-center"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label className="text-[10px] text-subtle uppercase">{t('workouts:create.repsLabel')}</Label>
                            <Input
                              type="number"
                              value={exercise.reps || ''}
                              onChange={(e) =>
                                updateExercise(blockIndex, exerciseIndex, 'reps', parseInt(e.target.value) || 0)
                              }
                              className="h-10 mt-1 rounded-lg bg-surface-elevated border-border text-foreground text-center"
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-[10px] text-subtle uppercase">{t('workouts:create.restSeconds')}</Label>
                          <Input
                            type="number"
                            value={exercise.rest_after || ''}
                            onChange={(e) =>
                              updateExercise(blockIndex, exerciseIndex, 'rest_after', parseInt(e.target.value) || 0)
                            }
                            className="h-10 mt-1 rounded-lg bg-surface-elevated border-border text-foreground text-center"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() =>
                              updateExercise(blockIndex, exerciseIndex, 'tts_enabled', !exercise.tts_enabled)
                            }
                            className={`w-full h-10 rounded-lg text-sm transition-colors ${
                              exercise.tts_enabled
                                ? 'bg-[var(--theme-primary)] text-foreground'
                                : 'bg-hover text-subtle'
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
                        className="w-full border-dashed border-border-strong text-muted hover:text-foreground hover:border-border-strong"
                      >
                        <Plus size={18} className="mr-2" /> {t('workouts:create.addExercise')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.25rem)] flex-col gap-0 overflow-hidden border-border bg-surface-elevated p-0 sm:max-w-lg left-[50%] top-[max(0.75rem,3vh)] translate-x-[-50%] translate-y-0 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]">
                      <div className="shrink-0 space-y-3 border-b border-border px-5 pb-4 pt-5 pr-12">
                        <DialogHeader className="space-y-1 text-left">
                          <DialogTitle className="text-foreground">
                            {exerciseTab === 'create'
                              ? editingExerciseId
                                ? t('workouts:create.dialog.editExercise')
                                : t('workouts:create.dialog.createExercise')
                              : t('workouts:create.dialog.chooseExercise')}
                          </DialogTitle>
                        </DialogHeader>
                        {customCreationEnabled || editingExerciseId ? (
                          <div className="grid grid-cols-2 gap-2 rounded-xl bg-background p-1">
                            <button
                              type="button"
                              onClick={() => setExerciseTab('library')}
                              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                exerciseTab === 'library'
                                  ? 'bg-[var(--theme-primary)] text-foreground'
                                  : 'text-muted hover:bg-hover'
                              }`}
                            >
                              {t('workouts:create.dialog.library')}
                            </button>
                            {customCreationEnabled ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExerciseId(null);
                                  setNewExercise(DEFAULT_NEW_EXERCISE);
                                  setExerciseTab('create');
                                }}
                                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                  exerciseTab === 'create'
                                    ? 'bg-[var(--theme-primary)] text-foreground'
                                    : 'text-muted hover:bg-hover'
                                }`}
                              >
                                {t('workouts:create.dialog.newExercise')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="rounded-lg px-3 py-2 text-sm font-medium text-subtle"
                              >
                                {t('workouts:create.dialog.editExercise')}
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {exerciseTab === 'library' ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
                          <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={18} />
                            <Input
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder={t('workouts:create.searchPlaceholder')}
                              className="pl-10 h-12 rounded-xl bg-background border-border text-foreground"
                            />
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setFiltersOpen((v) => !v)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-hover"
                            >
                              {t('workouts:create.filters.toggle')}
                            </button>
                            {exerciseTotal > 0 ? (
                              <span className="text-xs text-subtle">
                                {t('workouts:create.exerciseCount', { count: exerciseTotal })}
                              </span>
                            ) : null}
                          </div>
                          {filtersOpen ? (
                            <div className="shrink-0 space-y-2 rounded-xl border border-border bg-background p-3">
                              <div className="flex flex-wrap gap-1.5">
                                {EXERCISE_FILTER_PRESETS.sports.map((opt) => (
                                  <button
                                    key={`sport-${opt.value || 'all'}`}
                                    type="button"
                                    onClick={() => setSportFilter(opt.value)}
                                    className={`rounded-lg px-2.5 py-1 text-xs ${
                                      sportFilter === opt.value
                                        ? 'bg-[var(--theme-primary)] text-foreground'
                                        : 'bg-hover text-muted'
                                    }`}
                                  >
                                    {t(opt.labelKey)}
                                  </button>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {EXERCISE_FILTER_PRESETS.equipment.map((opt) => (
                                  <button
                                    key={`eq-${opt.value || 'all'}`}
                                    type="button"
                                    onClick={() => setEquipmentFilter(opt.value)}
                                    className={`rounded-lg px-2.5 py-1 text-xs ${
                                      equipmentFilter === opt.value
                                        ? 'bg-[var(--theme-primary)] text-foreground'
                                        : 'bg-hover text-muted'
                                    }`}
                                  >
                                    {t(opt.labelKey)}
                                  </button>
                                ))}
                              </div>
                              <Input
                                value={muscleFilter}
                                onChange={(e) => setMuscleFilter(e.target.value)}
                                placeholder={t('workouts:create.filters.musclePlaceholder')}
                                className="h-9 rounded-lg bg-surface-elevated border-border text-foreground text-sm"
                              />
                            </div>
                          ) : null}
                          <div
                            ref={exerciseListRef}
                            onScroll={onExerciseListScroll}
                            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
                          >
                              {exerciseLibraryLoading && exercises.length === 0 ? (
                                <div className="flex items-center justify-center py-10 text-subtle">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {t('workouts:create.loadingExercises')}
                                </div>
                              ) : filteredExercises.map((exercise) => (
                                <div
                                  key={exercise.id}
                                  className="flex items-stretch gap-1 rounded-xl bg-hover hover:bg-active transition-colors"
                                >
                                  <button
                                    type="button"
                                    onClick={() => addExerciseToBlock(exercise)}
                                    className="flex-1 min-w-0 p-3 text-left flex items-center gap-3 rounded-xl"
                                  >
                                    <ExerciseMediaThumb
                                      src={exercise.image_url}
                                      className="w-16 h-16"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-foreground font-medium truncate">{exercise.name}</p>
                                      {exercise.description ? (
                                        <p className="text-subtle text-sm line-clamp-2">{exercise.description}</p>
                                      ) : null}
                                      <p className="text-subtle text-xs mt-0.5 truncate">
                                        {exerciseSecondaryLabel(exercise) || (
                                          <>
                                            <span className="capitalize">{exercise.category}</span>
                                            <span> · </span>
                                            {exercise.exercise_type === 'duration' ? (
                                              <span className="inline-flex items-center gap-1">
                                                <Clock size={12} /> {exercise.default_duration}s
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1">
                                                <Hash size={12} /> {exercise.default_reps} {t('workouts:create.repsShort')}
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  </button>
                                  {!exercise.is_system ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title={t('common:actions.edit')}
                                      className="shrink-0 self-center mr-1 h-10 w-10 rounded-lg text-muted hover:text-foreground hover:bg-active"
                                      onClick={(e) => startEditExercise(exercise, e)}
                                    >
                                      <Pencil size={18} />
                                    </Button>
                                  ) : null}
                                </div>
                              ))}
                              {exerciseLoadingMore ? (
                                <div className="flex justify-center py-3 text-subtle text-sm">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {t('workouts:create.loadingMore')}
                                </div>
                              ) : null}
                              {!exerciseLibraryLoading && filteredExercises.length === 0 && (
                                <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-subtle">
                                  {t('workouts:create.noExercisesFound')}
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
                              <Label className="text-muted text-sm">{t('workouts:create.exerciseForm.name')} *</Label>
                              <Input
                                value={newExercise.name}
                                onChange={(e) => updateNewExerciseField('name', e.target.value)}
                                placeholder={t('workouts:create.exerciseForm.namePlaceholder')}
                                className="mt-2 h-12 rounded-xl bg-background border-border text-foreground"
                              />
                            </div>
                            <div>
                              <Label className="text-muted text-sm">{t('workouts:create.exerciseForm.description')}</Label>
                              <Textarea
                                value={newExercise.description}
                                onChange={(e) => updateNewExerciseField('description', e.target.value)}
                                placeholder={t('workouts:create.exerciseForm.descriptionPlaceholder')}
                                className="mt-2 rounded-xl bg-background border-border text-foreground min-h-[72px]"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-muted text-sm">{t('workouts:create.exerciseForm.category')}</Label>
                                <Input
                                  value={newExercise.category}
                                  onChange={(e) => updateNewExerciseField('category', e.target.value)}
                                  placeholder={t('workouts:create.exerciseForm.categoryPlaceholder')}
                                  className="mt-2 h-12 rounded-xl bg-background border-border text-foreground"
                                />
                              </div>
                              <div>
                                <Label className="text-muted text-sm">{t('workouts:create.exerciseForm.type')}</Label>
                                <Select
                                  value={newExercise.exercise_type}
                                  onValueChange={(value) => updateNewExerciseField('exercise_type', value)}
                                >
                                  <SelectTrigger className="mt-2 h-12 rounded-xl bg-background border-border text-foreground">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-surface-elevated border-border">
                                    <SelectItem value="reps" className="text-foreground">{t('workouts:create.exerciseForm.typeReps')}</SelectItem>
                                    <SelectItem value="duration" className="text-foreground">{t('workouts:create.exerciseForm.typeDuration')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {newExercise.exercise_type === 'duration' ? (
                                <div>
                                  <Label className="text-muted text-sm">{t('workouts:create.exerciseForm.defaultDuration')} *</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={newExercise.default_duration}
                                    onChange={(e) => updateNewExerciseField('default_duration', e.target.value)}
                                    className="mt-2 h-12 rounded-xl bg-background border-border text-foreground"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <Label className="text-muted text-sm">{t('workouts:create.exerciseForm.defaultReps')} *</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={newExercise.default_reps}
                                    onChange={(e) => updateNewExerciseField('default_reps', e.target.value)}
                                    className="mt-2 h-12 rounded-xl bg-background border-border text-foreground"
                                  />
                                </div>
                              )}
                              <div>
                                <Label className="text-muted text-sm">{t('workouts:create.exerciseForm.restSeconds')}</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={newExercise.default_rest}
                                  onChange={(e) => updateNewExerciseField('default_rest', e.target.value)}
                                  className="mt-2 h-12 rounded-xl bg-background border-border text-foreground"
                                />
                              </div>
                            </div>
                            <div className="rounded-xl border border-border bg-background p-3">
                              <Label className="text-muted text-sm font-medium">{t('workouts:create.exerciseForm.mediaOptional')}</Label>
                              <input
                                ref={newExerciseGifInputRef}
                                type="file"
                                accept="image/gif,.gif"
                                className="sr-only"
                                onChange={handleNewExerciseGifFile}
                              />
                              {newExercise.image_url.startsWith('data:') ? (
                                <div className="mt-3 flex gap-3">
                                  <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                                    <img
                                      src={newExercise.image_url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                                    <p className="text-xs text-muted leading-snug">
                                      {t('workouts:create.exerciseForm.gifEmbedded', { maxMb: maxGifMb })}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => newExerciseGifInputRef.current?.click()}
                                        className="h-9 shrink-0 rounded-lg border-border bg-hover px-3 text-foreground hover:bg-active"
                                      >
                                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                                        {t('workouts:create.exerciseForm.replace')}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => updateNewExerciseField('image_url', '')}
                                        className="h-9 shrink-0 rounded-lg border-border bg-transparent px-3 text-muted hover:bg-hover hover:text-foreground"
                                      >
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                        {t('workouts:create.exerciseForm.remove')}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  <Input
                                    value={newExercise.image_url}
                                    onChange={(e) => updateNewExerciseField('image_url', e.target.value)}
                                    placeholder={t('workouts:create.exerciseForm.urlPlaceholder')}
                                    className="h-11 rounded-lg bg-surface-elevated border-border text-foreground text-sm"
                                  />
                                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-subtle">
                                    <span className="h-px flex-1 bg-active" />
                                    {t('workouts:create.exerciseForm.orFile')}
                                    <span className="h-px flex-1 bg-active" />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => newExerciseGifInputRef.current?.click()}
                                    className="h-10 w-full rounded-lg border-border bg-hover text-sm text-foreground hover:bg-active"
                                  >
                                    <Upload className="mr-2 h-4 w-4 shrink-0" />
                                    {t('workouts:create.exerciseForm.chooseGif')}
                                  </Button>
                                </div>
                              )}
                              <p className="mt-2 text-[11px] leading-relaxed text-subtle">
                                {t('workouts:create.exerciseForm.mediaHint')}
                              </p>
                            </div>
                            </form>
                          </div>
                          <div className="shrink-0 space-y-2 border-t border-border bg-surface px-5 py-4">
                            {editingExerciseId && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setEditingExerciseId(null);
                                  setNewExercise(DEFAULT_NEW_EXERCISE);
                                  setExerciseTab('library');
                                }}
                                className="h-11 w-full rounded-xl border-border bg-hover text-muted hover:bg-active hover:text-foreground"
                              >
                                {t('workouts:create.cancelEdit')}
                              </Button>
                            )}
                            <Button
                              type="submit"
                              form="create-exercise-form"
                              disabled={creatingExercise}
                              className="h-12 w-full rounded-xl text-foreground btn-primary"
                            >
                              {creatingExercise ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : editingExerciseId ? (
                                t('workouts:create.save')
                              ) : (
                                t('workouts:create.createAndAdd')
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
            className="w-full h-14 rounded-2xl font-bold text-foreground btn-primary"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {previewDates.length > 1
                  ? t('workouts:create.scheduleMany', { count: previewDates.length })
                  : t('workouts:create.scheduleOne')}
              </>
            )}
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setAbandonDialogOpen(true)}
              disabled={saving}
              data-testid="abandon-workout-btn"
              className="flex-1 h-12 rounded-2xl bg-hover border-border text-foreground"
            >
              {isEditMode && editingDraft ? t('workouts:create.draftDialogs.abandonDraft') : t('workouts:create.draftDialogs.abandonCreate')}
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAsTemplate}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-hover border-border text-foreground"
            >
              <Copy size={18} className="mr-2" />
              <span className="sm:hidden">{t('workouts:create.saveAsTemplateShort')}</span>
              <span className="hidden sm:inline">{t('workouts:create.saveAsTemplateLong')}</span>
            </Button>
          </div>
        </div>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDraftDialogOpen} onOpenChange={setDeleteDraftDialogOpen}>
        <AlertDialogContent className="border-border bg-surface-elevated text-foreground sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('workouts:create.draftDialogs.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {t('workouts:create.draftDialogs.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-border bg-hover text-foreground hover:bg-active">
              {t('common:actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteDraft(draftToDelete?.id);
              }}
              disabled={deletingDraft}
              className="bg-red-600 text-foreground hover:bg-red-700 focus:ring-red-600"
            >
              {deletingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common:actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={abandonDialogOpen} onOpenChange={setAbandonDialogOpen}>
        <AlertDialogContent className="border-border bg-surface-elevated text-foreground sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('workouts:create.draftDialogs.abandonTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {t('workouts:create.draftDialogs.abandonDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogCancel className="w-full border-border bg-hover text-foreground hover:bg-active">
              {isEditMode && editingDraft ? t('workouts:create.draftDialogs.continue') : t('workouts:create.draftDialogs.continueEditing')}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl border-border text-foreground"
              disabled={saving}
              onClick={handleAbandonSaveDraft}
            >
              {isEditMode && editingDraft ? t('workouts:create.draftDialogs.keepDraft') : t('workouts:create.draftDialogs.saveDraft')}
            </Button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleAbandonDelete();
              }}
              className="w-full bg-red-600 text-foreground hover:bg-red-700 focus:ring-red-600"
            >
              {isEditMode && editingDraft ? t('workouts:create.draftDialogs.deletePermanently') : t('workouts:create.draftDialogs.discardDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!templatePendingDelete}
        onOpenChange={(open) => {
          if (!open) setTemplatePendingDelete(null);
        }}
      >
        <AlertDialogContent className="border-border bg-surface-elevated text-foreground sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('workouts:create.templateDialog.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {templatePendingDelete
                ? t('workouts:create.templateDialog.deleteDesc', { title: templatePendingDelete.title })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-border bg-hover text-foreground hover:bg-active">
              {t('common:actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteTemplate();
              }}
              disabled={deletingTemplate}
              className="bg-red-600 text-foreground hover:bg-red-700 focus:ring-red-600"
            >
              {deletingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common:actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
