import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Flame, X, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bandeau semaine (accueil) — même logique visuelle que l'agenda.
 */
export function WeekAgendaStrip({ weekDays, dayMap, myAccent, partnerAccent, onDayClick, isToday }) {
  return (
    <div
      className="agenda-calendar-root flex gap-1.5"
      style={{ '--agenda-mine': myAccent, '--agenda-partner': partnerAccent }}
    >
      {weekDays.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const state = dayMap[dateStr] || {};
        const current = isToday(day);
        const {
          in_streak: inStreak,
          my_completed: myDone,
          partner_completed: partnerDone,
          both_completed: bothDone,
          missed,
          rest,
        } = state;

        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onDayClick?.(day)}
            data-testid={`week-day-${dateStr}`}
            className={cn(
              'flex-1 min-w-0 py-2.5 px-1 rounded-2xl text-center transition-all border',
              current && 'ring-1 ring-[var(--theme-primary)] border-[var(--theme-primary)]/40',
              bothDone && 'agenda-mod-both border-transparent',
              !bothDone && myDone && !partnerDone && 'agenda-mod-mine border-transparent',
              !bothDone && partnerDone && !myDone && 'agenda-mod-partner border-transparent',
              missed && 'agenda-mod-missed border-transparent',
              rest && inStreak && !missed && 'agenda-mod-rest-streak border-transparent',
              rest && !inStreak && 'agenda-mod-rest border-white/5',
              !myDone && !partnerDone && !bothDone && !missed && !rest && 'bg-[#141414] border-white/5',
              inStreak && !missed && 'relative'
            )}
          >
            {inStreak && !missed && (
              <Flame
                size={10}
                className="absolute top-0.5 left-1/2 -translate-x-1/2 text-orange-400"
                fill="currentColor"
              />
            )}
            <p className="text-[9px] uppercase text-zinc-500 mt-1">{format(day, 'EEE', { locale: fr })}</p>
            <p className={cn('text-base font-bold', current ? 'text-white' : 'text-zinc-300')}>
              {format(day, 'd')}
            </p>
            <div className="flex justify-center gap-0.5 mt-1 min-h-[6px]">
              {myDone && !bothDone && (
                <span className="w-1 h-1 rounded-full bg-[var(--agenda-mine)]" />
              )}
              {partnerDone && !bothDone && (
                <span className="w-1 h-1 rounded-full bg-[var(--agenda-partner)]" />
              )}
              {bothDone && <span className="w-1.5 h-1 rounded-sm bg-amber-400" />}
              {missed && <X size={10} className="text-red-400" />}
              {rest && inStreak && !missed && <BedDouble size={10} className="text-blue-400" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
