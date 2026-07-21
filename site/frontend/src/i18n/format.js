import i18n from "./index";
import { DEFAULT_LOCALE, normalizeLocale } from "./supportedLocales";
import { readStoredTimeFormat } from "./storage";

/**
 * Résout locale + timeFormat depuis i18n, localStorage ou overrides explicites.
 */
export function resolveFormatPreferences(overrides = {}) {
  const locale = normalizeLocale(
    overrides.locale || (typeof i18n?.language === "string" ? i18n.language : null) || DEFAULT_LOCALE
  );
  const timeFormat = overrides.timeFormat || readStoredTimeFormat();
  return { locale, timeFormat };
}

function resolveHour12(locale, timeFormat) {
  if (timeFormat === "12h") return true;
  if (timeFormat === "24h") return false;
  return String(locale).startsWith("en");
}

function toDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeDurationSeconds(secondsOrMs) {
  const raw = Number(secondsOrMs);
  if (!Number.isFinite(raw) || raw < 0) return null;
  if (raw >= 86400 * 100) return Math.floor(raw / 1000);
  return Math.floor(raw);
}

export function formatDate(date, options = {}) {
  const { locale } = resolveFormatPreferences(options);
  const d = toDate(date);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatTime(date, options = {}) {
  const { locale, timeFormat } = resolveFormatPreferences(options);
  const d = toDate(date);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: resolveHour12(locale, timeFormat),
  }).format(d);
}

export function formatDateTime(date, options = {}) {
  const prefs = resolveFormatPreferences(options);
  const d = toDate(date);
  if (!d) return "";
  const datePart = formatDate(d, prefs);
  const timePart = formatTime(d, prefs);
  if (prefs.locale.startsWith("en")) return `${datePart} at ${timePart}`;
  if (prefs.locale.startsWith("es")) return `${datePart} a las ${timePart}`;
  return `${datePart} à ${timePart}`;
}

export function formatRelativeDate(date, options = {}) {
  const { locale } = resolveFormatPreferences(options);
  const d = toDate(date);
  if (!d) return "";
  const now = Date.now();
  const diffSec = Math.round((d.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const absSec = Math.abs(diffSec);
  if (absSec < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffSec / 3600);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffSec / 86400);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffSec / (86400 * 30));
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

export function formatDuration(secondsOrMs, options = {}) {
  const { locale } = resolveFormatPreferences(options);
  const totalSec = normalizeDurationSeconds(secondsOrMs);
  if (totalSec == null) return "";

  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const nf = (value, unit) =>
    new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow" }).format(value);

  const parts = [];
  if (hours > 0) parts.push(nf(hours, "hour"));
  if (minutes > 0 || hours === 0) parts.push(nf(minutes, "minute"));
  if (hours === 0 && minutes === 0) parts.push(nf(seconds, "second"));
  return parts.join(" ");
}

export function formatNumber(n, options = {}) {
  const { locale } = resolveFormatPreferences(options);
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return new Intl.NumberFormat(locale).format(num);
}

export function formatCalories(n, options = {}) {
  const { locale } = resolveFormatPreferences(options);
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return `${new Intl.NumberFormat(locale).format(Math.round(num))} kcal`;
}

/** Date courte type « lun. 3 mars 2025 » via Intl (sans date-fns). */
export function formatShortDate(date, options = {}) {
  const { locale } = resolveFormatPreferences(options);
  const d = toDate(date);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Date avec jour de semaine complet, sans heure. */
export function formatWeekdayDate(date, options = {}) {
  const { locale } = resolveFormatPreferences(options);
  const d = toDate(date);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/** Jour + mois court (ex. « 3 mars »). */
export function formatDayMonth(date, options = {}) {
  const { locale } = resolveFormatPreferences(options);
  const d = toDate(date);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Jour + mois + heure (ex. « 3 mars · 18:30 »). */
export function formatDayMonthTime(date, options = {}) {
  const prefs = resolveFormatPreferences(options);
  const d = toDate(date);
  if (!d) return "";
  const dayMonth = formatDayMonth(d, prefs);
  const time = formatTime(d, prefs);
  return `${dayMonth} · ${time}`;
}
