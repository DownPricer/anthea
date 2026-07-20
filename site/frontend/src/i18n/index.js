import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, toHtmlLang } from "./supportedLocales";
import { detectBrowserLocale, readStoredLocale, writeStoredLocale } from "./storage";

const PRELOADED_NAMESPACES = ["common", "settings"];

function loadJson(locale, ns) {
  // CRA a besoin d'import paths statiques -> switch explicite
  switch (String(locale)) {
    case "fr-FR":
      if (ns === "common") return import("./locales/fr/common.json");
      if (ns === "settings") return import("./locales/fr/settings.json");
      break;
    case "en-US":
      if (ns === "common") return import("./locales/en/common.json");
      if (ns === "settings") return import("./locales/en/settings.json");
      break;
    case "es-ES":
      if (ns === "common") return import("./locales/es/common.json");
      if (ns === "settings") return import("./locales/es/settings.json");
      break;
    default:
      break;
  }
  return Promise.resolve({ default: {} });
}

async function ensureLocaleLoaded(locale) {
  const lng = String(locale || DEFAULT_LOCALE);
  const loaded = i18n.hasResourceBundle(lng, "common");
  if (loaded) return;
  await Promise.all(
    PRELOADED_NAMESPACES.map(async (ns) => {
      try {
        const mod = await loadJson(lng, ns);
        i18n.addResourceBundle(lng, ns, mod.default || mod, true, true);
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[i18n] namespace load failed", { locale: lng, ns }, e);
        }
        i18n.addResourceBundle(lng, ns, {}, true, true);
      }
    })
  );
}

export async function setAppLocale(locale) {
  const next = SUPPORTED_LOCALES.includes(String(locale)) ? String(locale) : DEFAULT_LOCALE;
  await ensureLocaleLoaded(next);
  await i18n.changeLanguage(next);
  writeStoredLocale(next);
  if (typeof document !== "undefined") {
    document.documentElement.lang = toHtmlLang(next);
  }
  return next;
}

export function getInitialLocale() {
  return readStoredLocale() || detectBrowserLocale() || DEFAULT_LOCALE;
}

// Init synchrone: on charge au moins le FR pour éviter le flash.
const initialLocale = getInitialLocale();

// Précharge locale initiale (async) mais on configure i18n tout de suite.
i18n
  .use(initReactI18next)
  .init({
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: "common",
    ns: PRELOADED_NAMESPACES,
    resources: {
      // FR toujours disponible au build
      "fr-FR": {
        common: require("./locales/fr/common.json"),
        settings: require("./locales/fr/settings.json"),
      },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    saveMissing: process.env.NODE_ENV !== "production",
    missingKeyHandler: (lng, ns, key) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[i18n missing]", `${ns}:${key}`, { lng });
      }
    },
    parseMissingKeyHandler: () => {
      // En prod, ne jamais afficher une clé brute à l'utilisateur.
      return "…";
    },
  })
  .then(async () => {
    // Si locale initiale ≠ fr-FR, on charge ses bundles puis change la langue.
    if (initialLocale !== "fr-FR") {
      await setAppLocale(initialLocale);
    } else {
      if (typeof document !== "undefined") {
        document.documentElement.lang = toHtmlLang(initialLocale);
      }
      writeStoredLocale(initialLocale);
    }
  })
  .catch(() => {
    // Ne jamais casser l'app si i18n ne s'initialise pas.
  });

export default i18n;

