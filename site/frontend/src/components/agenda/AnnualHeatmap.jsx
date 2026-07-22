import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  getMonth,
  isSameDay,
} from 'date-fns';
import { Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { streakApi } from '../../lib/api';
import { calendarDaysToMap } from '../../lib/agendaDayMap';
import { getHeatmapDayStyle, heatmapDayTitle, paintHeatmapCell } from '../../lib/heatmapDayStyle';
import { Button } from '../ui/button';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function safeDayMap(days) {
  if (!days || !Array.isArray(days)) return {};
  try {
    return calendarDaysToMap(days) || {};
  } catch {
    return {};
  }
}

export function AnnualHeatmap({
  year = new Date().getFullYear(),
  userId = null,
  title = 'Agenda annuel',
  accentColor = null,
  partnerColor = null,
  /** Jours déjà chargés (évite un 2e fetch calendar) */
  initialDays = null,
  onYearChange = null,
}) {
  const { t } = useTranslation(['settings']);
  const { formatDate, formatWeekdayDate } = useLocaleFormat();
  const [dayMap, setDayMap] = useState(() => safeDayMap(initialDays));
  const [loading, setLoading] = useState(!Array.isArray(initialDays));
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const gridRef = useRef(null);

  const safeYear = Number.isFinite(Number(year)) ? Number(year) : new Date().getFullYear();
  const canNavigateYear = typeof onYearChange === 'function';

  const colorOpts = useMemo(
    () => ({ accentColor: accentColor || undefined, partnerColor: partnerColor || undefined }),
    [accentColor, partnerColor]
  );

  const days = useMemo(() => {
    try {
      const start = startOfYear(new Date(safeYear, 0, 1));
      const end = endOfYear(new Date(safeYear, 0, 1));
      return eachDayOfInterval({ start, end });
    } catch {
      return [];
    }
  }, [safeYear]);

  const load = useCallback(async () => {
    if (Array.isArray(initialDays)) {
      setDayMap(safeDayMap(initialDays));
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const startStr = `${safeYear}-01-01`;
      const endStr = `${safeYear}-12-31`;
      const params = userId ? { target_user: userId } : {};
      const { data } = await streakApi.getCalendar(startStr, endStr, params);
      setDayMap(safeDayMap(data?.days));
    } catch {
      setDayMap({});
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [safeYear, userId, initialDays]);

  useEffect(() => {
    load();
  }, [load]);

  const weeksByMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, () => []);
    (days || []).forEach((date) => {
      if (!date) return;
      months[getMonth(date)].push(date);
    });
    return months;
  }, [days]);

  const getCellStyle = useCallback(
    (info) => getHeatmapDayStyle(info || {}, colorOpts),
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
    if (!ctx) return;
    ctx.scale(2, 2);
    const rootStyles = getComputedStyle(document.documentElement);
    ctx.fillStyle = rootStyles.getPropertyValue('--background').trim() || '#0A0A0A';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = rootStyles.getPropertyValue('--foreground').trim() || '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${title} — ${safeYear}`, w / 2, 16);

    const map = dayMap || {};
    weeksByMonth.forEach((monthDays, monthIdx) => {
      (monthDays || []).forEach((date, dayIdx) => {
        const key = format(date, 'yyyy-MM-dd');
        const info = map[key] || {};
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
    link.download = `agenda-${safeYear}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12" data-testid="annual-heatmap-loading">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedInfo = selectedKey && dayMap ? dayMap[selectedKey] : null;
  const selectedTitles = [
    ...(selectedInfo?.my_session_titles || []),
    ...(selectedInfo?.partner_session_titles || []),
  ].filter(Boolean);
  const hasActivity = dayMap && Object.keys(dayMap).some((k) => {
    const info = dayMap[k];
    return info && (info.completed > 0 || info.has_activity || info.sessions?.length);
  });

  return (
    <div
      className="space-y-4 w-full max-w-full min-w-0 overflow-hidden"
      data-testid="annual-heatmap"
    >
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            {canNavigateYear ? (
              <button
                type="button"
                data-testid="annual-heatmap-prev-year"
                aria-label={t('settings:agenda.prevYear', { defaultValue: 'Année précédente' })}
                onClick={() => onYearChange(safeYear - 1)}
                className="h-8 w-8 shrink-0 rounded-full border border-border bg-hover text-muted hover:bg-active hover:text-foreground inline-flex items-center justify-center"
              >
                <ChevronLeft size={16} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1 text-center">
              <h3 className="text-foreground font-semibold font-['Outfit'] truncate">
                {title} — {safeYear}
              </h3>
              <p className="text-subtle text-xs mt-0.5 truncate">{t('settings:agenda.completedOnly')}</p>
            </div>
            {canNavigateYear ? (
              <button
                type="button"
                data-testid="annual-heatmap-next-year"
                aria-label={t('settings:agenda.nextYear', { defaultValue: 'Année suivante' })}
                onClick={() => onYearChange(safeYear + 1)}
                className="h-8 w-8 shrink-0 rounded-full border border-border bg-hover text-muted hover:bg-active hover:text-foreground inline-flex items-center justify-center"
              >
                <ChevronRight size={16} />
              </button>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExport}
          className="rounded-xl border-border text-foreground shrink-0"
        >
          <Download size={14} className="mr-1.5" />
          PNG
        </Button>
      </div>

      {error ? (
        <p className="text-subtle text-sm text-center py-2" data-testid="annual-heatmap-error">
          {t('settings:agenda.loadError', { defaultValue: 'Impossible de charger l’agenda.' })}
        </p>
      ) : null}

      {!error && !hasActivity ? (
        <p className="text-subtle text-sm text-center py-1" data-testid="annual-heatmap-empty">
          {t('settings:agenda.noActivity', { defaultValue: 'Aucune activité enregistrée cette année.' })}
        </p>
      ) : null}

      <div
        ref={gridRef}
        className="rounded-2xl border border-border bg-background p-3 sm:p-4 space-y-4 w-full max-w-full min-w-0 overflow-hidden"
      >
        <p className="text-subtle text-xs text-center">{safeYear}</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3 min-w-0">
          {weeksByMonth.map((monthDays, monthIdx) => (
            <div key={monthIdx} className="space-y-1.5 min-w-0 max-w-full overflow-hidden">
              <p className="text-[10px] text-subtle uppercase tracking-wide text-center truncate">
                {MONTH_LABELS[monthIdx]}
              </p>
              <div className="flex flex-wrap gap-0.5 justify-center min-w-0">
                {(monthDays || []).map((date) => {
                  const key = format(date, 'yyyy-MM-dd');
                  const info = (dayMap && dayMap[key]) || {};
                  const style = getCellStyle(info);
                  const isSelected = selectedDay && isSameDay(selectedDay, date);
                  const dateLabel = formatDate(date);
                  const titles = [
                    ...(info.my_session_titles || []),
                    ...(info.partner_session_titles || []),
                  ].filter(Boolean);
                  const count =
                    (info.my_session_count || 0) + (info.partner_session_count || 0) || titles.length;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={heatmapDayTitle(info, dateLabel)}
                      aria-label={heatmapDayTitle(info, dateLabel)}
                      onClick={() => setSelectedDay(date)}
                      className={`relative w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0 rounded-sm transition-transform min-w-0 max-w-full overflow-hidden ${
                        isSelected ? 'ring-1 ring-foreground scale-125' : 'hover:scale-110'
                      } ${style.kind === 'empty' ? 'bg-hover' : ''}`}
                      style={
                        style.kind !== 'empty'
                          ? style.gradient
                            ? {
                                background: `linear-gradient(135deg, ${style.gradient[0]} 0 50%, ${style.gradient[1]} 50% 100%)`,
                              }
                            : { backgroundColor: style.fill }
                          : undefined
                      }
                    >
                      {count > 1 ? (
                        <span className="sr-only">{count} séances</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDay ? (
        <div
          className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-surface-elevated/60 px-3 py-2"
          data-testid="annual-heatmap-day-detail"
        >
          <p className="text-muted text-sm text-center min-w-0 break-words [overflow-wrap:anywhere] line-clamp-3">
            {heatmapDayTitle(selectedInfo, formatWeekdayDate(selectedDay))}
          </p>
          {selectedTitles.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 min-w-0">
              {selectedTitles.map((titleText, idx) => (
                <li
                  key={`${titleText}-${idx}`}
                  className="block min-w-0 max-w-full text-xs text-foreground text-center break-words [overflow-wrap:anywhere] line-clamp-2"
                  data-testid="annual-heatmap-session-title"
                >
                  {titleText}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
