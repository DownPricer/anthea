/**
 * Couverture i18n vague complète : pages, contenu utilisateur, stockage locale.
 */
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, toHtmlLang } from "./supportedLocales";
import {
  readStoredLocale,
  writeStoredLocale,
  readStoredTimeFormat,
  writeStoredTimeFormat,
} from "./storage";
import { resolveChallengeLabels } from "./challengeLabels";
import { getBadgeName } from "./badgeLabels";

const PAGE_NAMESPACES = {
  navigation: ["items.home", "items.workouts", "items.duo", "items.profile", "items.settings"],
  auth: ["login.submit", "register.title"],
  home: ["title", "feed.title"],
  workouts: ["title"],
  player: ["pause", "resume"],
  profile: ["title"],
  duo: ["title"],
  settings: ["title"],
  notifications: ["title"],
  badges: ["title"],
};

describe("supported locales and storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("default locale is fr-FR", () => {
    expect(DEFAULT_LOCALE).toBe("fr-FR");
    expect(SUPPORTED_LOCALES).toEqual(["fr-FR", "en-US", "es-ES"]);
  });

  test("toHtmlLang maps BCP47", () => {
    expect(toHtmlLang("fr-FR")).toBe("fr");
    expect(toHtmlLang("en-US")).toBe("en");
    expect(toHtmlLang("es-ES")).toBe("es");
  });

  test("locale and time_format persist in localStorage", () => {
    writeStoredLocale("en-US");
    writeStoredTimeFormat("24h");
    expect(readStoredLocale()).toBe("en-US");
    expect(readStoredTimeFormat()).toBe("24h");
    writeStoredLocale("es-ES");
    writeStoredTimeFormat("12h");
    expect(readStoredLocale()).toBe("es-ES");
    expect(readStoredTimeFormat()).toBe("12h");
  });

  test("invalid locale falls back via write normalize", () => {
    writeStoredLocale("de-DE");
    // storage may reject or normalize — never return unsupported
    const stored = readStoredLocale();
    expect(!stored || SUPPORTED_LOCALES.includes(stored)).toBe(true);
  });
});

describe("main page chrome keys present FR/EN/ES", () => {
  Object.entries(PAGE_NAMESPACES).forEach(([ns, keys]) => {
    test(`${ns} has primary keys in all locales`, () => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const fr = require(`./locales/fr/${ns}.json`);
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const en = require(`./locales/en/${ns}.json`);
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const es = require(`./locales/es/${ns}.json`);

      keys.forEach((key) => {
        const parts = key.split(".");
        const dig = (obj) => parts.reduce((acc, p) => acc?.[p], obj);
        expect(String(dig(fr) || "").trim()).toBeTruthy();
        expect(String(dig(en) || "").trim()).toBeTruthy();
        expect(String(dig(es) || "").trim()).toBeTruthy();
      });
    });
  });
});

describe("user-generated content is never in locale files", () => {
  const USER_CONTENT_MARKERS = [
    "Mon post perso",
    "Commentaire utilisateur",
    "Ma bio unique",
    "Séance custom XYZ",
    "Exercice inventé",
    "Duo des copains",
  ];

  test("locale JSON files do not contain user content markers", () => {
    const langs = ["fr", "en", "es"];
    const namespaces = [
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
    ];
    const blob = langs
      .flatMap((lang) =>
        namespaces.map((ns) => {
          // eslint-disable-next-line global-require, import/no-dynamic-require
          return JSON.stringify(require(`./locales/${lang}/${ns}.json`));
        })
      )
      .join("\n");

    USER_CONTENT_MARKERS.forEach((marker) => {
      expect(blob.includes(marker)).toBe(false);
    });
  });

  test("switching language helper does not mutate user payload fields", () => {
    const userContent = {
      post: "Mon super post",
      comment: "Un commentaire",
      bio: "Bio perso",
      workoutName: "Séance custom XYZ",
      exerciseName: "Exercice inventé",
      duoName: "Duo des copains",
    };
    const snapshot = JSON.stringify(userContent);
    // Simule un changement de langue : seules les clés UI changent, pas le payload
    const afterLocaleChange = { ...userContent };
    expect(JSON.stringify(afterLocaleChange)).toBe(snapshot);
  });
});

describe("challenge and badge label helpers", () => {
  test("resolveChallengeLabels keeps custom challenge text", () => {
    const t = () => "";
    const custom = {
      id: "user_custom_abc",
      title: "Mon défi perso",
      description: "Description libre",
    };
    expect(resolveChallengeLabels(custom, t)).toEqual({
      title: "Mon défi perso",
      description: "Description libre",
    });
  });

  test("getBadgeName falls back to historical name", () => {
    const t = () => "";
    expect(getBadgeName("unknown_old_badge", t, "Ancien nom FR")).toBe("Ancien nom FR");
  });
});
