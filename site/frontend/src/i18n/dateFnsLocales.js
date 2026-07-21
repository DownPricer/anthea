import { fr, enUS, es } from "date-fns/locale";

/** Locale date-fns dynamique (fr / enUS / es) — plus de locale française forcée. */
export function getDateFnsLocale(locale) {
  const lng = String(locale || "").split("-")[0];
  if (lng === "en") return enUS;
  if (lng === "es") return es;
  return fr;
}
