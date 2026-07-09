import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  getMonth,
  parseISO,
  isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, Loader2 } from 'lucide-react';
import { streakApi } from '../../lib/api';
import { calendarDaysToMap } from '../../lib/agendaDayMap';
import { Button } from '../ui/button';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function dayIntensity(day) {
  if (!day || day.is_future) return 0;
  if (day.both_completed) return 4;
  if (day.my_completed || day.partner_completed) return 3;
  if (day.combined === 'ok' || day.in_streak) return 2;
  if (day.rest) return 1;
  if (day.has_planned && day.combined === 'fail') return -1;
  return 0;
}

const INTENSITY_CLASS = {
  0: 'bg-white/[0.04]',
  1: 'bg-blue-500/40',
  2: 'bg-emerald-500/50',
  3: 'bg-[var(--theme-primary)]/60',
  4: 'bg-orange-500/70',
  [-1]: 'bg-red-500/30',
};

export function AnnualHeatmap({
  year = new Date().getFullYear(),
  userId = null,
  title = 'Agenda annuel',
  accentColor = null,
  duoMode = false,
}) {
  const [dayMap, setDayMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const gridRef = useRef(null);

  const days = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));
    return eachDayOfInterval({ start, end });
  }, [year]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = `${year}-01-01`;
      const endStr = `${year}-12-31`;
      const params = userId ? { target_user: userId } : {};
      const { data } = await streakApi.getCalendar(startStr, endStr, params);
      setDayMap(calendarDaysToMap(data?.days || []));
    } catch {
      setDayMap({});
    } finally {
      setLoading(false);
    }
  }, [year, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const weeksByMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, () => []);
    days.forEach((date) => {
      months[getMonth(date)].push(date);
    });
    return months;
  }, [days]);

  const handleExport = () => {
    const cell = 10;
    const gap = 2;
    const cols = 31;
    const rows = 12;
    const pad = 24;
    const w = pad * 2 + cols * (cell + gap);
    const h = pad * 2 + rows * (cell + gap) + 20;
    const canvas = document.createElement('canvas');
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${title} — ${year}`, w / 2, 16);

    const colors = {
      0: '#1a1a1a',
      1: '#3b82f680',
      2: '#10b98180',
      3: '#06b6d499',
      4: '#f9731680',
      [-1]: '#ef444450',
    };

    weeksByMonth.forEach((monthDays, monthIdx) => {
      monthDays.forEach((date, dayIdx) => {
        const key = format(date, 'yyyy-MM-dd');
        const info = dayMap[key] || {};
        const intensity = duoMode
          ? info.both_completed
            ? 4
            : info.my_completed || info.partner_completed
              ? 2
              : dayIntensity(info)
          : dayIntensity(info);
        const col = dayIdx % cols;
        const row = monthIdx;
        ctx.fillStyle = colors[intensity] || colors[0];
        ctx.fillRect(
          pad + col * (cell + gap),
          pad + row * (cell + gap),
          cell,
          cell
        );
      });
    });

    const link = document.createElement('a');
    link.download = `agenda-${year}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="annual-heatmap">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold font-['Outfit']">{title} — {year}</h3>
          {duoMode ? (
            <p className="text-zinc-500 text-xs mt-0.5">Séances communes et jours d&apos;entraînement duo</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExport}
          className="rounded-xl border-white/15 text-white shrink-0"
        >
          <Download size={14} className="mr-1.5" />
          JPG
        </Button>
      </div>

      <div ref={gridRef} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 space-y-4">
        <p className="text-zinc-500 text-xs text-center">{year}</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {weeksByMonth.map((monthDays, monthIdx) => (
            <div key={monthIdx} className="space-y-1.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide text-center">
                {MONTH_LABELS[monthIdx]}
              </p>
              <div
                className="flex flex-wrap gap-0.5 justify-center"
                style={accentColor ? { '--heatmap-accent': accentColor } : undefined}
              >
                {monthDays.map((date) => {
                  const key = format(date, 'yyyy-MM-dd');
                  const info = dayMap[key] || {};
                  const intensity = duoMode
                    ? info.both_completed
                      ? 4
                      : info.my_completed && info.partner_completed
                        ? 4
                        : info.my_completed || info.partner_completed
                          ? 2
                          : dayIntensity(info)
                    : dayIntensity(info);
                  const isSelected = selectedDay && isSameDay(selectedDay, date);
                  return (
                    <button
                      key={key}
                      type="button"
                      title={format(date, 'd MMMM yyyy', { locale: fr })}
                      onClick={() => setSelectedDay(date)}
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm transition-transform ${
                        INTENSITY_CLASS[intensity] || INTENSITY_CLASS[0]
                      } ${isSelected ? 'ring-1 ring-white scale-125' : 'hover:scale-110'}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-[10px] text-zinc-500 pt-2 border-t border-white/5">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white/[0.04]" /> Repos / vide</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50" /> Séance</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500/70" /> Duo</span>
        </div>
      </div>

      {selectedDay ? (
        <p className="text-zinc-400 text-sm text-center">
          {format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}
          {dayMap[format(selectedDay, 'yyyy-MM-dd')]?.has_planned
            ? ' — séance prévue'
            : dayMap[format(selectedDay, 'yyyy-MM-dd')]?.my_completed
              ? ' — séance faite'
              : ''}
        </p>
      ) : null}
    </div>
  );
}
