/**
 * Couverture bugfix : labels restants + partage badge.
 */
describe('remaining i18n labels and badge sharing', () => {
  const load = (lang, ns) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(`../i18n/locales/${lang}/${ns}.json`);
  };

  test('view all badges / view details / view comments / shared workout FR EN ES', () => {
    expect(load('fr', 'badges').actions.viewAll).toBe('Voir tous les badges');
    expect(load('en', 'badges').actions.viewAll).toBe('See all badges');
    expect(load('es', 'badges').actions.viewAll).toBe('Ver todas las insignias');

    expect(load('fr', 'common').actions.viewDetails).toBe('Voir les détails');
    expect(load('en', 'common').actions.viewDetails).toBe('View details');
    expect(load('es', 'common').actions.viewDetails).toBe('Ver detalles');

    expect(load('fr', 'home').comments.viewComments).toBe('Voir les commentaires');
    expect(load('en', 'home').comments.viewComments).toBe('View comments');
    expect(load('es', 'home').comments.viewComments).toBe('Ver comentarios');

    expect(load('fr', 'workouts').labels.sharedWorkout).toBe('Séance commune');
    expect(load('en', 'workouts').labels.sharedWorkout).toBe('Shared workout');
    expect(load('es', 'workouts').labels.sharedWorkout).toBe('Sesión compartida');
  });

  test('badge sharing defaults localized', () => {
    expect(load('fr', 'badges').sharing.defaultMessage).toMatch(/débloqué/i);
    expect(load('en', 'badges').sharing.defaultMessage).toMatch(/unlocked/i);
    expect(load('es', 'badges').sharing.defaultMessage).toMatch(/desbloqueado/i);
    expect(load('en', 'badges').sharing.defaultMessageWithName).toContain('{{badgeName}}');
  });

  test('notification badge unlock copy localized', () => {
    expect(load('fr', 'notifications').badgeUnlocked.title).toBe('Badge obtenu');
    expect(load('en', 'notifications').badgeUnlocked.title).toBe('Badge unlocked');
    expect(load('es', 'notifications').badgeUnlocked.title).toBe('Insignia desbloqueada');
    expect(load('en', 'notifications').badgeUnlocked.viewMyBadge).toBe('View my badge');
  });
});
