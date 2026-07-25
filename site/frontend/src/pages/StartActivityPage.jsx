/**
 * Page de démarrage d'activité
 * Sélecteur de type rapide → configuration → POST /activities/start → navigate live
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Play, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ActivityRecoveryBanner } from '../components/activities/ActivityRecoveryBanner';
import { QUICK_START_TYPES, TRACKING_MODES } from '../lib/activities/constants';
import { activitiesApi, formatApiError } from '../lib/api';
import { getActiveActivity, clearActiveActivity } from '../lib/activities/activityStore';
import { toast } from 'sonner';

export function StartActivityPage() {
  const { t } = useTranslation(['activity', 'common']);
  const navigate = useNavigate();

  const [step, setStep] = useState('select'); // 'select', 'configure'
  const [selectedType, setSelectedType] = useState(null);
  const [activityName, setActivityName] = useState('');
  const [poolLength, setPoolLength] = useState(25);
  const [intervalsConfig, setIntervalsConfig] = useState({ work: 30, rest: 15, rounds: 8 });
  const [loading, setLoading] = useState(false);
  const [existingActivity, setExistingActivity] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    checkExistingActivity();
  }, []);

  const checkExistingActivity = async () => {
    try {
      // Vérifie activité locale
      const local = await getActiveActivity();
      if (local) {
        setExistingActivity(local);
        setCheckingExisting(false);
        return;
      }

      // Vérifie activité serveur
      const { data } = await activitiesApi.getCurrent();
      if (data?.activity) {
        setExistingActivity(data.activity);
      }
    } catch (error) {
      // Pas d'activité en cours
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setActivityName(t(type.labelKey, { defaultValue: type.label }));
    
    // Passe directement au live pour les modes simples
    if (type.mode === TRACKING_MODES.TIMER || type.mode === TRACKING_MODES.MANUAL_DISTANCE || type.mode === TRACKING_MODES.GPS) {
      handleStartActivity(type, {});
    } else {
      setStep('configure');
    }
  };

  const handleStartActivity = async (type, config) => {
    setLoading(true);

    try {
      const payload = {
        tracking_mode: type.mode,
        activity_kind: type.kind,
        exercise_name_snapshot: activityName || t(type.labelKey, { defaultValue: type.label }),
        pool_length_meters: config.pool_length_meters,
        interval_config: config.interval_config,
      };

      const { data } = await activitiesApi.start(payload);
      
      // Navigue vers la page live
      navigate(`/activity/${data.id}/live`);
    } catch (error) {
      if (error.response?.status === 409) {
        // Conflit : activité déjà en cours
        toast.error(t('activity:errors.alreadyActive'));
        await checkExistingActivity();
      } else {
        toast.error(formatApiError(error));
      }
    } finally {
      setLoading(false);
    }
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
    if (existingActivity?.id) {
      navigate(`/activity/${existingActivity.id}/live`);
    }
  };

  const handleCompleteExisting = () => {
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
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-5 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => step === 'configure' ? setStep('select') : navigate(-1)}
            className="p-2 hover:bg-active rounded-full transition-colors"
          >
            <ArrowLeft className="text-foreground" size={24} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {step === 'select' ? t('activity:start.title') : t('activity:start.configure')}
          </h1>
        </div>

        {/* Bannière de récupération */}
        {existingActivity && (
          <ActivityRecoveryBanner
            activityName={existingActivity.exercise_name_snapshot || existingActivity.name}
            onResume={handleResumeExisting}
            onComplete={handleCompleteExisting}
            onDiscard={handleDiscardExisting}
            className="mb-6"
          />
        )}

        {/* Avertissement GPS Web */}
        {step === 'select' && (
          <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={20} />
              <div className="flex-1 text-sm text-blue-400">
                <p className="font-medium mb-1">{t('activity:gps.webWarningTitle')}</p>
                <p className="text-blue-400/80">
                  {t('activity:gps.webWarning', { productName: 'FitMatch' })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Étape 1 : Sélection du type */}
        {step === 'select' && (
          <div className="grid grid-cols-2 gap-3">
            {QUICK_START_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleTypeSelect(type)}
                disabled={loading}
                className="p-4 rounded-xl border border-border bg-surface hover:bg-hover transition-colors text-left"
              >
                <div className="text-3xl mb-2">{type.icon}</div>
                <p className="text-foreground font-medium text-sm">
                  {t(type.labelKey, { defaultValue: type.label })}
                </p>
                <p className="text-subtle text-xs mt-1">
                  {t(`activity:modes.${type.mode}`, { defaultValue: type.mode })}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Étape 2 : Configuration */}
        {step === 'configure' && selectedType && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('activity:start.activityName')}
              </label>
              <Input
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder={t(selectedType.labelKey, { defaultValue: selectedType.label })}
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
                    onChange={(e) => setIntervalsConfig({ ...intervalsConfig, work: parseInt(e.target.value) || 30 })}
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
                    onChange={(e) => setIntervalsConfig({ ...intervalsConfig, rest: parseInt(e.target.value) || 15 })}
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
                    onChange={(e) => setIntervalsConfig({ ...intervalsConfig, rounds: parseInt(e.target.value) || 8 })}
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
