import { canonicalBadgeId } from './legacyBadgeMap';
import { getBadgeName } from '../i18n/badgeLabels';

export function isSelectableSoloBadge(badge) {
  if (!badge?.id || !badge.unlocked) return false;
  if (badge.enabled === false) return false;
  const id = String(badge.id);
  if (badge.scope === 'duo') return false;
  if (badge.family === 'duo') return false;
  if (id.startsWith('duo_')) return false;
  return true;
}

export function filterSelectableSoloBadges(badges) {
  return (badges || []).filter(isSelectableSoloBadge);
}

/**
 * Normalise les IDs mis en avant : legacy → canonique, drop unknown/locked/duo/disabled,
 * déduplique, max N, conserve l'ordre.
 */
export function normalizeFeaturedBadgeIds(rawIds, unlockedSoloBadges, options = {}) {
  const max = options.max ?? 3;
  const unlockedById = new Map(
    filterSelectableSoloBadges(unlockedSoloBadges).map((b) => [String(b.id), b])
  );
  const ids = Array.isArray(rawIds) ? rawIds.map(String) : [];
  const cleaned = [];
  const seen = new Set();

  for (const raw of ids) {
    const canonical = canonicalBadgeId(raw);
    if (!canonical || seen.has(canonical)) continue;
    const badge = unlockedById.get(canonical);
    if (!badge) continue;
    seen.add(canonical);
    cleaned.push(canonical);
    if (cleaned.length >= max) break;
  }

  return cleaned;
}

/** @deprecated Utiliser normalizeFeaturedBadgeIds */
export function computeValidFeaturedBadgeIds(savedIds, unlockedBadges, max = 3) {
  return normalizeFeaturedBadgeIds(savedIds, unlockedBadges, { max });
}

export function toggleFeaturedBadgeId(currentIds, badgeId, max = 3) {
  const id = String(badgeId);
  const current = Array.isArray(currentIds) ? currentIds.map(String) : [];
  if (current.includes(id)) {
    return { next: current.filter((x) => x !== id), rejected: false };
  }
  if (current.length >= max) {
    return { next: current, rejected: true };
  }
  return { next: [...current, id], rejected: false };
}

export function getBadgeDisplayName(badge, t) {
  if (!badge) return '';
  const id = badge.id ? String(badge.id) : '';
  if (typeof t === 'function') {
    return getBadgeName(id, t, badge.name || id);
  }
  return badge.name || id;
}
