import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { readStoredTimeFormat } from "../i18n/storage";
import {
  formatCalories,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatDayMonthTime,
  formatDuration,
  formatNumber,
  formatRelativeDate,
  formatShortDate,
  formatTime,
  formatWeekdayDate,
} from "../i18n/format";
import { getDateFnsLocale } from "../i18n/dateFnsLocales";

export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const prefs = useMemo(
    () => ({
      locale: i18n.language,
      timeFormat: user?.time_format || readStoredTimeFormat(),
    }),
    [i18n.language, user?.time_format]
  );

  return useMemo(() => {
    const bind = (fn) => (value, extra = {}) => fn(value, { ...prefs, ...extra });

    return {
      locale: prefs.locale,
      timeFormat: prefs.timeFormat,
      dateFnsLocale: getDateFnsLocale(prefs.locale),
      formatDate: bind(formatDate),
      formatDateTime: bind(formatDateTime),
      formatTime: bind(formatTime),
      formatRelativeDate: bind(formatRelativeDate),
      formatDuration: bind(formatDuration),
      formatNumber: bind(formatNumber),
      formatCalories: bind(formatCalories),
      formatShortDate: bind(formatShortDate),
      formatWeekdayDate: bind(formatWeekdayDate),
      formatDayMonth: bind(formatDayMonth),
      formatDayMonthTime: bind(formatDayMonthTime),
    };
  }, [prefs]);
}
