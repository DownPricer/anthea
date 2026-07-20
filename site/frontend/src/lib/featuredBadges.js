export function computeValidFeaturedBadgeIds(savedIds, unlockedBadges, max = 3) {
  const ids = Array.isArray(savedIds) ? savedIds.map(String) : [];
  const unlockedIdSet = new Set((unlockedBadges || []).map((b) => String(b?.id)));
  return ids.filter((id) => unlockedIdSet.has(id)).slice(0, max);
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

