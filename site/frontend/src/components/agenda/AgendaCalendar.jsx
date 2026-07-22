import { useMemo } from 'react';
import { format } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { Flame, X, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

export function AgendaCalendar({
  month,
  selected,
  onSelect,
  onMonthChange,
  dayMap = {},
  myAccent,
  partnerAccent,
  streak = 0,
}) {
  const { dateFnsLocale } = useLocaleFormat();
  const get = (date) => dayMap[format(date, 'yyyy-MM-dd')] || {};

  const modifiers = useMemo(
    () => ({
      bothDone: (d) => get(d).both_completed,
      mineOnly: (d) => {
        const s = get(d);
        return s.my_completed && !s.both_completed && !s.partner_completed;
      },
      partnerOnly: (d) => {
        const s = get(d);
        return s.partner_completed && !s.both_completed && !s.my_completed;
      },
      mineWithPartnerMiss: (d) => {
        const s = get(d);
        return s.my_completed && s.partner_missed && !s.both_completed;
      },
      partnerWithMyMiss: (d) => {
        const s = get(d);
        return s.partner_completed && s.my_missed && !s.both_completed;
      },
      restStreak: (d) => get(d).rest && get(d).in_streak,
      restDay: (d) => get(d).rest && !get(d).in_streak,
    }),
    [dayMap]
  );

  const modifiersClassNames = useMemo(
    () => ({
      bothDone: 'agenda-mod-both',
      mineOnly: 'agenda-mod-mine',
      partnerOnly: 'agenda-mod-partner',
      mineWithPartnerMiss: 'agenda-mod-mine',
      partnerWithMyMiss: 'agenda-mod-partner',
      restStreak: 'agenda-mod-rest-streak',
      restDay: 'agenda-mod-rest',
    }),
    []
  );

  return (
    <div
      className="agenda-calendar-root w-full max-w-full min-w-0 overflow-hidden"
      data-testid="agenda-calendar"
      style={{
        '--agenda-mine': myAccent,
        '--agenda-partner': partnerAccent,
      }}
    >
      {streak > 0 && (
        <div className="flex items-center justify-center gap-0.5 mb-3 py-2 px-3 rounded-2xl bg-orange-500/8 border border-orange-500/15 min-w-0">
          <Flame size={14} className="text-orange-400/90 shrink-0" fill="currentColor" />
          <span className="text-muted text-xs ml-1.5 tabular-nums truncate">
            Streak <strong className="text-orange-300/90 font-semibold">{streak}</strong> j.
          </span>
        </div>
      )}

      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(d) => d && onSelect(d)}
        month={month}
        onMonthChange={onMonthChange}
        locale={dateFnsLocale}
        showOutsideDays
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
        classNames={{
          months: 'flex flex-col w-full max-w-full min-w-0',
          month: 'space-y-3 w-full max-w-full min-w-0',
          caption: 'flex items-center justify-between gap-2 pt-1 relative text-foreground mb-1 min-w-0',
          caption_label: 'flex-1 min-w-0 truncate text-center text-sm font-semibold font-[\'Outfit\'] capitalize',
          nav: 'flex items-center gap-1 shrink-0',
          nav_button:
            'h-9 w-9 shrink-0 rounded-full border border-border bg-hover text-muted hover:bg-active hover:text-foreground inline-flex items-center justify-center transition-colors',
          nav_button_previous: 'absolute left-0',
          nav_button_next: 'absolute right-0',
          table: 'w-full max-w-full min-w-0 border-collapse',
          head_row: 'agenda-day-grid w-full',
          head_cell:
            'text-subtle min-w-0 max-w-full overflow-hidden font-medium text-[0.65rem] uppercase tracking-wide text-center',
          row: 'agenda-day-grid w-full mt-1.5',
          cell: 'relative p-0.5 text-center min-w-0 max-w-full overflow-hidden',
          day: cn(
            'relative mx-auto flex aspect-square w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-xl p-0 font-medium text-foreground',
            'hover:bg-active transition-all hover:scale-105 active:scale-95'
          ),
          day_selected: '!ring-2 !ring-foreground/80 !scale-105 z-10',
          day_today: '!ring-1 !ring-[var(--theme-primary)]',
          day_outside: 'text-subtle opacity-35',
          day_disabled: 'text-subtle opacity-30',
        }}
        components={{
          DayContent: ({ date }) => (
            <AgendaDayContent date={date} state={get(date)} />
          ),
        }}
      />
    </div>
  );
}

function AgendaDayContent({ date, state }) {
  const {
    in_streak: inStreak,
    my_completed: myDone,
    partner_completed: partnerDone,
    both_completed: bothDone,
    partner_missed: partnerMissed,
    my_missed: myMissed,
    rest,
    my_session_titles: myTitles = [],
    partner_session_titles: partnerTitles = [],
  } = state;

  const sessionTitles = [...(myTitles || []), ...(partnerTitles || [])].filter(Boolean);
  const sessionCount =
    (state.my_session_count || 0) + (state.partner_session_count || 0) || sessionTitles.length;
  const cellLabel =
    sessionCount > 1
      ? String(sessionCount)
      : sessionTitles[0]
        ? sessionTitles[0]
        : null;

  return (
    <span className="relative flex flex-col items-center justify-center w-full h-full min-h-[2rem] min-w-0 max-w-full overflow-hidden px-0.5">
      {inStreak && (
        <Flame
          size={8}
          className="absolute top-0 left-1/2 -translate-x-1/2 text-orange-400/70 z-[1]"
          fill="currentColor"
        />
      )}
      <span className={cn('text-sm leading-none z-[2]', inStreak ? 'mt-1' : '')}>
        {date.getDate()}
      </span>
      {cellLabel ? (
        <span
          className="block max-w-full truncate overflow-hidden whitespace-nowrap text-[8px] leading-tight text-subtle z-[2] mt-0.5"
          data-testid="agenda-day-title"
          title={sessionTitles.join(' · ') || undefined}
        >
          {sessionCount > 1 ? sessionCount : cellLabel}
        </span>
      ) : null}
      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5 z-[2]">
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
    </span>
  );
}
