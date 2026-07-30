import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, toHtmlLang } from "./supportedLocales";
import { detectBrowserLocale, readStoredLocale, writeStoredLocale } from "./storage";

const PRELOADED_NAMESPACES = [
  "common",
  "navigation",
  "auth",
  "home",
  "workouts",
  "player",
  "profile",
  "duo",
  "settings",
  "badges",
  "notifications",
  "challenges",
  "errors",
  "activity",
  "public",
];

function loadJson(locale, ns) {
  // CRA a besoin d'import paths statiques -> switch explicite
  switch (String(locale)) {
    case "fr-FR":
      if (ns === "common") return import("./locales/fr/common.json");
      if (ns === "navigation") return import("./locales/fr/navigation.json");
      if (ns === "auth") return import("./locales/fr/auth.json");
      if (ns === "home") return import("./locales/fr/home.json");
      if (ns === "workouts") return import("./locales/fr/workouts.json");
      if (ns === "player") return import("./locales/fr/player.json");
      if (ns === "profile") return import("./locales/fr/profile.json");
      if (ns === "duo") return import("./locales/fr/duo.json");
      if (ns === "settings") return import("./locales/fr/settings.json");
      if (ns === "badges") return import("./locales/fr/badges.json");
      if (ns === "notifications") return import("./locales/fr/notifications.json");
      if (ns === "challenges") return import("./locales/fr/challenges.json");
      if (ns === "errors") return import("./locales/fr/errors.json");
      if (ns === "activity") return import("./locales/fr/activity.json");
      if (ns === "public") return import("./locales/fr/public.json");
      break;
    case "en-US":
      if (ns === "common") return import("./locales/en/common.json");
      if (ns === "navigation") return import("./locales/en/navigation.json");
      if (ns === "auth") return import("./locales/en/auth.json");
      if (ns === "home") return import("./locales/en/home.json");
      if (ns === "workouts") return import("./locales/en/workouts.json");
      if (ns === "player") return import("./locales/en/player.json");
      if (ns === "profile") return import("./locales/en/profile.json");
      if (ns === "duo") return import("./locales/en/duo.json");
      if (ns === "settings") return import("./locales/en/settings.json");
      if (ns === "badges") return import("./locales/en/badges.json");
      if (ns === "notifications") return import("./locales/en/notifications.json");
      if (ns === "challenges") return import("./locales/en/challenges.json");
      if (ns === "errors") return import("./locales/en/errors.json");
      if (ns === "activity") return import("./locales/en/activity.json");
      if (ns === "public") return import("./locales/en/public.json");
      break;
    case "es-ES":
      if (ns === "common") return import("./locales/es/common.json");
      if (ns === "navigation") return import("./locales/es/navigation.json");
      if (ns === "auth") return import("./locales/es/auth.json");
      if (ns === "home") return import("./locales/es/home.json");
      if (ns === "workouts") return import("./locales/es/workouts.json");
      if (ns === "player") return import("./locales/es/player.json");
      if (ns === "profile") return import("./locales/es/profile.json");
      if (ns === "duo") return import("./locales/es/duo.json");
      if (ns === "settings") return import("./locales/es/settings.json");
      if (ns === "badges") return import("./locales/es/badges.json");
      if (ns === "notifications") return import("./locales/es/notifications.json");
      if (ns === "challenges") return import("./locales/es/challenges.json");
      if (ns === "errors") return import("./locales/es/errors.json");
      if (ns === "activity") return import("./locales/es/activity.json");
      if (ns === "public") return import("./locales/es/public.json");
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
        navigation: require("./locales/fr/navigation.json"),
        auth: require("./locales/fr/auth.json"),
        home: require("./locales/fr/home.json"),
        workouts: require("./locales/fr/workouts.json"),
        player: require("./locales/fr/player.json"),
        profile: require("./locales/fr/profile.json"),
        duo: require("./locales/fr/duo.json"),
        settings: require("./locales/fr/settings.json"),
        badges: require("./locales/fr/badges.json"),
        notifications: require("./locales/fr/notifications.json"),
        challenges: require("./locales/fr/challenges.json"),
        errors: require("./locales/fr/errors.json"),
        activity: require("./locales/fr/activity.json"),
        public: require("./locales/fr/public.json"),
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
    parseMissingKeyHandler: (key, defaultValue) => {
      // Ne jamais afficher une clé technique (ex. profile.edit.title).
      // Préférer defaultValue si fourni, sinon un libellé neutre lisible.
      if (typeof defaultValue === "string" && defaultValue.trim() && defaultValue !== key) {
        return defaultValue;
      }
      try {
        const unavailable = i18n.t("common:states.unavailable", {
          defaultValue: "Texte indisponible",
        });
        if (unavailable && unavailable !== "common:states.unavailable") {
          return unavailable;
        }
      } catch {
        // ignore
      }
      return "Texte indisponible";
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

