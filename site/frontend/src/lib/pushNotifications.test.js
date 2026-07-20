const fs = require('fs');
const path = require('path');

/** Typo historique (D manquant) — construit pour éviter un faux positif grep. */
const TYPO_KEY = ['VAPI', 'PUBLIC_KEY'].join('_');
const CORRECT_KEY = 'VAPID_PUBLIC_KEY';

describe('pushNotifications VAPID wiring', () => {
  const srcPath = path.join(__dirname, 'pushNotifications.js');
  const src = fs.readFileSync(srcPath, 'utf8');

  test('ne contient aucune occurrence du typo VAPID sans D', () => {
    expect(src.includes(TYPO_KEY)).toBe(false);
  });

  test('subscribe utilise VAPID_PUBLIC_KEY pour applicationServerKey', () => {
    expect(src).toMatch(new RegExp(`import\\s*\\{[^}]*\\b${CORRECT_KEY}\\b[^}]*\\}\\s*from\\s*['"]\\.\\/env['"]`));
    expect(src).toMatch(new RegExp(`applicationServerKey:\\s*urlBase64ToUint8Array\\(\\s*${CORRECT_KEY}\\s*\\)`));
  });

  test('env.js exporte VAPID_PUBLIC_KEY (pas le typo)', () => {
    const envSrc = fs.readFileSync(path.join(__dirname, 'env.js'), 'utf8');
    expect(envSrc.includes(TYPO_KEY)).toBe(false);
    expect(envSrc).toMatch(/export const VAPID_PUBLIC_KEY/);
  });
});
