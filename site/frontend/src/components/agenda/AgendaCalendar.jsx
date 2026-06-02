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
      mineOnly: (d) => get(d).my_completed && !get(d).partner_completed && !get(d).both_completed,
      partnerOnly: (d) => get(d).partner_completed && !get(d).my_completed && !get(d).both_completed,
      missed: (d) => get(d).missed,
      restStreak: (d) => get(d).rest && get(d).in_streak,
      restDay: (d) => get(d).rest && !get(d).in_streak,
      streakDay: (d) => get(d).in_streak && !get(d).missed,
    }),
    [dayMap]
  );

  const modifiersClassNames = useMemo(
    () => ({
      bothDone: 'agenda-mod-both',
      mineOnly: 'agenda-mod-mine',
      partnerOnly: 'agenda-mod-partner',
      missed: 'agenda-mod-missed',
      restStreak: 'agenda-mod-rest-streak',
      restDay: 'agenda-mod-rest',
      streakDay: 'agenda-mod-streak',
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
        <div className="flex items-center justify-center gap-1 mb-4 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/8 to-transparent border border-orange-500/25">
          {Array.from({ length: Math.min(streak, 5) }).map((_, i) => (
            <Flame
              key={i}
              size={14 + Math.min(i, 3)}
              className="text-orange-400 agenda-flame-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
              fill="currentColor"
            />
          ))}
          {streak > 5 && (
            <span className="text-orange-300 text-xs font-bold ml-0.5">+{streak - 5}</span>
          )}
          <span className="text-zinc-400 text-xs ml-2 tabular-nums">
            {streak} j. de streak
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
          day_selected:
            '!ring-2 !ring-white/90 !scale-105 z-10 bg-white/10',
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
    missed,
    rest,
  } = state;

  return (
    <span className="relative flex flex-col items-center justify-center w-full h-full min-h-[2rem]">
      {inStreak && !missed && (
        <Flame
          size={11}
          className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-orange-400 z-[1]"
          fill="currentColor"
          style={{ filter: 'drop-shadow(0 0 3px rgba(251,146,60,0.9))' }}
        />
      )}
      <span className={cn('text-sm leading-none z-[2]', inStreak && !missed ? 'mt-2' : '')}>
        {date.getDate()}
      </span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-[2]">
        {myDone && !bothDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--agenda-mine)]" />
        )}
        {partnerDone && !bothDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--agenda-partner)]" />
        )}
        {bothDone && <span className="w-2 h-1 rounded-sm bg-amber-400" />}
      </span>
      {missed && (
        <span className="absolute inset-0 flex items-center justify-center z-[3] pointer-events-none">
          <X size={15} className="text-red-400 stroke-[2.5]" />
        </span>
      )}
      {rest && inStreak && !missed && (
        <BedDouble size={8} className="absolute top-0.5 right-0.5 text-blue-400/90 z-[2]" />
      )}
    </span>
  );
}

function AgendaLegend({ myAccent, partnerAccent }) {
  const items = [
    { color: myAccent, label: 'Moi' },
    { color: partnerAccent, label: 'Partenaire' },
    { label: 'Duo', className: 'agenda-legend-duo' },
    { icon: X, label: 'Manquée', className: 'text-red-400' },
    { icon: Flame, label: 'Streak', className: 'text-orange-400' },
    { icon: BedDouble, label: 'Repos OK', className: 'text-blue-400' },
  ];

  return (
    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          {item.color && (
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
          )}
          {item.className === 'agenda-legend-duo' && (
            <span className="w-3 h-3 rounded-md shrink-0 agenda-legend-duo-swatch" />
          )}
          {item.icon && <item.icon size={11} className={item.className} fill={item.icon === Flame ? 'currentColor' : undefined} />}
          {item.label}
        </span>
      ))}
    </div>
  );
}
