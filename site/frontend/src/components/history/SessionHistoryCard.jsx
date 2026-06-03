import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_LABELS = {
  completed: { label: 'Terminée', className: 'bg-green-500/15 text-green-400' },
  abandoned: { label: 'Abandonnée', className: 'bg-red-500/15 text-red-400' },
  missed: { label: 'Manquée', className: 'bg-zinc-500/20 text-zinc-400' },
};

export function SessionHistoryCard({ session, canAdjustTime, onAdjustTime }) {
  const [open, setOpen] = useState(false);
  const st = STATUS_LABELS[session.display_status || session.status] || STATUS_LABELS.completed;

  const formatDuration = (sec) => {
    const m = Math.floor((sec || 0) / 60);
    const s = (sec || 0) % 60;
    return m > 0 ? `${m} min${s ? ` ${s}s` : ''}` : `${s}s`;
  };

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="w-full p-4 text-left flex items-start gap-3"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-medium truncate">{session.workout_title}</p>
            <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', st.className)}>
              {st.label}
            </span>
          </div>
          <p className="text-zinc-500 text-xs mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <User size={11} /> {session.username}
            </span>
            {session.created_at && (
              <span>
                {format(parseISO(session.created_at), 'd MMM yyyy · HH:mm', { locale: fr })}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white text-sm font-medium flex items-center gap-1 justify-end">
            <Clock size={12} className="text-zinc-500" />
            {formatDuration(session.total_time)}
          </p>
          <p className="text-zinc-500 text-[10px]">
            {session.exercises_completed}/{session.exercises_total} exos
          </p>
          {open ? <ChevronUp size={16} className="text-zinc-500 ml-auto mt-1" /> : <ChevronDown size={16} className="text-zinc-500 ml-auto mt-1" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-white/5 space-y-3">
          {(session.fatigue_before != null || session.fatigue_after != null || session.difficulty_felt != null) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {session.fatigue_before != null && (
                <span className="px-2 py-1 rounded-full bg-white/5 text-zinc-400">
                  Fatigue avant : {session.fatigue_before}/10
                </span>
              )}
              {session.fatigue_after != null && (
                <span className="px-2 py-1 rounded-full bg-white/5 text-zinc-400">
                  Fatigue après : {session.fatigue_after}/10
                </span>
              )}
              {session.difficulty_felt != null && (
                <span className="px-2 py-1 rounded-full bg-white/5 text-zinc-400">
                  Difficulté : {session.difficulty_felt}/10
                </span>
              )}
            </div>
          )}

          {session.exercise_log?.length > 0 ? (
            <ul className="space-y-1.5">
              {session.exercise_log.map((ex, i) => (
                <li
                  key={i}
                  className="flex justify-between gap-2 text-sm py-1.5 px-2 rounded-lg bg-[#0A0A0A]/60"
                >
                  <span className="text-zinc-300 truncate">{ex.name}</span>
                  <span className="text-zinc-500 shrink-0 text-xs">
                    {ex.exercise_type === 'reps'
                      ? `${ex.reps ?? '—'} reps`
                      : `${ex.duration ?? '—'}s`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-600 text-xs">Détail exercices non enregistré pour cette séance.</p>
          )}

          {session.notes && (
            <p className="text-zinc-500 text-sm italic border-l-2 border-white/10 pl-3">
              {session.notes}
            </p>
          )}

          {canAdjustTime && onAdjustTime && (
            <button
              type="button"
              className="text-[10px] text-zinc-600 hover:text-zinc-400"
              onClick={() => onAdjustTime(session)}
            >
              Corriger le temps (coach)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
