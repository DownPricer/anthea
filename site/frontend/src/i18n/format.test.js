import {
  formatTime,
  formatDate,
  formatDateTime,
  formatRelativeDate,
  formatDuration,
  formatNumber,
  formatCalories,
} from "./format";

describe("i18n format helpers", () => {
  const sample = new Date("2026-07-20T18:30:00");

  test("fr-FR auto shows 24h time", () => {
    const out = formatTime(sample, { locale: "fr-FR", timeFormat: "auto" });
    expect(out).toMatch(/18[:h]30/);
    expect(out.toLowerCase()).not.toMatch(/pm|am/);
  });

  test("es-ES auto shows 24h time", () => {
    const out = formatTime(sample, { locale: "es-ES", timeFormat: "auto" });
    expect(out).toMatch(/18[:h]30/);
    expect(out.toLowerCase()).not.toMatch(/pm|am/);
  });

  test("en-US auto shows 12h time", () => {
    const out = formatTime(sample, { locale: "en-US", timeFormat: "auto" });
    expect(out.toLowerCase()).toMatch(/6:30\s*pm/);
  });

  test("en-US + 24h override", () => {
    const out = formatTime(sample, { locale: "en-US", timeFormat: "24h" });
    expect(out).toMatch(/18[:h]?30/);
    expect(out.toLowerCase()).not.toMatch(/pm/);
  });

  test("fr-FR + 12h override", () => {
    const out = formatTime(sample, { locale: "fr-FR", timeFormat: "12h" });
    expect(out.toLowerCase()).toMatch(/6:30\s*pm/);
  });

  test("formatDate localizes month names", () => {
    const fr = formatDate(sample, { locale: "fr-FR" });
    const en = formatDate(sample, { locale: "en-US" });
    const es = formatDate(sample, { locale: "es-ES" });
    expect(fr.toLowerCase()).toMatch(/juillet/);
    expect(en.toLowerCase()).toMatch(/july/);
    expect(es.toLowerCase()).toMatch(/julio/);
  });

  test("formatDateTime includes date and time", () => {
    const out = formatDateTime(sample, { locale: "fr-FR", timeFormat: "24h" });
    expect(out).toMatch(/juillet/i);
    expect(out).toMatch(/18/);
  });

  test("formatRelativeDate returns a string", () => {
    const recent = new Date(Date.now() - 3 * 60 * 1000);
    const out = formatRelativeDate(recent, { locale: "fr-FR" });
    expect(out.length).toBeGreaterThan(0);
  });

  test("formatDuration", () => {
    const fr = formatDuration(90 * 60, { locale: "fr-FR" });
    const en = formatDuration(90 * 60, { locale: "en-US" });
    expect(fr.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
  });

  test("formatNumber and formatCalories", () => {
    expect(formatNumber(1234, { locale: "fr-FR" })).toBeTruthy();
    expect(formatCalories(500, { locale: "en-US" })).toMatch(/500/);
  });
});
