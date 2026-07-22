/**
 * Résolution du scope d'accueil : Monde (global) par défaut.
 */
export function resolveHomeFeedScope(scopeParam) {
  return scopeParam === 'following' ? 'following' : 'global';
}

export const HOME_FEED_TAB_ORDER = ['global', 'following'];
