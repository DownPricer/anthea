import { DEFAULT_LOCALE, isSupportedLocale, isValidTimeFormat } from "./supportedLocales";

export const STORAGE_KEYS = {
  locale: "anthea_locale",
  timeFormat: "anthea_time_format",
};

export function readStoredLocale() {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.locale);
    return isSupportedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale) {
  try {
    localStorage.setItem(STORAGE_KEYS.locale, String(locale));
  } catch {
    // ignore
  }
}

export function readStoredTimeFormat() {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.timeFormat);
    return isValidTimeFormat(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

export function writeStoredTimeFormat(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.timeFormat, String(value));
  } catch {
    // ignore
  }
}

export function detectBrowserLocale() {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
  for (const raw of candidates) {
    const v = String(raw || "");
    if (v.startsWith("fr")) return "fr-FR";
    if (v.startsWith("en")) return "en-US";
    if (v.startsWith("es")) return "es-ES";
  }
  return DEFAULT_LOCALE;
}

