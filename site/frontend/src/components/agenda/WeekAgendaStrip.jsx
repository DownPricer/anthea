import { format } from 'date-fns';
import { Flame, X, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heatmapDayTitle } from '@/lib/heatmapDayStyle';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

export function WeekAgendaStrip({ weekDays, dayMap, myAccent, partnerAccent, onDayClick, isToday, selectedDay }) {
  const { formatWeekdayDate, dateFnsLocale } = useLocaleFormat();

  return (
    <div
      className="agenda-calendar-root flex gap-1.5"
      style={{ '--agenda-mine': myAccent, '--agenda-partner': partnerAccent }}
    >
      {weekDays.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const state = dayMap[dateStr] || {};
        const current = isToday(day);
        const selected = selectedDay ? format(selectedDay, 'yyyy-MM-dd') === dateStr : current;
        const {
          in_streak: inStreak,
          my_completed: myDone,
          partner_completed: partnerDone,
          both_completed: bothDone,
          partner_missed: partnerMissed,
          my_missed: myMissed,
          rest,
        } = state;
        const dateLabel = formatWeekdayDate(day);
        const a11yLabel = heatmapDayTitle(state, dateLabel);

        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onDayClick?.(day)}
            data-testid={`week-day-${dateStr}`}
            title={a11yLabel}
            aria-label={a11yLabel}
            className={cn(
              'relative flex-1 min-w-0 py-2.5 px-1 rounded-2xl text-center transition-all border',
              current && 'ring-1 ring-[var(--theme-primary)] border-[var(--theme-primary)]/40',
              selected && !current && 'ring-1 ring-white/30 border-white/20',
              bothDone && 'agenda-mod-both border-transparent',
              !bothDone && myDone && 'agenda-mod-mine border-transparent',
              !bothDone && partnerDone && !myDone && 'agenda-mod-partner border-transparent',
              rest && inStreak && 'agenda-mod-rest-streak border-transparent',
              rest && !inStreak && 'agenda-mod-rest border-border',
              !myDone && !partnerDone && !bothDone && !rest && 'bg-surface-elevated border-border'
            )}
          >
            {inStreak && (
              <Flame
                size={8}
                className="absolute top-0.5 left-1/2 -translate-x-1/2 text-orange-400/70 z-[1]"
                fill="currentColor"
              />
            )}
            <span className="text-[10px] text-subtle uppercase">
              {format(day, 'EEE', { locale: dateFnsLocale })}
            </span>
            <span className={cn('block text-sm font-medium text-foreground mt-0.5', inStreak && 'mt-1')}>
              {day.getDate()}
            </span>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-[2]">
              {myDone && !bothDone && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--agenda-mine)]" />
              )}
              {partnerDone && !bothDone && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--agenda-partner)]" />
              )}
              {bothDone && <span className="w-2 h-1 rounded-sm bg-amber-400/90" />}
            </span>
            {partnerMissed && (
              <span
                className="absolute top-0.5 right-0.5 z-[3] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background/90 ring-1 ring-red-500/40"
                title="Séance partenaire non faite"
              >
                <X size={8} className="text-red-400 stroke-[3]" />
              </span>
            )}
            {myMissed && !partnerMissed && (
              <span
                className="absolute top-0.5 left-0.5 z-[3] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background/90 ring-1 ring-red-500/40"
                title="Ma séance non faite"
              >
                <X size={8} className="text-red-400 stroke-[3]" />
              </span>
            )}
            {rest && inStreak && (
              <BedDouble size={7} className="absolute bottom-0 right-0.5 text-blue-400/70 z-[2]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
