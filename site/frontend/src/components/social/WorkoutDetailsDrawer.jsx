import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '../ui/drawer';
import { formatDuration } from '../../lib/userProfile';
import { useTranslation } from 'react-i18next';

const STATUS_LABELS = {
  completed: 'Terminé',
  skipped: 'Sauté',
  not_done: 'Non fait',
};

function formatExerciseDetail(ex) {
  if (ex.exercise_type === 'reps' && ex.reps) return `${ex.reps} reps`;
  if (ex.duration) return formatDuration(ex.duration);
  return '';
}

function SessionBlock({ title, snapshot, details, canView }) {
  if (!canView || !snapshot) return null;
  const exercises = details?.exercise_log || [];

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <h4 className="text-sm font-semibold text-white">{title || snapshot.workout_title}</h4>
      {details?.difficulty_felt != null && (
        <p className="text-sm text-zinc-400">
          Difficulté ressentie : <span className="text-white">{details.difficulty_felt}/10</span>
        </p>
      )}
      {(details?.fatigue_before != null || details?.fatigue_after != null) && (
        <p className="text-sm text-zinc-400">
          Fatigue :{' '}
          <span className="text-white">
            {details.fatigue_before ?? '—'} → {details.fatigue_after ?? '—'}
          </span>
        </p>
      )}
      {details?.notes ? (
        <p className="text-sm text-zinc-400 italic">&ldquo;{details.notes}&rdquo;</p>
      ) : null}
      <div className="space-y-2">
        {exercises.length === 0 ? (
          <p className="text-zinc-500 text-sm">Aucun détail d&apos;exercice disponible.</p>
        ) : (
          exercises.map((ex, idx) => {
            const status = ex.status || (ex.completed ? 'completed' : ex.skipped ? 'skipped' : 'not_done');
            return (
              <div
                key={`${ex.name}-${idx}`}
                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{ex.name}</p>
                  <p className="text-zinc-500 text-xs">{formatExerciseDetail(ex)}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    status === 'completed'
                      ? 'bg-green-500/20 text-green-400'
                      : status === 'skipped'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-zinc-500/20 text-zinc-400'
                  }`}
                >
                  {STATUS_LABELS[status] || status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function WorkoutDetailsDrawer({
  open,
  onOpenChange,
  snapshot,
  details,
  canView,
  partnerSnapshot = null,
  partnerDetails = null,
  canViewPartner = false,
  isCommonSession = false,
}) {
  const { t } = useTranslation(['workouts', 'common', 'duo']);
  if (!canView && !canViewPartner) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[#141414] border-white/10 text-white max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="text-white font-['Outfit']">
            {isCommonSession
              ? `${t('workouts:labels.sharedWorkout')} — ${t('common:actions.viewDetails')}`
              : snapshot?.workout_title || t('common:actions.viewDetails')}
          </DrawerTitle>
          <DrawerDescription className="text-zinc-400">
            {isCommonSession ? t('duo:commonSession.partnerSession') : t('common:actions.viewDetails')}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-8 overflow-y-auto space-y-4">
          <SessionBlock
            title={isCommonSession ? 'Séance A' : null}
            snapshot={snapshot}
            details={details}
            canView={canView}
          />
          {isCommonSession && partnerSnapshot ? (
            <SessionBlock
              title="Séance B"
              snapshot={partnerSnapshot}
              details={partnerDetails}
              canView={canViewPartner}
            />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
