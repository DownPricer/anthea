/**
 * Page de démarrage d'activité
 * Section Activités (presets canoniques) + exercices compatibles catalogue
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Play, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ActivityRecoveryBanner } from '../components/activities/ActivityRecoveryBanner';
import { TRACKING_MODES } from '../lib/activities/constants';
import {
  getLocalizedStartPagePresets,
  filterReliableCompatibleExercises,
  getPresetById,
  localizePreset,
} from '../lib/activities/activityPresets';
import { activitiesApi, formatApiError } from '../lib/api';
import { getActiveActivity, clearActiveActivity } from '../lib/activities/activityStore';
import { toast } from 'sonner';

export function StartActivityPage() {
  const { t, i18n } = useTranslation(['activity', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const presetAutoStartedRef = useRef(false);

  const [step, setStep] = useState('select');
  const [selectedType, setSelectedType] = useState(null);
  const [activityName, setActivityName] = useState('');
  const [poolLength, setPoolLength] = useState(25);
  const [intervalsConfig, setIntervalsConfig] = useState({ work: 30, rest: 15, rounds: 8 });
  const [loading, setLoading] = useState(false);
  const [existingActivity, setExistingActivity] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [compatibleExercises, setCompatibleExercises] = useState([]);

  const activityPresets = useMemo(
    () => getLocalizedStartPagePresets(i18n.language),
    [i18n.language],
  );

  useEffect(() => {
    checkExistingActivity();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCompatible = async () => {
      try {
        const { data } = await activitiesApi.getCompatibleExercises({
          locale: i18n.language,
          limit: 24,
        });
        if (!cancelled) {
          setCompatibleExercises(filterReliableCompatibleExercises(data?.exercises || []));
        }
      } catch {
        if (!cancelled) setCompatibleExercises([]);
      }
    };
    loadCompatible();
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  const checkExistingActivity = async () => {
    try {
      const local = await getActiveActivity();
      if (local) {
        setExistingActivity(local);
        setCheckingExisting(false);
        return;
      }

      const { data } = await activitiesApi.getCurrent();
      if (data?.activity) {
        setExistingActivity(data.activity);
      }
    } catch {
      // Pas d'activité en cours
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setActivityName(type.label || t(type.labelKey, { defaultValue: type.label }));

    if (
      type.mode === TRACKING_MODES.TIMER ||
      type.mode === TRACKING_MODES.MANUAL_DISTANCE ||
      type.mode === TRACKING_MODES.GPS
    ) {
      handleStartActivity(type, {});
    } else {
      setStep('configure');
    }
  };

  const handleStartActivity = useCallback(async (type, config, { nameOverride } = {}) => {
    setLoading(true);

    try {
      const displayName = nameOverride || activityName || type.label || t(type.labelKey, { defaultValue: type.label });
      const payload = {
        tracking_mode: type.mode,
        activity_kind: type.kind,
        exercise_id: type.exerciseId || undefined,
        exercise_name_snapshot: displayName,
        pool_length_meters: config.pool_length_meters,
        interval_config: config.interval_config,
      };

      const { data } = await activitiesApi.start(payload);
      const started = data?.activity || data;
      navigate(`/activity/${started.id}/live`);
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error(t('activity:errors.alreadyActive'));
        await checkExistingActivity();
      } else {
        toast.error(formatApiError(error));
      }
    } finally {
      setLoading(false);
    }
  }, [activityName, navigate, t]);

  useEffect(() => {
    const presetId = searchParams.get('preset');
    if (!presetId || checkingExisting || existingActivity || presetAutoStartedRef.current) return;
    const preset = getPresetById(presetId);
    if (!preset) return;

    presetAutoStartedRef.current = true;
    setSearchParams({}, { replace: true });

    const localized = localizePreset(preset, i18n.language);
    setSelectedType(localized);
    setActivityName(localized.label);

    if (
      localized.mode === TRACKING_MODES.TIMER ||
      localized.mode === TRACKING_MODES.MANUAL_DISTANCE ||
      localized.mode === TRACKING_MODES.GPS
    ) {
      handleStartActivity(localized, {}, { nameOverride: localized.label });
    } else {
      setStep('configure');
    }
  }, [checkingExisting, existingActivity, searchParams, setSearchParams, i18n.language, handleStartActivity]);

  const handleCompatibleExerciseSelect = (exercise) => {
    handleTypeSelect({
      id: exercise.id,
      exerciseId: exercise.id,
      kind: exercise.activity_kind || 'other',
      mode: exercise.activity_tracking_mode,
      label: exercise.name,
      labelKey: null,
      icon: '💪',
      source: 'catalog',
    });
  };

  const handleConfigure = () => {
    if (!selectedType) return;

    let config = {};

    if (selectedType.mode === TRACKING_MODES.LAPS) {
      config.pool_length_meters = poolLength;
    } else if (selectedType.mode === TRACKING_MODES.INTERVALS) {
      config.interval_config = {
        warmup_seconds: 0,
        work_seconds: intervalsConfig.work,
        rest_seconds: intervalsConfig.rest,
        repetitions: intervalsConfig.rounds,
        cooldown_seconds: 0,
      };
    }

    handleStartActivity(selectedType, config);
  };

  const handleResumeExisting = () => {
    if (existingActivity?.scheduled_workout_id) {
      navigate(`/player/${existingActivity.scheduled_workout_id}`);
      return;
    }
    if (existingActivity?.id) {
      navigate(`/activity/${existingActivity.id}/live`);
    }
  };

  const handleCompleteExisting = () => {
    if (existingActivity?.scheduled_workout_id) {
      navigate(`/player/${existingActivity.scheduled_workout_id}`);
      return;
    }
    if (existingActivity?.id) {
      navigate(`/activity/${existingActivity.id}/summary`);
    }
  };

  const handleDiscardExisting = async () => {
    if (!window.confirm(t('activity:recovery.confirmDiscard'))) return;

    try {
      if (existingActivity?.id) {
        await activitiesApi.discard(existingActivity.id);
      }
      await clearActiveActivity();
      setExistingActivity(null);
      toast.success(t('activity:recovery.discarded'));
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="max-w-2xl mx-auto p-5 pb-20 w-full min-w-0">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => (step === 'configure' ? setStep('select') : navigate(-1))}
            className="p-2 hover:bg-active rounded-full transition-colors"
          >
            <ArrowLeft className="text-foreground" size={24} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {step === 'select' ? t('activity:start.title') : t('activity:start.configure')}
          </h1>
        </div>

        {existingActivity && (
          <ActivityRecoveryBanner
            activityName={existingActivity.exercise_name_snapshot || existingActivity.name}
            onResume={handleResumeExisting}
            onComplete={handleCompleteExisting}
            onDiscard={handleDiscardExisting}
            className="mb-6"
          />
        )}

        {step === 'select' && (
          <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={20} />
              <div className="flex-1 text-sm text-blue-400 min-w-0">
                <p className="font-medium mb-1">{t('activity:gps.webWarningTitle')}</p>
                <p className="text-blue-400/80 break-words">
                  {t('activity:gps.webWarning', { productName: 'FitMatch' })}
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                {t('activity:start.activitiesSection')}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {activityPresets.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleTypeSelect(type)}
                    disabled={loading}
                    className="p-4 rounded-xl border border-border bg-surface hover:bg-hover transition-colors text-left min-w-0"
                  >
                    <div className="text-3xl mb-2">{type.icon}</div>
                    <p className="text-foreground font-medium text-sm break-words">
                      {type.label}
                    </p>
                    <p className="text-subtle text-xs mt-1 break-words">
                      {t(`activity:modes.${type.mode}`, { defaultValue: type.mode })}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {compatibleExercises.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground mb-3">
                  {t('activity:start.compatibleSection')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {compatibleExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => handleCompatibleExerciseSelect(exercise)}
                      disabled={loading}
                      className="p-3 rounded-lg border border-border bg-surface hover:bg-hover transition-colors text-left min-w-0"
                    >
                      <p className="text-foreground font-medium text-sm break-words truncate">
                        {exercise.name}
                      </p>
                      <p className="text-subtle text-xs mt-1">
                        {t(`activity:modes.${exercise.activity_tracking_mode}`, {
                          defaultValue: exercise.activity_tracking_mode,
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {step === 'configure' && selectedType && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('activity:start.activityName')}
              </label>
              <Input
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder={selectedType.label || t(selectedType.labelKey, { defaultValue: selectedType.label })}
                className="w-full"
              />
            </div>

            {selectedType.mode === TRACKING_MODES.LAPS && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('activity:start.poolLength')}
                </label>
                <div className="flex gap-2">
                  {[25, 50].map((length) => (
                    <button
                      key={length}
                      type="button"
                      onClick={() => setPoolLength(length)}
                      className={`flex-1 p-3 rounded-lg border transition-colors ${
                        poolLength === length
                          ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 text-foreground'
                          : 'border-border bg-surface text-muted hover:bg-hover'
                      }`}
                    >
                      {length}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedType.mode === TRACKING_MODES.INTERVALS && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('activity:start.workDuration')}
                  </label>
                  <Input
                    type="number"
                    value={intervalsConfig.work}
                    onChange={(e) =>
                      setIntervalsConfig({ ...intervalsConfig, work: parseInt(e.target.value, 10) || 30 })
                    }
                    min="10"
                    max="300"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('activity:start.restDuration')}
                  </label>
                  <Input
                    type="number"
                    value={intervalsConfig.rest}
                    onChange={(e) =>
                      setIntervalsConfig({ ...intervalsConfig, rest: parseInt(e.target.value, 10) || 15 })
                    }
                    min="5"
                    max="300"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('activity:start.rounds')}
                  </label>
                  <Input
                    type="number"
                    value={intervalsConfig.rounds}
                    onChange={(e) =>
                      setIntervalsConfig({ ...intervalsConfig, rounds: parseInt(e.target.value, 10) || 8 })
                    }
                    min="1"
                    max="50"
                    className="w-full"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleConfigure}
              disabled={loading}
              className="w-full bg-[var(--theme-primary)] text-foreground"
              size="lg"
            >
              <Play size={20} className="mr-2" fill="currentColor" />
              {loading ? t('common:loading') : t('activity:start.begin')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
