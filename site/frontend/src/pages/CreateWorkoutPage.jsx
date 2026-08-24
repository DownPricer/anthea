import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, exercisesApi, templatesApi, heroChallengesApi, formatApiError } from '../lib/api';
import {
  getActivityPresetsForDiscovery,
  loadCachedActivityPresets,
} from '../lib/activities/activityPresetSearch';
import {
  buildActivityExerciseFromPreset,
  isTrackedActivityExercise,
  getActivityTrackingMode,
} from '../lib/activities/workoutActivityExercise';
import { ActivityPresetSearchCard } from '../components/activities/ActivityPresetSearchCard';
import { sanitizeExerciseForApi, handleExerciseImageError } from '../lib/exerciseMedia';
import { resolveExerciseMediaUrl } from '../lib/exerciseMedia';
import {
  createExerciseSearchController,
  EXERCISE_FILTER_PRESETS,
} from '../lib/exerciseSearch';
import {
  collectRecentExercises,
  mergeRecentWithCatalog,
} from '../lib/recentExercises';
import {
  ExerciseMediaThumb,
  exerciseSecondaryLabel,
} from '../components/exercises/ExerciseMediaThumb';
import {
  getLocalizedExerciseField,
  buildExerciseNameI18nSnapshot,
} from '../lib/exerciseLocale';
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
  Library,
} from 'lucide-react';
import { format, addDays, addWeeks, startOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { HeroChallengeCard } from '../components/hero/HeroChallengeCard';
import { HeroThemePattern } from '../components/hero/HeroThemePattern';
import { fetchHeroCatalog } from '../lib/heroChallenges';
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
  const { t, i18n } = useTranslation(['workouts', 'common', 'challenges']);
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
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [templatesModalTab, setTemplatesModalTab] = useState('mine');
  const [heroChallenges, setHeroChallenges] = useState([]);
  const [heroFilter, setHeroFilter] = useState('all');
  const [heroDetail, setHeroDetail] = useState(null);
  const [heroChallengeId, setHeroChallengeId] = useState(null);
  const [templatePendingDelete, setTemplatePendingDelete] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateNamePromptOpen, setTemplateNamePromptOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
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
  const [activityPresetCatalog, setActivityPresetCatalog] = useState([]);
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
    navigate('/workouts');
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
    navigate('/workouts');
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
        if (w.source_type === 'hero_challenge') {
          setHeroChallengeId(w.hero_challenge_id || null);
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
        limit: 10,
        locale,
      };
      const data = await exerciseSearchRef.current.search(params, {
        debounceMs: 0,
      });
      if (!data) return;
      let items = data.items || [];
      // Ouverture sans recherche : prioriser les exercices récents déjà en mémoire.
      if (!append && page === 1 && !debouncedQuery && !sportFilter && !equipmentFilter && !muscleFilter) {
        const recent = collectRecentExercises({ blocks, templates, limit: 10 });
        items = mergeRecentWithCatalog(recent, items, 10);
      }
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
    const locale = (i18n?.language || 'fr').split('-')[0];
    const localizedName = getLocalizedExerciseField(exercise, 'name', locale);
    const localizedDescription = getLocalizedExerciseField(exercise, 'description', locale);

    const newExercise = {
      exercise_id: exercise.id,
      name: localizedName,
      description: localizedDescription,
      exercise_type: exercise.exercise_type,
      duration: exercise.default_duration,
      reps: exercise.default_reps,
      rest_after: exercise.default_rest || 30,
      order: blocks[currentBlockIndex].exercises.length,
      tts_enabled: true,
      image_url: exercise.image_url,
      exercise_name_snapshot: localizedName,
      exercise_name_i18n_snapshot: buildExerciseNameI18nSnapshot(exercise),
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

  const handleActivityPresetSelect = (preset) => {
    if (currentBlockIndex === null) return;
    const locale = (i18n?.language || 'fr').split('-')[0];
    const newExercise = buildActivityExerciseFromPreset(preset, {
      locale,
      order: blocks[currentBlockIndex].exercises.length,
    });

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
      setTemplatesModalOpen(false);
    } catch (error) {
      toast.error(t('workouts:create.toast.templateLoadError'));
    }
  };

  const applyHeroChallenge = (challenge) => {
    if (!challenge?.playable) {
      setHeroDetail(challenge);
      return;
    }
    setHeroChallengeId(challenge.id);
    setTitle(challenge.title);
    setDescription(challenge.description || '');
    const blocks = [
      {
        block_type: 'main',
        expanded: true,
        exercises: [...(challenge.exercises || []), ...(challenge.coda_exercises || [])].map((ex, order) => ({
          exercise_id: ex.exercise_id,
          name: ex.name_i18n?.[(i18n.language || 'fr').split('-')[0]] || ex.name_i18n?.fr,
          description: ex.intensity_hint || ex.notes || null,
          exercise_type: ex.exercise_type || 'reps',
          duration: ex.duration,
          reps: ex.reps,
          rest_after: ex.rest_after || 30,
          order,
          tts_enabled: true,
          image_url: ex.image_url || ex.media_snapshot || null,
          exercise_name_snapshot: ex.name_i18n?.fr,
          exercise_name_i18n_snapshot: ex.name_i18n,
          sets: ex.sets,
          reps_scheme: ex.reps_scheme,
          intensity_hint: ex.intensity_hint,
          load: ex.load ?? null,
          per_side: ex.per_side,
          distance_yards: ex.distance_yards,
          distance_meters: ex.distance_meters,
          hero_open_series: ex.hero_open_series,
          unspecified: ex.unspecified,
        })),
      },
    ];
    setBlocks(blocks);
    setHeroDetail(null);
    setTemplatesModalOpen(false);
    toast.success(t('workouts:create.toast.templateLoaded'));
  };

  const openTemplatesModal = () => {
    setTemplatesModalOpen(true);
    fetchHeroCatalog(() => heroChallengesApi.list().then(({ data }) => data)).then((data) => {
      setHeroChallenges(data?.challenges || []);
    }).catch(() => {});
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
          hero_challenge_id: heroChallengeId || undefined,
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
          hero_challenge_id: heroChallengeId || undefined,
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
          hero_challenge_id: heroChallengeId || undefined,
          source_type: heroChallengeId ? 'hero_challenge' : undefined,
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

  const saveTemplateWithTitle = async (templateTitle) => {
    const name = (templateTitle || '').trim();
    if (!name) {
      toast.error(t('workouts:create.validation.sessionTitleRequired'));
      return;
    }
    if (savingTemplate) return;

    setSavingTemplate(true);
    try {
      const { data } = await templatesApi.create({
        title: name,
        description: description.trim(),
        difficulty,
        blocks: blocks.filter((b) => b.exercises.length > 0).map((b) => ({
          block_type: b.block_type,
          exercises: b.exercises,
        })),
      });
      setTemplates((prev) => [data, ...prev.filter((item) => item.id !== data.id)]);
      toast.success(t('workouts:create.toast.templateSaved'));
      setTemplateNamePromptOpen(false);
      setTemplateNameInput('');
    } catch (error) {
      toast.error(t('workouts:create.toast.templateSaveError'));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    const exerciseCount = blocks.reduce((n, b) => n + b.exercises.length, 0);
    if (exerciseCount === 0) {
      toast.error(t('workouts:create.validation.exerciseRequired'));
      return;
    }
    if (title.trim()) {
      await saveTemplateWithTitle(title.trim());
      return;
    }
    setTemplateNameInput('');
    setTemplateNamePromptOpen(true);
  };

  const filteredExercises = exercises;

  const hasExerciseFilters = Boolean(sportFilter || equipmentFilter || muscleFilter);
  const locale = (i18n?.language || 'fr').split('-')[0];

  const activityPresetResults = useMemo(
    () =>
      getActivityPresetsForDiscovery({
        query: debouncedQuery,
        locale,
        hasFilters: hasExerciseFilters,
        presets: activityPresetCatalog.length ? activityPresetCatalog : undefined,
      }),
    [debouncedQuery, locale, hasExerciseFilters, activityPresetCatalog],
  );

  const showActivityPopularSection = !debouncedQuery && !hasExerciseFilters && activityPresetResults.length > 0;
  const showActivitySearchSection = Boolean(debouncedQuery) && !hasExerciseFilters && activityPresetResults.length > 0;

  useEffect(() => {
    if (!exerciseDialogOpen) return;
    let cancelled = false;
    loadCachedActivityPresets({ locale }).then((presets) => {
      if (!cancelled) setActivityPresetCatalog(presets);
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseDialogOpen, locale]);

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
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 px-3 py-3 backdrop-blur-xl sm:px-5">
        <div className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-hover"
            aria-label={t('common:actions.back', { defaultValue: 'Retour' })}
          >
            <ArrowLeft size={22} className="text-foreground" />
          </button>
          <h1 className="min-w-0 truncate text-left text-lg font-semibold leading-none text-foreground font-['Outfit'] sm:text-xl">
            {isEditMode ? t('workouts:create.editTitle') : t('workouts:create.title')}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openTemplatesModal}
              disabled={saving}
              data-testid="open-templates-btn"
              aria-label={t('workouts:create.templates.openAria')}
              title={t('workouts:create.templates.openTooltip')}
              className="h-10 rounded-xl border-border px-3 text-foreground"
            >
              <Library size={16} className="shrink-0 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">{t('workouts:create.templates.saved')}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="h-10 rounded-xl border-border px-3 text-foreground"
              title={t('workouts:create.saveDraftTitle')}
              aria-label={t('workouts:create.saveDraftTitle')}
            >
              <Save size={16} className="shrink-0 sm:mr-2" />
              <span className="hidden sm:inline">{t('workouts:create.saveDraftTitle')}</span>
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
        <div className="space-y-6">
          <div className="space-y-6">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Label htmlFor="workout-time" className="text-muted text-sm">
              {t('workouts:create.timeOptional')}
            </Label>
            <div className="relative mt-2 w-full sm:w-44">
              <Clock
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <Input
                id="workout-time"
                type="time"
                data-testid="workout-time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="workout-time-input h-14 w-full rounded-xl border-border bg-surface-elevated pl-10 pr-3 text-foreground"
              />
            </div>
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
                      className="p-3 bg-hover rounded-xl space-y-3 w-full max-w-full min-w-0 overflow-hidden"
                      data-testid="workout-exercise-card"
                    >
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full max-w-full min-w-0">
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => moveExercise(blockIndex, exerciseIndex, -1)}
                            disabled={exerciseIndex === 0}
                            className="p-1 min-h-10 min-w-10 hover:bg-active rounded disabled:opacity-30 inline-flex items-center justify-center"
                          >
                            <ChevronUp size={14} className="text-muted" />
                          </button>
                          <button
                            onClick={() => moveExercise(blockIndex, exerciseIndex, 1)}
                            disabled={exerciseIndex === block.exercises.length - 1}
                            className="p-1 min-h-10 min-w-10 hover:bg-active rounded disabled:opacity-30 inline-flex items-center justify-center"
                          >
                            <ChevronDown size={14} className="text-muted" />
                          </button>
                        </div>
                        {exercise.image_url && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-active shrink-0">
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
                        <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                          <p className="text-foreground font-medium truncate max-w-full">
                            {exercise.icon ? (
                              <span className="mr-1.5" aria-hidden>{exercise.icon}</span>
                            ) : null}
                            {exercise.name}
                            {isTrackedActivityExercise(exercise) ? (
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-subtle">
                                {t(`workouts:create.activityMode.${getActivityTrackingMode(exercise)}`, {
                                  defaultValue: getActivityTrackingMode(exercise),
                                })}
                              </span>
                            ) : null}
                          </p>
                          {exercise.description && (
                            <p className="text-subtle text-xs line-clamp-2 break-words [overflow-wrap:anywhere]">
                              {exercise.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeExercise(blockIndex, exerciseIndex)}
                          className="p-2 min-h-10 min-w-10 hover:bg-active rounded-lg text-red-400 shrink-0 inline-flex items-center justify-center"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {isTrackedActivityExercise(exercise) ? (
                        <div className="space-y-2" data-testid="activity-exercise-config">
                          <details className="group">
                            <summary className="cursor-pointer text-xs text-subtle hover:text-muted list-none flex items-center gap-1">
                              {t('workouts:create.configureActivity', { defaultValue: 'Configurer' })}
                            </summary>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {(getActivityTrackingMode(exercise) === 'gps' ||
                                getActivityTrackingMode(exercise) === 'manual_distance' ||
                                getActivityTrackingMode(exercise) === 'timer') && (
                                <>
                                  <div>
                                    <Label className="text-[10px] text-subtle uppercase">
                                      {t('workouts:create.targetDuration', { defaultValue: 'Objectif (s)' })}
                                    </Label>
                                    <Input
                                      type="number"
                                      value={exercise.activity_config?.target_duration_seconds ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10) || null;
                                        updateExercise(blockIndex, exerciseIndex, 'activity_config', {
                                          ...(exercise.activity_config || {}),
                                          target_duration_seconds: val,
                                        });
                                      }}
                                      className="h-10 mt-1 rounded-lg bg-surface-elevated border-border text-foreground text-center"
                                      placeholder="—"
                                    />
                                  </div>
                                  {(getActivityTrackingMode(exercise) === 'gps' ||
                                    getActivityTrackingMode(exercise) === 'manual_distance') && (
                                    <div>
                                      <Label className="text-[10px] text-subtle uppercase">
                                        {t('workouts:create.targetDistance', { defaultValue: 'Distance (m)' })}
                                      </Label>
                                      <Input
                                        type="number"
                                        value={exercise.activity_config?.target_distance_meters ?? ''}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? null : parseFloat(e.target.value) || null;
                                          updateExercise(blockIndex, exerciseIndex, 'activity_config', {
                                            ...(exercise.activity_config || {}),
                                            target_distance_meters: val,
                                          });
                                        }}
                                        className="h-10 mt-1 rounded-lg bg-surface-elevated border-border text-foreground text-center"
                                        placeholder="—"
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                              {getActivityTrackingMode(exercise) === 'laps' && (
                                <div>
                                  <Label className="text-[10px] text-subtle uppercase">
                                    {t('workouts:create.poolLength', { defaultValue: 'Bassin (m)' })}
                                  </Label>
                                  <Input
                                    type="number"
                                    value={exercise.activity_config?.pool_length_meters ?? 25}
                                    onChange={(e) => {
                                      updateExercise(blockIndex, exerciseIndex, 'activity_config', {
                                        ...(exercise.activity_config || {}),
                                        pool_length_meters: parseFloat(e.target.value) || 25,
                                      });
                                    }}
                                    className="h-10 mt-1 rounded-lg bg-surface-elevated border-border text-foreground text-center"
                                  />
                                </div>
                              )}
                              {getActivityTrackingMode(exercise) === 'intervals' && (
                                <>
                                  <div>
                                    <Label className="text-[10px] text-subtle uppercase">
                                      {t('workouts:create.workSeconds', { defaultValue: 'Effort (s)' })}
                                    </Label>
                                    <Input
                                      type="number"
                                      value={exercise.activity_config?.interval_config?.work_seconds ?? 30}
                                      onChange={(e) => {
                                        updateExercise(blockIndex, exerciseIndex, 'activity_config', {
                                          ...(exercise.activity_config || {}),
                                          interval_config: {
                                            ...(exercise.activity_config?.interval_config || {}),
                                            work_seconds: parseInt(e.target.value, 10) || 30,
                                          },
                                        });
                                      }}
                                      className="h-10 mt-1 rounded-lg bg-surface-elevated border-border text-foreground text-center"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-subtle uppercase">
                                      {t('workouts:create.intervalRounds', { defaultValue: 'Répétitions' })}
                                    </Label>
                                    <Input
                                      type="number"
                                      value={exercise.activity_config?.interval_config?.rounds ?? 8}
                                      onChange={(e) => {
                                        updateExercise(blockIndex, exerciseIndex, 'activity_config', {
                                          ...(exercise.activity_config || {}),
                                          interval_config: {
                                            ...(exercise.activity_config?.interval_config || {}),
                                            rounds: parseInt(e.target.value, 10) || 8,
                                          },
                                        });
                                      }}
                                      className="h-10 mt-1 rounded-lg bg-surface-elevated border-border text-foreground text-center"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </details>
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
                      ) : (
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
                      )}
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
                          <DialogDescription className="sr-only">
                            {t('workouts:create.dialog.chooseExerciseDescription', {
                              defaultValue: 'Recherchez et ajoutez un exercice à votre séance.',
                            })}
                          </DialogDescription>
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
                            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 min-w-0 max-w-full"
                          >
                              {(showActivityPopularSection || showActivitySearchSection) ? (
                                <section className="space-y-2 min-w-0 max-w-full" data-testid="activity-preset-search-section">
                                  <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle px-1">
                                    {showActivityPopularSection
                                      ? t('workouts:create.activitySearch.popularSection')
                                      : t('workouts:create.activitySearch.activitiesSection')}
                                  </h3>
                                  <div className="space-y-2">
                                    {activityPresetResults.map((preset) => (
                                      <ActivityPresetSearchCard
                                        key={preset.id}
                                        preset={preset}
                                        onSelect={handleActivityPresetSelect}
                                        disabled={loading}
                                      />
                                    ))}
                                  </div>
                                </section>
                              ) : null}

                              <section className="space-y-2 min-w-0 max-w-full" data-testid="exercise-catalog-search-section">
                                {(showActivityPopularSection || showActivitySearchSection) ? (
                                  <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle px-1 pt-1">
                                    {t('workouts:create.activitySearch.exercisesSection')}
                                  </h3>
                                ) : null}
                              {exerciseLibraryLoading && exercises.length === 0 ? (
                                <div className="space-y-2" data-testid="exercise-library-skeletons">
                                  {Array.from({ length: 10 }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center gap-3 rounded-xl bg-hover p-3 animate-pulse"
                                    >
                                      <div className="w-16 h-16 rounded-lg bg-active shrink-0" />
                                      <div className="flex-1 min-w-0 space-y-2">
                                        <div className="h-4 w-2/3 rounded bg-active" />
                                        <div className="h-3 w-full rounded bg-active" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : filteredExercises.map((exercise) => (
                                <div
                                  key={exercise.id}
                                  className="flex flex-wrap sm:flex-nowrap items-stretch gap-1 rounded-xl bg-hover hover:bg-active transition-colors w-full max-w-full min-w-0 overflow-hidden"
                                  data-testid="exercise-library-card"
                                >
                                  <button
                                    type="button"
                                    onClick={() => addExerciseToBlock(exercise)}
                                    className="flex-1 min-w-0 max-w-full p-3 text-left flex items-center gap-3 rounded-xl overflow-hidden"
                                  >
                                    <ExerciseMediaThumb
                                      src={exercise.image_url}
                                      className="w-16 h-16 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                                      <p className="text-foreground font-medium truncate max-w-full">
                                        {getLocalizedExerciseField(exercise, 'name', i18n.language)}
                                        {exercise.source_kind === 'custom' || exercise.legacy_label ? (
                                          <span className="ml-2 text-[10px] uppercase tracking-wide text-subtle">
                                            {t('workouts:create.customBadge')}
                                          </span>
                                        ) : null}
                                      </p>
                                      {getLocalizedExerciseField(exercise, 'description', i18n.language) ? (
                                        <p className="text-subtle text-sm line-clamp-2 break-words [overflow-wrap:anywhere]">
                                          {getLocalizedExerciseField(exercise, 'description', i18n.language)}
                                        </p>
                                      ) : null}
                                      <p className="text-subtle text-xs mt-0.5 truncate max-w-full">
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
                              {!exerciseLibraryLoading && filteredExercises.length === 0 && !showActivitySearchSection && !showActivityPopularSection && (
                                <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-subtle">
                                  {t('workouts:create.noExercisesFound')}
                                </div>
                              )}
                              </section>
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
          <div className="flex gap-3">
            <Button
              onClick={() => handleSave(false)}
              disabled={saving || previewDates.length === 0}
              data-testid="save-workout-btn"
              className="flex-1 h-14 rounded-2xl font-bold text-foreground btn-primary"
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
          </div>

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
              disabled={saving || savingTemplate}
              className="flex-1 h-12 rounded-2xl bg-hover border-border text-foreground"
            >
              {savingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Copy size={18} className="mr-2" />
                  <span className="sm:hidden">{t('workouts:create.saveAsTemplateShort')}</span>
                  <span className="hidden sm:inline">{t('workouts:create.saveAsTemplateLong')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
          </div>
        </div>
      </div>

      <Dialog open={templatesModalOpen} onOpenChange={setTemplatesModalOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-surface-elevated p-0 text-foreground sm:max-h-[min(88vh,760px)] sm:max-w-3xl sm:rounded-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5 pr-12 text-left sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold font-['Outfit']">
              <Library size={20} className="text-[var(--theme-primary)]" aria-hidden="true" />
              {t('workouts:create.templates.saved')}
            </DialogTitle>
            <DialogDescription className="text-muted">
              {t('workouts:create.templates.modalHint')}
            </DialogDescription>
          </DialogHeader>
          <Tabs value={templatesModalTab} onValueChange={setTemplatesModalTab} className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-4 pt-4 sm:px-6">
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-background p-1">
              <TabsTrigger value="mine" data-testid="templates-tab-mine">
                {t('workouts:create.templates.tabMine')}
              </TabsTrigger>
              <TabsTrigger value="hero" data-testid="templates-tab-hero">
                {t('workouts:create.templates.tabHero')}
              </TabsTrigger>
            </TabsList>
            </div>
            <TabsContent value="mine" className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4 sm:px-6">
          <div className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-subtle py-4 text-center">
                {t('workouts:create.templates.empty')}
              </p>
            ) : (
              templates.map((template) => {
                const exerciseCount = template.blocks
                  ? template.blocks.reduce((n, b) => n + (b.exercises?.length || 0), 0)
                  : null;
                return (
                  <div
                    key={template.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:p-4"
                    data-testid={`template-item-${template.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground">{template.title}</p>
                        {template.is_system ? (
                          <span className="shrink-0 rounded-full bg-[var(--theme-primary)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-primary)]">
                            Anthea
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-subtle">
                        {template.difficulty ? (
                          <span>
                            {t(`workouts:create.difficulties.${template.difficulty}`, {
                              defaultValue: template.difficulty,
                            })}
                          </span>
                        ) : null}
                        {exerciseCount != null ? (
                          <span>{t('workouts:create.templates.exerciseCount', { count: exerciseCount })}</span>
                        ) : null}
                        {template.updated_at ? (
                          <span>{formatShortDate(parseISO(template.updated_at))}</span>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => loadFromTemplate(template)}
                      className="shrink-0 rounded-xl border-border bg-hover text-foreground hover:bg-active"
                    >
                      {t('workouts:create.useTemplate')}
                    </Button>
                    {!template.is_system ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title={t('workouts:create.deleteTemplateTitle')}
                        aria-label={t('workouts:create.deleteTemplateTitle')}
                        className="col-start-2 row-start-2 h-9 w-9 shrink-0 justify-self-end text-subtle hover:bg-red-500/15 hover:text-red-400 sm:col-start-auto sm:row-start-auto"
                        onClick={() => setTemplatePendingDelete(template)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <div className="sticky bottom-0 mt-4 border-t border-border bg-surface-elevated pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate}
              className="w-full h-11 rounded-xl border-border bg-hover text-foreground"
            >
              {savingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Copy size={16} className="mr-2" />
                  {t('workouts:create.saveAsTemplateLong')}
                </>
              )}
            </Button>
          </div>
            </TabsContent>
            <TabsContent value="hero" className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4 sm:px-6">
              <div className="mb-4 flex flex-wrap gap-2">
                {['all', 'marvel', 'dc'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setHeroFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs ${heroFilter === f ? 'bg-[var(--theme-primary)] text-foreground' : 'bg-hover text-muted'}`}
                  >
                    {t(`challenges:hero.filters.${f}`)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {heroChallenges
                  .filter((c) => heroFilter === 'all' || c.universe === heroFilter)
                  .map((challenge) => (
                    <HeroChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      onSelect={applyHeroChallenge}
                    />
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(heroDetail)} onOpenChange={(open) => !open && setHeroDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-surface-elevated text-foreground sm:max-w-lg">
          {heroDetail ? (
            <>
              <div className="relative overflow-hidden rounded-2xl min-h-[120px] mb-3">
                <HeroThemePattern themeId={heroDetail.visual_theme?.id} />
                <div className="relative p-4 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">{heroDetail.title}</DialogTitle>
                    <DialogDescription className="text-white/80">{heroDetail.subtitle}</DialogDescription>
                  </DialogHeader>
                </div>
              </div>
              <p className="text-sm text-muted">{heroDetail.description}</p>
              {heroDetail.challenge_type === 'program_reference' ? (
                <p className="text-sm text-foreground mt-2">{t('challenges:hero.incompleteProgram')}</p>
              ) : null}
              {heroDetail.challenge_type === 'strength_reference' ? (
                <p className="text-sm text-foreground mt-2">{t('challenges:hero.strengthDisclaimer')}</p>
              ) : null}
              {(heroDetail.strength_references || []).map((ref) => (
                <p key={ref.movement} className="text-sm text-muted mt-1">
                  {ref.movement}
                  {ref.value_kg ? ` · ${ref.value_kg} kg / ${ref.value_lb} lb` : ''}
                  {ref.note ? ` — ${ref.note}` : ''}
                </p>
              ))}
              {(heroDetail.related_references || []).map((ref) => (
                <div key={ref.id} className="mt-3 rounded-xl border border-border p-3">
                  <p className="font-medium text-foreground">{ref.title}</p>
                  <p className="text-xs text-muted">{t('challenges:hero.actorRefDisclaimer')}</p>
                  {(ref.lifts || []).map((lift) => (
                    <p key={lift.movement} className="text-sm text-muted">
                      {lift.movement}
                      {lift.scheme ? ` ${lift.scheme}` : ''}
                      {lift.value_kg ? ` · ${lift.value_kg} kg / ${lift.value_lb} lb` : ''}
                    </p>
                  ))}
                  {ref.source?.url ? (
                    <a href={ref.source.url} target="_blank" rel="noopener noreferrer" className="text-sm underline mt-1 inline-block">
                      {ref.source.label}
                    </a>
                  ) : null}
                </div>
              ))}
              <div className="mt-4">
                <p className="text-sm font-medium">{t('challenges:hero.source')}</p>
                {heroDetail.source?.url ? (
                  <a
                    href={heroDetail.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline"
                  >
                    {heroDetail.source.label || heroDetail.source.url}
                  </a>
                ) : (
                  <p className="text-sm text-muted">—</p>
                )}
                <p className="text-xs text-muted mt-2">
                  {t('challenges:hero.unofficial', { actor: heroDetail.actor_name })}
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={templateNamePromptOpen} onOpenChange={setTemplateNamePromptOpen}>
        <DialogContent className="border-border bg-surface-elevated text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('workouts:create.templates.namePromptTitle')}</DialogTitle>
            <DialogDescription className="text-muted">
              {t('workouts:create.templates.namePromptDesc')}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={templateNameInput}
            onChange={(e) => setTemplateNameInput(e.target.value)}
            placeholder={t('workouts:create.templates.namePlaceholder')}
            className="h-12 rounded-xl bg-background border-border text-foreground"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplateNamePromptOpen(false)}
              className="border-border bg-hover text-foreground"
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => saveTemplateWithTitle(templateNameInput)}
              disabled={savingTemplate || !templateNameInput.trim()}
              className="btn-primary text-foreground"
            >
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common:actions.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
