const NAMESPACES = [
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
  "public",
];

function collectKeys(obj, prefix = "") {
  const keys = [];
  Object.entries(obj || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...collectKeys(value, path));
    } else {
      keys.push(path);
    }
  });
  return keys.sort();
}

describe("locale parity", () => {
  NAMESPACES.forEach((ns) => {
    it(`${ns}: en and es have the same keys as fr`, () => {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const fr = require(`./locales/fr/${ns}.json`);
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const en = require(`./locales/en/${ns}.json`);
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const es = require(`./locales/es/${ns}.json`);

      const frKeys = collectKeys(fr);
      const enKeys = collectKeys(en);
      const esKeys = collectKeys(es);

      expect(enKeys).toEqual(frKeys);
      expect(esKeys).toEqual(frKeys);

      frKeys.forEach((key) => {
        const parts = key.split(".");
        let frVal = fr;
        let enVal = en;
        let esVal = es;
        for (const p of parts) {
          frVal = frVal?.[p];
          enVal = enVal?.[p];
          esVal = esVal?.[p];
        }
        expect(String(frVal || "").trim().length).toBeGreaterThan(0);
        expect(String(enVal || "").trim().length).toBeGreaterThan(0);
        expect(String(esVal || "").trim().length).toBeGreaterThan(0);
      });
    });
  });
});

describe("badge catalog translations", () => {
  // eslint-disable-next-line global-require
  const fr = require("./locales/fr/badges.json");
  // eslint-disable-next-line global-require
  const en = require("./locales/en/badges.json");
  // eslint-disable-next-line global-require
  const es = require("./locales/es/badges.json");

  const soloIds = Object.keys(fr).filter((k) => k.startsWith("solo_"));
  const duoIds = Object.keys(fr).filter((k) => k.startsWith("duo_"));

  test("exactly 50 solo and 50 duo badges", () => {
    expect(soloIds).toHaveLength(50);
    expect(duoIds).toHaveLength(50);
  });

  test("badge ids identical across locales", () => {
    expect(Object.keys(en).filter((k) => k.startsWith("solo_")).sort()).toEqual(soloIds.sort());
    expect(Object.keys(es).filter((k) => k.startsWith("solo_")).sort()).toEqual(soloIds.sort());
    expect(Object.keys(en).filter((k) => k.startsWith("duo_")).sort()).toEqual(duoIds.sort());
    expect(Object.keys(es).filter((k) => k.startsWith("duo_")).sort()).toEqual(duoIds.sort());
  });

  test("each badge has name and description in all locales", () => {
    [...soloIds, ...duoIds].forEach((id) => {
      expect(fr[id]?.name?.trim()).toBeTruthy();
      expect(fr[id]?.description?.trim()).toBeTruthy();
      expect(en[id]?.name?.trim()).toBeTruthy();
      expect(en[id]?.description?.trim()).toBeTruthy();
      expect(es[id]?.name?.trim()).toBeTruthy();
      expect(es[id]?.description?.trim()).toBeTruthy();
    });
  });
});
