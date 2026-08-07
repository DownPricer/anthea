/**
 * Tests i18n toast language after locale change.
 */
const fs = require('fs');
const path = require('path');

describe('settings locale toast i18n', () => {
  test('persistLocalePrefs uses i18n.t with explicit lng', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../pages/SettingsPage.jsx'),
      'utf8',
    );
    expect(src).toContain("i18n.t('settings:languageRegion.saveSuccess', { lng: nextLocale })");
    expect(src).toContain("i18n.t('settings:languageRegion.saveError', { lng: nextLocale })");
  });
});

describe('settings locale toast translations', () => {
  test('saveSuccess strings differ per language', () => {
    const fr = require('../i18n/locales/fr/settings.json');
    const en = require('../i18n/locales/en/settings.json');
    const es = require('../i18n/locales/es/settings.json');
    expect(fr.languageRegion.saveSuccess).toBe('Préférences enregistrées');
    expect(en.languageRegion.saveSuccess).toBe('Preferences saved');
    expect(es.languageRegion.saveSuccess).toBe('Preferencias guardadas');
  });
});
