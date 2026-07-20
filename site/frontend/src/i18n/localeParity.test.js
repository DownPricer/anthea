const NAMESPACES = [
  'common',
  'navigation',
  'auth',
  'home',
  'workouts',
  'player',
  'profile',
  'duo',
  'settings',
  'badges',
  'notifications',
  'errors',
];

function collectKeys(obj, prefix = '') {
  const keys = [];
  Object.entries(obj || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value, path));
    } else {
      keys.push(path);
    }
  });
  return keys.sort();
}

describe('locale parity', () => {
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
    });
  });
});
