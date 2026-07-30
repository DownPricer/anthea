/**
 * Configuration marketing publique FitGather (landing).
 * Une seule source pour le chiffre communauté — ne pas le dupliquer ailleurs.
 */
export const PUBLIC_SITE_ORIGIN = 'https://fitgather.fr';

export const COMMUNITY_MEMBER_COUNT = (() => {
  const raw = process.env.REACT_APP_COMMUNITY_MEMBER_COUNT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 5000;
})();

/** Format localisé du nombre de membres (FR: 5 000, EN: 5,000, ES: 5000). */
export function formatCommunityMemberCount(locale) {
  const lang = String(locale || 'fr').split('-')[0].toLowerCase();
  const localeTag = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'fr-FR';
  return new Intl.NumberFormat(localeTag).format(COMMUNITY_MEMBER_COUNT);
}

export function buildPublicPostUrl(postId) {
  if (!postId) return `${PUBLIC_SITE_ORIGIN}/`;
  return `${PUBLIC_SITE_ORIGIN}/post/${encodeURIComponent(postId)}`;
}
