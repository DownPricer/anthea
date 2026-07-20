import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  getMonth,
  isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, Loader2 } from 'lucide-react';
import { streakApi } from '../../lib/api';
import { calendarDaysToMap } from '../../lib/agendaDayMap';
import { getHeatmapDayStyle, heatmapDayTitle, paintHeatmapCell } from '../../lib/heatmapDayStyle';
import { Button } from '../ui/button';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function AnnualHeatmap({
  year = new Date().getFullYear(),
  userId = null,
  title = 'Agenda annuel',
  accentColor = null,
  partnerColor = null,
  /** Jours déjà chargés (évite un 2e fetch calendar) */
  initialDays = null,
}) {
  const [dayMap, setDayMap] = useState(() =>
    initialDays ? calendarDaysToMap(initialDays) : {}
  );
  const [loading, setLoading] = useState(!initialDays);
  const [selectedDay, setSelectedDay] = useState(null);
  const gridRef = useRef(null);

  const colorOpts = useMemo(
    () => ({ accentColor: accentColor || undefined, partnerColor: partnerColor || undefined }),
    [accentColor, partnerColor]
  );

  const days = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));
    return eachDayOfInterval({ start, end });
  }, [year]);

  const load = useCallback(async () => {
    if (initialDays && Array.isArray(initialDays)) {
      setDayMap(calendarDaysToMap(initialDays));
      setLoading(false);
      return;
    }
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
  }, [year, userId, initialDays]);

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

  const getCellStyle = useCallback(
    (info) => getHeatmapDayStyle(info, colorOpts),
    [colorOpts]
  );

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

    weeksByMonth.forEach((monthDays, monthIdx) => {
      monthDays.forEach((date, dayIdx) => {
        const key = format(date, 'yyyy-MM-dd');
        const info = dayMap[key] || {};
        const style = getCellStyle(info);
        const col = dayIdx % cols;
        const row = monthIdx;
        paintHeatmapCell(
          ctx,
          pad + col * (cell + gap),
          pad + row * (cell + gap),
          cell,
          style
        );
      });
    });

    const link = document.createElement('a');
    link.download = `agenda-${year}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedInfo = selectedKey ? dayMap[selectedKey] : null;

  return (
    <div className="space-y-4" data-testid="annual-heatmap">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold font-['Outfit']">{title} — {year}</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Séances terminées uniquement</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExport}
          className="rounded-xl border-white/15 text-white shrink-0"
        >
          <Download size={14} className="mr-1.5" />
          PNG
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
              <div className="flex flex-wrap gap-0.5 justify-center">
                {monthDays.map((date) => {
                  const key = format(date, 'yyyy-MM-dd');
                  const info = dayMap[key] || {};
                  const style = getCellStyle(info);
                  const isSelected = selectedDay && isSameDay(selectedDay, date);
                  const dateLabel = format(date, 'd MMMM yyyy', { locale: fr });
                  return (
                    <button
                      key={key}
                      type="button"
                      title={heatmapDayTitle(info, dateLabel)}
                      aria-label={heatmapDayTitle(info, dateLabel)}
                      onClick={() => setSelectedDay(date)}
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm transition-transform ${
                        isSelected ? 'ring-1 ring-white scale-125' : 'hover:scale-110'
                      } ${style.kind === 'empty' ? 'bg-white/[0.04]' : ''}`}
                      style={
                        style.kind !== 'empty'
                          ? style.gradient
                            ? {
                                background: `linear-gradient(135deg, ${style.gradient[0]} 0 50%, ${style.gradient[1]} 50% 100%)`,
                              }
                            : { backgroundColor: style.fill }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDay ? (
        <p className="text-zinc-400 text-sm text-center">
          {heatmapDayTitle(
            selectedInfo,
            format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })
          )}
        </p>
      ) : null}
    </div>
  );
}
