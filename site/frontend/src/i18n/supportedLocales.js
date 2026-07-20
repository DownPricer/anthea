export const SUPPORTED_LOCALES = /** @type {const} */ (["fr-FR", "en-US", "es-ES"]);

export const DEFAULT_LOCALE = "fr-FR";

export const TIME_FORMATS = /** @type {const} */ (["auto", "12h", "24h"]);

export function toHtmlLang(locale) {
  const raw = String(locale || "");
  const lang = raw.split("-")[0] || "fr";
  return ["fr", "en", "es"].includes(lang) ? lang : "fr";
}

export function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(String(locale));
}

export function normalizeLocale(locale) {
  return isSupportedLocale(locale) ? String(locale) : DEFAULT_LOCALE;
}

export function isValidTimeFormat(value) {
  return TIME_FORMATS.includes(String(value));
}

