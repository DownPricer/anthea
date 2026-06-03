import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Flame, X, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          partner_missed: partnerMissed,
          my_missed: myMissed,
          rest,
        } = state;

        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onDayClick?.(day)}
            data-testid={`week-day-${dateStr}`}
            className={cn(
              'relative flex-1 min-w-0 py-2.5 px-1 rounded-2xl text-center transition-all border',
              current && 'ring-1 ring-[var(--theme-primary)] border-[var(--theme-primary)]/40',
              bothDone && 'agenda-mod-both border-transparent',
              !bothDone && myDone && 'agenda-mod-mine border-transparent',
              !bothDone && partnerDone && !myDone && 'agenda-mod-partner border-transparent',
              rest && inStreak && 'agenda-mod-rest-streak border-transparent',
              rest && !inStreak && 'agenda-mod-rest border-white/5',
              !myDone && !partnerDone && !bothDone && !rest && 'bg-[#141414] border-white/5'
            )}
          >
            {inStreak && (
              <Flame
                size={8}
                className="absolute top-0.5 left-1/2 -translate-x-1/2 text-orange-400/70"
                fill="currentColor"
              />
            )}
            <p className="text-[9px] uppercase text-zinc-500 mt-0.5">
              {format(day, 'EEE', { locale: fr })}
            </p>
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
              {bothDone && <span className="w-1.5 h-1 rounded-sm bg-amber-400/90" />}
            </div>
            {partnerMissed && (
              <span className="absolute top-1 right-1 h-3 w-3 flex items-center justify-center rounded-full bg-[#0A0A0A] ring-1 ring-red-500/35">
                <X size={7} className="text-red-400" strokeWidth={3} />
              </span>
            )}
            {myMissed && !partnerMissed && (
              <span className="absolute top-1 left-1 h-3 w-3 flex items-center justify-center rounded-full bg-[#0A0A0A] ring-1 ring-red-500/35">
                <X size={7} className="text-red-400" strokeWidth={3} />
              </span>
            )}
            {rest && inStreak && (
              <BedDouble size={8} className="absolute bottom-0.5 right-0.5 text-blue-400/70" />
            )}
          </button>
        );
      })}
    </div>
  );
}
