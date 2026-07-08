import { useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import { Flame, X, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      className="agenda-calendar-root"
      style={{
        '--agenda-mine': myAccent,
        '--agenda-partner': partnerAccent,
      }}
    >
      {streak > 0 && (
        <div className="flex items-center justify-center gap-0.5 mb-3 py-2 px-3 rounded-2xl bg-orange-500/8 border border-orange-500/15">
          <Flame size={14} className="text-orange-400/90" fill="currentColor" />
          <span className="text-zinc-400 text-xs ml-1.5 tabular-nums">
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
        locale={fr}
        showOutsideDays
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
        classNames={{
          months: 'flex flex-col w-full',
          month: 'space-y-3 w-full',
          caption: 'flex justify-center pt-1 relative items-center text-white mb-1',
          caption_label: 'text-sm font-semibold font-[\'Outfit\'] capitalize',
          nav: 'flex items-center',
          nav_button:
            'h-9 w-9 rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white inline-flex items-center justify-center transition-colors',
          nav_button_previous: 'absolute left-0',
          nav_button_next: 'absolute right-0',
          table: 'w-full border-collapse',
          head_row: 'flex justify-around',
          head_cell: 'text-zinc-500 w-11 font-medium text-[0.65rem] uppercase tracking-wide',
          row: 'flex w-full justify-around mt-1.5',
          cell: 'relative p-0.5 text-center',
          day: cn(
            'relative h-11 w-11 mx-auto rounded-xl p-0 font-medium text-white',
            'hover:bg-white/10 transition-all hover:scale-105 active:scale-95'
          ),
          day_selected: '!ring-2 !ring-white/80 !scale-105 z-10',
          day_today: '!ring-1 !ring-[var(--theme-primary)]',
          day_outside: 'text-zinc-600 opacity-35',
          day_disabled: 'text-zinc-700 opacity-30',
        }}
        components={{
          DayContent: ({ date }) => (
            <AgendaDayContent date={date} state={get(date)} />
          ),
        }}
      />

      <AgendaLegend myAccent={myAccent} partnerAccent={partnerAccent} />
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
  } = state;

  return (
    <span className="relative flex flex-col items-center justify-center w-full h-full min-h-[2rem]">
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
          className="absolute top-0.5 right-0.5 z-[3] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0A0A0A]/90 ring-1 ring-red-500/40"
          title="Séance partenaire non faite"
        >
          <X size={8} className="text-red-400 stroke-[3]" />
        </span>
      )}
      {myMissed && !partnerMissed && (
        <span
          className="absolute top-0.5 left-0.5 z-[3] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0A0A0A]/90 ring-1 ring-red-500/40"
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

function AgendaLegend({ myAccent, partnerAccent }) {
  return (
    <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full" style={{ background: myAccent }} /> Moi
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full" style={{ background: partnerAccent }} /> Partenaire
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-md agenda-legend-duo-swatch" /> Duo
      </span>
      <span className="flex items-center gap-1.5">
        <BedDouble size={10} className="text-blue-400/80" /> Repos
      </span>
    </div>
  );
}
